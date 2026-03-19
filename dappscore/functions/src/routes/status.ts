import { Router, Request, Response } from 'express';
import { dbPing } from '../lib/db';
import { redisPing } from '../lib/cache';

const router = Router();

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'unknown';

interface ServiceCheck {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  note?: string;
}

async function checkDatabase(): Promise<ServiceCheck> {
  try {
    const latencyMs = await dbPing();
    return {
      name: 'Database',
      status: latencyMs < 2000 ? 'operational' : 'degraded',
      latencyMs,
    };
  } catch {
    return { name: 'Database', status: 'down' };
  }
}

async function checkRedis(): Promise<ServiceCheck> {
  const status = await redisPing();
  if (status === 'not_configured') {
    return { name: 'Cache', status: 'unknown', note: 'Redis not configured (using pg fallback)' };
  }
  return {
    name: 'Cache',
    status: status === 'ok' ? 'operational' : 'degraded',
    note: status !== 'ok' ? status : undefined,
  };
}

async function checkIndexLayer(): Promise<ServiceCheck> {
  const url = process.env.SUBGRAPH_URL;
  if (!url) return { name: 'Index Layer', status: 'unknown', note: 'Not configured' };

  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ _meta { block { number } } }' }),
      signal: AbortSignal.timeout(5_000),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { name: 'Index Layer', status: 'degraded', latencyMs };
    return {
      name: 'Index Layer',
      status: latencyMs < 3000 ? 'operational' : 'degraded',
      latencyMs,
    };
  } catch {
    return { name: 'Index Layer', status: 'down', latencyMs: Date.now() - t0 };
  }
}

// ── GET /api/v1/status ────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [database, cache, indexLayer] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkIndexLayer(),
    ]);

    const services: ServiceCheck[] = [
      { name: 'API Server', status: 'operational' },
      database,
      cache,
      indexLayer,
    ];

    const hasDown     = services.some(s => s.status === 'down');
    const hasDegraded = services.some(s => s.status === 'degraded');
    const overall: ServiceStatus = hasDown ? 'down' : hasDegraded ? 'degraded' : 'operational';

    res.json({
      overall,
      services,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('GET /status error:', err);
    res.status(500).json({ error: 'Status check failed.' });
  }
});

export default router;
