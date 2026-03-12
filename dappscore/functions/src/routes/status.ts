import { Router, Request, Response } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const router = Router();

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'unknown';

interface ServiceCheck {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  note?: string;
}

async function checkDatabase(): Promise<ServiceCheck> {
  const t0 = Date.now();
  try {
    await getFirestore()
      .collection('_health_probe')
      .doc('ping')
      .set({ ts: Timestamp.now() });
    const latencyMs = Date.now() - t0;
    return {
      name: 'Database',
      status: latencyMs < 2000 ? 'operational' : 'degraded',
      latencyMs,
    };
  } catch {
    return { name: 'Database', status: 'down', latencyMs: Date.now() - t0 };
  }
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
// Public endpoint — no auth required. Runs all service probes in parallel.

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [database, indexLayer] = await Promise.all([
      checkDatabase(),
      checkIndexLayer(),
    ]);

    // API Server and CDN are implicitly operational if we're responding
    const services: ServiceCheck[] = [
      { name: 'API Server', status: 'operational' },
      database,
      { name: 'CDN', status: 'operational' },
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
