import { Router } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireApiKey } from '../lib/api-key-auth';

const router = Router();

// ── Schema ────────────────────────────────────────────────────────────────────

const saleSchema = z.object({
  raised:           z.number().min(0),
  goal:             z.number().positive(),
  currency:         z.string().min(1).max(10).transform(s => s.trim().toUpperCase()),
  tokenPrice:       z.number().positive(),
  startDate:        z.number().int(),
  endDate:          z.number().int(),
  minContribution:  z.number().min(0).optional(),
  maxContribution:  z.number().positive().optional(),
  saleContract:     z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  network:          z.string().max(50).transform(s => s.trim()).optional(),
}).refine(d => d.endDate > d.startDate, {
  message: 'endDate must be after startDate',
});

// ── GET /api/v1/projects/:id/sale ────────────────────────────────────────────

router.get('/:id/sale', async (req, res) => {
  const { id } = req.params;

  const doc = await getFirestore().collection('project_sales').doc(id).get();

  if (!doc.exists) {
    res.status(404).json({ error: 'No sale data found for this project.' });
    return;
  }

  res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
  res.json(doc.data());
});

// ── POST /api/v1/projects/:id/sale ───────────────────────────────────────────
// Requires a Bearer API key with `sale:write` permission scoped to this project.

router.post('/:id/sale', requireApiKey('sale:write', 'id'), async (req, res) => {
  const { id } = req.params;

  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'Invalid fields.', details: parsed.error.flatten() });
    return;
  }

  const saleData = { ...parsed.data, updatedAt: Math.floor(Date.now() / 1000) };
  await getFirestore().collection('project_sales').doc(id).set(saleData);

  res.json({ ok: true, data: saleData });
});

export default router;
