import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
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

// ── GET /api/v1/projects/:id/sale ─────────────────────────────────────────────

router.get('/:id/sale', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      'SELECT * FROM project_sales WHERE project_id = $1',
      [id],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'No sale data found for this project.' });
      return;
    }

    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    res.json(rows[0]);
  } catch (err) {
    console.error('[sale] GET /:id/sale', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
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

  const d = parsed.data;
  const updatedAt = Math.floor(Date.now() / 1000);

  try {
    await db.query(
      `INSERT INTO project_sales
         (project_id, raised, goal, currency, token_price, start_date, end_date,
          min_contribution, max_contribution, sale_contract, network, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (project_id) DO UPDATE SET
         raised           = $2,
         goal             = $3,
         currency         = $4,
         token_price      = $5,
         start_date       = $6,
         end_date         = $7,
         min_contribution = $8,
         max_contribution = $9,
         sale_contract    = $10,
         network          = $11,
         updated_at       = $12`,
      [
        id, d.raised, d.goal, d.currency, d.tokenPrice,
        d.startDate, d.endDate,
        d.minContribution ?? null, d.maxContribution ?? null,
        d.saleContract ?? null, d.network ?? null,
        updatedAt,
      ],
    );

    res.json({ ok: true, data: { ...d, updatedAt } });
  } catch (err) {
    console.error('[sale] POST /:id/sale', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
