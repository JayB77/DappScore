/**
 * cache.ts — Redis client (ioredis) with PostgreSQL fallback.
 *
 * Reads REDIS_URL from environment (optional).
 * If Redis is not configured or unavailable, cache operations
 * fall back to the stats_cache PostgreSQL table.
 *
 * Usage:
 *   import { cacheGet, cacheSet, cacheDel } from './cache';
 *
 *   const hit = await cacheGet<MyType>('key');
 *   await cacheSet('key', value, 300); // TTL in seconds
 *   await cacheDel('key');
 */

import Redis from 'ioredis';
import { db } from './db';

// ── Redis client (optional) ───────────────────────────────────────────────────

let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    // Downgrade to warning — we'll fall back to PostgreSQL
    console.warn('[cache] Redis error (falling back to pg):', err.message);
  });

  redis.connect().catch((err) => {
    console.warn('[cache] Redis connect failed (falling back to pg):', err.message);
    redis = null;
  });
} else {
  console.info('[cache] REDIS_URL not set — using PostgreSQL stats_cache fallback');
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Get a cached value. Returns null on miss or error. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  // Try Redis first
  if (redis?.status === 'ready') {
    try {
      const raw = await redis.get(key);
      if (raw !== null) return JSON.parse(raw) as T;
      return null;
    } catch {
      // fall through to pg
    }
  }

  // PostgreSQL fallback
  try {
    const { rows } = await db.query<{ value: T }>(
      'SELECT value FROM stats_cache WHERE key = $1',
      [key],
    );
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Set a cached value.
 * @param ttlSeconds  Time-to-live in seconds (Redis only — pg rows are manual-TTL).
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const serialized = JSON.stringify(value);

  // Try Redis first
  if (redis?.status === 'ready') {
    try {
      await redis.set(key, serialized, 'EX', ttlSeconds);
      return;
    } catch {
      // fall through to pg
    }
  }

  // PostgreSQL fallback
  try {
    await db.query(
      `INSERT INTO stats_cache (key, value, cached_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, cached_at = NOW()`,
      [key, serialized],
    );
  } catch (err) {
    console.warn('[cache] pg fallback write failed:', (err as Error).message);
  }
}

/** Delete a cache entry. */
export async function cacheDel(key: string): Promise<void> {
  if (redis?.status === 'ready') {
    try {
      await redis.del(key);
    } catch { /* non-fatal */ }
  }

  try {
    await db.query('DELETE FROM stats_cache WHERE key = $1', [key]);
  } catch { /* non-fatal */ }
}

/** Delete all cache entries matching a prefix (e.g. "stats:*"). */
export async function cacheDelPattern(pattern: string): Promise<void> {
  if (redis?.status === 'ready') {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    } catch { /* non-fatal */ }
  }

  // pg: pattern uses SQL LIKE syntax (replace * with %)
  try {
    const likePattern = pattern.replace(/\*/g, '%');
    await db.query('DELETE FROM stats_cache WHERE key LIKE $1', [likePattern]);
  } catch { /* non-fatal */ }
}

/**
 * Wrap a fetcher with cache-aside logic.
 * Returns cached value if fresh; otherwise calls fetcher, caches result, returns it.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  // Redis path: check TTL automatically
  if (redis?.status === 'ready') {
    try {
      const raw = await redis.get(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch { /* fall through */ }
  } else {
    // pg path: check cached_at manually
    try {
      const { rows } = await db.query<{ value: T; cached_at: Date }>(
        'SELECT value, cached_at FROM stats_cache WHERE key = $1',
        [key],
      );
      if (rows[0]) {
        const ageSeconds = (Date.now() - rows[0].cached_at.getTime()) / 1000;
        if (ageSeconds < ttlSeconds) return rows[0].value;
      }
    } catch { /* fall through */ }
  }

  const value = await fetcher();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

/** Probe Redis — used by health checks. */
export async function redisPing(): Promise<string> {
  if (!redis) return 'not_configured';
  if (redis.status !== 'ready') return `disconnected (${redis.status})`;
  try {
    const pong = await redis.ping();
    return pong === 'PONG' ? 'ok' : 'unexpected_response';
  } catch {
    return 'error';
  }
}
