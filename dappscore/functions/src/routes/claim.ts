/**
 * Claim Admin API — protected by CLAIM_ADMIN_KEY.
 *
 * Manages pre-launch $SCORE claim allocations for early participants.
 * Intentionally uses a separate key from ADMIN_API_KEY so the
 * frontend-exposed key only grants access to this collection.
 *
 * Firestore collection:  claim_allocations/{address}
 *
 * Routes:
 *   GET    /api/v1/claim              list all allocations (admin only)
 *   GET    /api/v1/claim/:address     get one allocation (admin only)
 *   PUT    /api/v1/claim/:address     upsert an allocation (admin only)
 *   DELETE /api/v1/claim/:address     delete an allocation (admin only)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const router = Router();
const COLLECTION = 'claim_allocations';

// ── Auth middleware ────────────────────────────────────────────────────────────

function requireClaimAdmin(req: Request, res: Response, next: NextFunction): void {
  const key = process.env.CLAIM_ADMIN_KEY ?? '';
  if (!key) {
    res.status(500).json({ error: 'Claim admin key not configured.' });
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

router.use(requireClaimAdmin);

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

// ── GET /api/v1/claim ─────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const snap = await getFirestore()
      .collection(COLLECTION)
      .orderBy('score', 'desc')
      .get();

    const allocations = snap.docs.map(d => ({ address: d.id, ...d.data() }));
    const totalScore = allocations.reduce((s: number, a: Record<string, unknown>) => s + (a.score as number), 0);
    const totalVotes = allocations.reduce((s: number, a: Record<string, unknown>) => s + (a.votes as number), 0);

    res.json({
      success: true,
      data: { allocations, summary: { count: allocations.length, totalScore, totalVotes } },
    });
  } catch (err) {
    console.error('[claim] GET /', err);
    res.status(500).json({ success: false, error: 'Failed to fetch allocations.' });
  }
});

// ── GET /api/v1/claim/:address ────────────────────────────────────────────────

router.get('/:address', async (req, res) => {
  const address = normalizeAddress(req.params.address);
  if (!isValidAddress(address)) {
    res.status(400).json({ success: false, error: 'Invalid wallet address.' });
    return;
  }

  try {
    const doc = await getFirestore().collection(COLLECTION).doc(address).get();
    if (!doc.exists) {
      res.status(404).json({ success: false, error: 'Allocation not found.' });
      return;
    }
    res.json({ success: true, data: { address, ...doc.data() } });
  } catch (err) {
    console.error('[claim] GET /:address', err);
    res.status(500).json({ success: false, error: 'Failed to fetch allocation.' });
  }
});

// ── PUT /api/v1/claim/:address ────────────────────────────────────────────────

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

  try {
    const db   = getFirestore();
    const ref  = db.collection(COLLECTION).doc(address);
    const now  = Timestamp.now();
    const existing = await ref.get();

    await ref.set({
      ...parsed.data,
      address,
      addedAt:   existing.exists ? existing.data()!.addedAt : now,
      updatedAt: now,
    });

    res.json({ success: true, data: { address, ...parsed.data } });
  } catch (err) {
    console.error('[claim] PUT /:address', err);
    res.status(500).json({ success: false, error: 'Failed to save allocation.' });
  }
});

// ── DELETE /api/v1/claim/:address ─────────────────────────────────────────────

router.delete('/:address', async (req, res) => {
  const address = normalizeAddress(req.params.address);
  if (!isValidAddress(address)) {
    res.status(400).json({ success: false, error: 'Invalid wallet address.' });
    return;
  }

  try {
    await getFirestore().collection(COLLECTION).doc(address).delete();
    res.json({ success: true });
  } catch (err) {
    console.error('[claim] DELETE /:address', err);
    res.status(500).json({ success: false, error: 'Failed to delete allocation.' });
  }
});

export default router;
