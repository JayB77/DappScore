/**
 * Redis cache with PostgreSQL stats_cache fallback.
 * Reads REDIS_URL from environment (optional).
 */

import Redis from 'ioredis';
import { db } from './db';

let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  redis.on('error', (err) => console.warn('[cache] Redis error:', err.message));
  redis.connect().catch(() => { redis = null; });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis?.status === 'ready') {
    try {
      const raw = await redis.get(key);
      if (raw !== null) return JSON.parse(raw) as T;
      return null;
    } catch { /* fall through */ }
  }
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

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const serialized = JSON.stringify(value);
  if (redis?.status === 'ready') {
    try {
      await redis.set(key, serialized, 'EX', ttlSeconds);
      return;
    } catch { /* fall through */ }
  }
  try {
    await db.query(
      `INSERT INTO stats_cache (key, value, cached_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, cached_at = NOW()`,
      [key, serialized],
    );
  } catch { /* non-fatal */ }
}

export async function cacheDel(key: string): Promise<void> {
  if (redis?.status === 'ready') {
    try { await redis.del(key); } catch { /* non-fatal */ }
  }
  try { await db.query('DELETE FROM stats_cache WHERE key = $1', [key]); } catch { /* non-fatal */ }
}

export async function withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const value = await fetcher();
  await cacheSet(key, value, ttlSeconds);
  return value;
}
