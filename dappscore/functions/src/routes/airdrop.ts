/**
 * Airdrop Admin API — protected by AIRDROP_ADMIN_KEY.
 *
 * Manages pre-launch $SCORE allocations for early participants.
 * Intentionally uses a separate key from ADMIN_API_KEY so the
 * frontend-exposed key only grants access to this table.
 *
 * Table: airdrop_allocations (replaces Firestore airdrop_allocations/{address})
 *
 * Routes:
 *   GET    /api/v1/airdrop              list all allocations (admin only)
 *   GET    /api/v1/airdrop/:address     get one allocation (admin only)
 *   PUT    /api/v1/airdrop/:address     upsert an allocation (admin only)
 *   DELETE /api/v1/airdrop/:address     delete an allocation (admin only)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';

const router = Router();

// ── Auth middleware ────────────────────────────────────────────────────────────

function requireAirdropAdmin(req: Request, res: Response, next: NextFunction): void {
  const key = process.env.AIRDROP_ADMIN_KEY ?? '';
  if (!key) {
    res.status(500).json({ error: 'Airdrop admin key not configured.' });
    return;
  }
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required.' });
    return;
  }
  const provided = header.slice(7).trim();
  if (provided.length !== key.length) {
    res.status(403).json({ error: 'Forbidden.' });
    return;
  }
  let diff = 0;
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ key.charCodeAt(i);
  if (diff !== 0) {
    res.status(403).json({ error: 'Forbidden.' });
    return;
  }
  next();
}

router.use(requireAirdropAdmin);

// ── Validation ────────────────────────────────────────────────────────────────

const allocationSchema = z.object({
  votes: z.number().int().min(0),
  score: z.number().int().min(0),
  note:  z.string().max(200).optional().default(''),
});

function normalizeAddress(addr: string): string {
  return addr.toLowerCase();
}

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ── GET /api/v1/airdrop ───────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT address, votes, score, note, added_at, updated_at FROM airdrop_allocations ORDER BY score DESC',
    );

    const totalScore = rows.reduce((s, r) => s + r.score, 0);
    const totalVotes = rows.reduce((s, r) => s + r.votes, 0);

    res.json({
      success: true,
      data: { allocations: rows, summary: { count: rows.length, totalScore, totalVotes } },
    });
  } catch (err) {
    console.error('[airdrop] GET /', err);
    res.status(500).json({ success: false, error: 'Failed to fetch allocations.' });
  }
});

// ── GET /api/v1/airdrop/:address ──────────────────────────────────────────────

router.get('/:address', async (req, res) => {
  const address = normalizeAddress(req.params.address);
  if (!isValidAddress(address)) {
    res.status(400).json({ success: false, error: 'Invalid wallet address.' });
    return;
  }

  try {
    const { rows } = await db.query(
      'SELECT address, votes, score, note, added_at, updated_at FROM airdrop_allocations WHERE address = $1',
      [address],
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, error: 'Allocation not found.' });
      return;
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[airdrop] GET /:address', err);
    res.status(500).json({ success: false, error: 'Failed to fetch allocation.' });
  }
});

// ── PUT /api/v1/airdrop/:address ──────────────────────────────────────────────

router.put('/:address', async (req, res) => {
  const address = normalizeAddress(req.params.address);
  if (!isValidAddress(address)) {
    res.status(400).json({ success: false, error: 'Invalid wallet address.' });
    return;
  }

  const parsed = allocationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid body.' });
    return;
  }

  const d = parsed.data;

  try {
    await db.query(
      `INSERT INTO airdrop_allocations (address, votes, score, note, added_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (address) DO UPDATE SET
         votes      = $2,
         score      = $3,
         note       = $4,
         updated_at = NOW()`,
      [address, d.votes, d.score, d.note],
    );

    res.json({ success: true, data: { address, ...d } });
  } catch (err) {
    console.error('[airdrop] PUT /:address', err);
    res.status(500).json({ success: false, error: 'Failed to save allocation.' });
  }
});

// ── DELETE /api/v1/airdrop/:address ──────────────────────────────────────────

router.delete('/:address', async (req, res) => {
  const address = normalizeAddress(req.params.address);
  if (!isValidAddress(address)) {
    res.status(400).json({ success: false, error: 'Invalid wallet address.' });
    return;
  }

  try {
    await db.query('DELETE FROM airdrop_allocations WHERE address = $1', [address]);
    res.json({ success: true });
  } catch (err) {
    console.error('[airdrop] DELETE /:address', err);
    res.status(500).json({ success: false, error: 'Failed to delete allocation.' });
  }
});

export default router;
