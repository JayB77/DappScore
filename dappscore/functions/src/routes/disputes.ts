/**
 * Disputes — community dispute submission and voting.
 *
 * POST /api/v1/disputes        — submit a dispute
 * GET  /api/v1/disputes/:id    — fetch a dispute
 * POST /api/v1/disputes/:id/vote — cast a vote
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';

const router = Router();

const submitSchema = z.object({
  projectId:    z.string().min(1).max(100),
  submitter:    z.string().min(1).max(200),
  category:     z.enum(['scam', 'misleading', 'abandoned', 'other']),
  description:  z.string().min(10).max(2000),
  evidenceUrls: z.array(z.string().url()).max(10).optional(),
});

/** POST /api/v1/disputes */
router.post('/', async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      error:   'Invalid fields.',
      details: parsed.error.flatten(),
    });
  }

  const { projectId, submitter, category, description, evidenceUrls } = parsed.data;
  try {
    const { rows } = await db.query(
      `INSERT INTO disputes
         (project_id, submitter, category, description, evidence_urls, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
       RETURNING id`,
      [projectId, submitter, category, description, evidenceUrls ?? []],
    );
    res.status(201).json({ success: true, data: { disputeId: rows[0].id } });
  } catch (err) {
    console.error('[disputes] POST /', err);
    res.status(500).json({ success: false, error: 'Failed to submit dispute.' });
  }
});

/** GET /api/v1/disputes/:id */
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid dispute ID.' });
  }

  try {
    const { rows } = await db.query(
      `SELECT id, project_id, submitter, category, description,
              evidence_urls, status, votes_for, votes_against,
              admin_notes, created_at, updated_at, resolved_at
       FROM disputes WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Dispute not found.' });
    }
    res.json({ success: true, data: { dispute: rows[0] } });
  } catch (err) {
    console.error('[disputes] GET /:id', err);
    res.status(500).json({ success: false, error: 'Failed to fetch dispute.' });
  }
});

const voteSchema = z.object({
  voter: z.string().min(1).max(200),
  vote:  z.enum(['for', 'against']),
});

/** POST /api/v1/disputes/:id/vote */
router.post('/:id/vote', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid dispute ID.' });
  }

  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      error:   'Invalid fields.',
      details: parsed.error.flatten(),
    });
  }

  const { vote } = parsed.data;
  const col = vote === 'for' ? 'votes_for' : 'votes_against';

  try {
    const { rowCount } = await db.query(
      `UPDATE disputes SET ${col} = ${col} + 1, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Dispute not found.' });
    }
    res.json({ success: true, message: 'Vote recorded.' });
  } catch (err) {
    console.error('[disputes] POST /:id/vote', err);
    res.status(500).json({ success: false, error: 'Failed to record vote.' });
  }
});

export default router;
