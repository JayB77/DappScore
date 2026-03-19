/**
 * db.ts — PostgreSQL connection pool.
 *
 * Reads DATABASE_URL from environment.
 * Example: postgresql://user:password@localhost:5432/dappscore
 *
 * Usage:
 *   import { db } from '../lib/db';
 *   const { rows } = await db.query('SELECT * FROM api_keys WHERE id = $1', [id]);
 */

import { Pool, PoolClient } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

db.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

/**
 * Run multiple queries in a single transaction.
 * Rolls back automatically on error.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Probe the database — used by health checks. */
export async function dbPing(): Promise<number> {
  const t0 = Date.now();
  await db.query('SELECT 1');
  return Date.now() - t0;
}
