/**
 * Disputes / Appeals API Routes
 *
 * GET    /api/v1/disputes/project/:projectId  — list disputes for a project
 * POST   /api/v1/disputes/project/:projectId  — file a new dispute
 * POST   /api/v1/disputes/:disputeId/vote     — cast a community vote
 * DELETE /api/v1/disputes/:disputeId          — withdraw own dispute
 */

import { Router, Request, Response } from 'express';
import { db } from '../lib/db';
import { logger } from '../services/logger';

const router = Router();

function requireUser(req: Request, res: Response): string | null {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    res.status(401).json({ success: false, error: 'User ID required' });
    return null;
  }
  return userId;
}

/** GET /api/v1/disputes/project/:projectId */
router.get('/project/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  try {
    const { rows } = await db.query(
      `SELECT id, project_id, submitter, category, description, evidence_urls,
              status, votes_for, votes_against, admin_notes, created_at, updated_at, resolved_at
       FROM disputes
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId],
    );

    res.json({ success: true, data: { disputes: rows } });
  } catch (err: any) {
    logger.error('[Disputes] GET project error', err);
    res.status(500).json({ success: false, error: 'Failed to fetch disputes' });
  }
});

/** POST /api/v1/disputes/project/:projectId — file a new dispute */
router.post('/project/:projectId', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { projectId } = req.params;
  const { category, description, evidenceUrls = [] } = req.body as {
    category?: string;
    description?: string;
    evidenceUrls?: string[];
  };

  const VALID_CATEGORIES = ['false_flag', 'stale_data', 'wrong_score', 'other'];
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, error: 'Invalid category' });
  }
  if (!description || description.trim().length < 30) {
    return res.status(400).json({ success: false, error: 'Description must be at least 30 characters' });
  }

  try {
    // One open dispute per user per project at a time
    const { rows: existing } = await db.query(
      `SELECT id FROM disputes
       WHERE project_id = $1 AND submitter = $2
         AND status IN ('pending', 'under_review')`,
      [projectId, userId],
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'You already have an open dispute for this project' });
    }

    const { rows } = await db.query(
      `INSERT INTO disputes (project_id, submitter, category, description, evidence_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, project_id, submitter, category, description, evidence_urls,
                 status, votes_for, votes_against, created_at`,
      [projectId, userId, category, description.trim(), evidenceUrls],
    );

    logger.info(`Dispute filed for project ${projectId} by ${userId}`);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    logger.error('[Disputes] POST error', err);
    res.status(500).json({ success: false, error: 'Failed to submit dispute' });
  }
});

/** POST /api/v1/disputes/:disputeId/vote — community vote */
router.post('/:disputeId/vote', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const disputeId = parseInt(req.params.disputeId, 10);
  if (isNaN(disputeId)) {
    return res.status(400).json({ success: false, error: 'Invalid dispute ID' });
  }

  const { support } = req.body as { support?: boolean };
  if (typeof support !== 'boolean') {
    return res.status(400).json({ success: false, error: '"support" (boolean) required' });
  }

  try {
    // Verify dispute exists and is open
    const { rows: dispute } = await db.query(
      `SELECT id, status FROM disputes WHERE id = $1`,
      [disputeId],
    );
    if (dispute.length === 0) {
      return res.status(404).json({ success: false, error: 'Dispute not found' });
    }
    if (!['pending', 'under_review'].includes(dispute[0].status)) {
      return res.status(409).json({ success: false, error: 'Dispute is no longer open for voting' });
    }

    // Upsert vote
    await db.query(
      `INSERT INTO dispute_votes (dispute_id, voter, support)
       VALUES ($1, $2, $3)
       ON CONFLICT (dispute_id, voter) DO UPDATE SET support = EXCLUDED.support, voted_at = NOW()`,
      [disputeId, userId, support],
    );

    // Recount
    const { rows: counts } = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE support = TRUE)  AS votes_for,
         COUNT(*) FILTER (WHERE support = FALSE) AS votes_against
       FROM dispute_votes WHERE dispute_id = $1`,
      [disputeId],
    );

    const votes_for     = parseInt(counts[0].votes_for,     10);
    const votes_against = parseInt(counts[0].votes_against, 10);

    // Sync counts back to disputes row
    await db.query(
      `UPDATE disputes SET votes_for = $1, votes_against = $2 WHERE id = $3`,
      [votes_for, votes_against, disputeId],
    );

    res.json({ success: true, data: { votes_for, votes_against } });
  } catch (err: any) {
    logger.error('[Disputes] VOTE error', err);
    res.status(500).json({ success: false, error: 'Failed to record vote' });
  }
});

/** DELETE /api/v1/disputes/:disputeId — withdraw own dispute */
router.delete('/:disputeId', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const disputeId = parseInt(req.params.disputeId, 10);
  if (isNaN(disputeId)) {
    return res.status(400).json({ success: false, error: 'Invalid dispute ID' });
  }

  try {
    const { rowCount } = await db.query(
      `UPDATE disputes
       SET status = 'withdrawn', updated_at = NOW()
       WHERE id = $1 AND submitter = $2
         AND status IN ('pending', 'under_review')`,
      [disputeId, userId],
    );

    if ((rowCount ?? 0) === 0) {
      return res.status(404).json({ success: false, error: 'Dispute not found or not withdrawable' });
    }

    logger.info(`Dispute ${disputeId} withdrawn by ${userId}`);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('[Disputes] DELETE error', err);
    res.status(500).json({ success: false, error: 'Failed to withdraw dispute' });
  }
});

export { router as disputeRoutes };
export default router;
