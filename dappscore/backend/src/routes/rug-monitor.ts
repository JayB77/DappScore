import { Router } from 'express';
import { z } from 'zod';
import { analyzeForRug, runAndBroadcast, getRecentAlerts } from '../services/rug-detector';

const router = Router();

// GET /api/v1/rug-monitor/recent
// Returns the in-memory ring buffer of recent high-score rug signals.
router.get('/recent', (_req, res) => {
  res.json({ alerts: getRecentAlerts() });
});

// POST /api/v1/rug-monitor/analyze
// On-demand analysis for a specific token.  Writes to ring buffer + broadcasts
// via WS if score ≥ 25.
const analyzeSchema = z.object({
  tokenAddress:    z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid token address'),
  pairAddress:     z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  deployerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  explorerApiBase: z.string().url().optional(),
  chainId:         z.number().int().positive().optional(),
  network:         z.enum(['mainnet', 'testnet']).optional(),
});

router.post('/analyze', async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }
  try {
    const signal = await runAndBroadcast(parsed.data);
    res.json(signal);
  } catch {
    res.status(500).json({ error: 'Analysis failed' });
  }
});

export { router as rugMonitorRoutes };
