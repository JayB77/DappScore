/**
 * Dispute / Appeals API
 *
 * Allows project owners (or any community member) to file a formal appeal
 * when automated flags or admin overrides are believed to be incorrect.
 * Community members can vote on open disputes; admins make the final call.
 *
 * Tables:
 *   disputes       (see migrations/003_disputes.sql)
 *   dispute_votes
 *
 * Auth:
 *   Public reads — no auth required.
 *   Submissions / votes — x-user-id header (wallet address).
 *   Admin decisions    — ADMIN_API_KEY (handled in admin.ts).
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireUserId, isEvmAddress } from '../lib/auth';

const router = Router();

// ── Validation ────────────────────────────────────────────────────────────────

const submitSchema = z.object({
  category: z.enum(['false_flag', 'stale_data', 'wrong_score', 'other']),
  description: z.string().min(30, 'Please provide at least 30 characters').max(2000),
  evidenceUrls: z.array(z.string().url()).max(5).default([]),
});

// ── GET /api/v1/disputes/project/:projectId ───────────────────────────────────
// List all disputes for a project, newest first. Public endpoint.

router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { rows } = await db.query<{
      id: number;
      project_id: string;
      submitter: string;
      category: string;
      description: string;
      evidence_urls: string[];
      status: string;
      votes_for: number;
      votes_against: number;
      admin_notes: string | null;
      created_at: string;
      resolved_at: string | null;
    }>(
      `SELECT id, project_id, submitter, category, description,
              evidence_urls, status, votes_for, votes_against,
              admin_notes, created_at, resolved_at
       FROM disputes
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [projectId],
    );

    res.json({ success: true, data: { disputes: rows } });
  } catch (err) {
    console.error('[disputes] GET /project/:projectId', err);
    res.status(500).json({ success: false, error: 'Failed to fetch disputes.' });
  }
});

// ── POST /api/v1/disputes/project/:projectId ──────────────────────────────────
// Submit a new dispute. Requires wallet auth.
// Rate-limited: max 1 open dispute per (project, submitter) at a time.

router.post('/project/:projectId', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  // Normalise wallet address
  const submitter = userId.toLowerCase();
  if (!isEvmAddress(submitter) && !submitter.startsWith('0x')) {
    return res.status(400).json({ success: false, error: 'Invalid wallet address.' });
  }

  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      error: 'Validation failed.',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { projectId } = req.params;
  const { category, description, evidenceUrls } = parsed.data;

  try {
    // Check for an existing open dispute by this submitter for this project
    const { rows: existing } = await db.query(
      `SELECT id FROM disputes
       WHERE project_id = $1 AND submitter = $2
         AND status IN ('pending','under_review')
       LIMIT 1`,
      [projectId, submitter],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'You already have an open dispute for this project.',
        existingId: existing[0].id,
      });
    }

    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO disputes
         (project_id, submitter, category, description, evidence_urls)
       VALUES ($1, $2, $3, $4, $5::text[])
       RETURNING id`,
      [
        projectId,
        submitter,
        category,
        description,
        `{${evidenceUrls.map(u => `"${u.replace(/"/g, '\\"')}"`).join(',')}}`,
      ],
    );

    res.status(201).json({
      success: true,
      message: 'Dispute submitted. Our team will review it shortly.',
      data: { id: rows[0].id },
    });
  } catch (err) {
    console.error('[disputes] POST /project/:projectId', err);
    res.status(500).json({ success: false, error: 'Failed to submit dispute.' });
  }
});

// ── POST /api/v1/disputes/:id/vote ────────────────────────────────────────────
// Cast or update a community vote on an open dispute. Requires wallet auth.
// support=true  → voter believes the project is incorrectly flagged
// support=false → voter believes the flag is correct

router.post('/:id/vote', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const voter = userId.toLowerCase();
  const disputeId = parseInt(req.params.id, 10);
  if (isNaN(disputeId)) {
    return res.status(400).json({ success: false, error: 'Invalid dispute ID.' });
  }

  const support = req.body?.support;
  if (typeof support !== 'boolean') {
    return res.status(400).json({ success: false, error: "'support' must be a boolean." });
  }

  try {
    // Verify dispute exists and is still open
    const { rows: dispute } = await db.query<{ status: string; submitter: string }>(
      `SELECT status, submitter FROM disputes WHERE id = $1`,
      [disputeId],
    );

    if (dispute.length === 0) {
      return res.status(404).json({ success: false, error: 'Dispute not found.' });
    }

    if (!['pending', 'under_review'].includes(dispute[0].status)) {
      return res.status(409).json({
        success: false,
        error: 'This dispute is no longer open for voting.',
      });
    }

    if (dispute[0].submitter === voter) {
      return res.status(409).json({
        success: false,
        error: 'You cannot vote on your own dispute.',
      });
    }

    // Check if the voter already voted
    const { rows: prevVote } = await db.query<{ support: boolean }>(
      `SELECT support FROM dispute_votes WHERE dispute_id = $1 AND voter = $2`,
      [disputeId, voter],
    );

    const prevSupport = prevVote.length > 0 ? prevVote[0].support : null;

    if (prevSupport === support) {
      // Idempotent — same vote already cast; return current counts
      const { rows: counts } = await db.query<{ votes_for: number; votes_against: number }>(
        `SELECT votes_for, votes_against FROM disputes WHERE id = $1`,
        [disputeId],
      );
      return res.json({
        success: true,
        message: 'Vote unchanged.',
        data: counts[0],
      });
    }

    // Upsert vote + update aggregate counters atomically
    await db.query('BEGIN');

    await db.query(
      `INSERT INTO dispute_votes (dispute_id, voter, support)
       VALUES ($1, $2, $3)
       ON CONFLICT (dispute_id, voter) DO UPDATE SET support = $3, voted_at = NOW()`,
      [disputeId, voter, support],
    );

    // Recalculate counters from the votes table (source of truth)
    await db.query(
      `UPDATE disputes SET
         votes_for     = (SELECT COUNT(*) FROM dispute_votes WHERE dispute_id = $1 AND support = TRUE),
         votes_against = (SELECT COUNT(*) FROM dispute_votes WHERE dispute_id = $1 AND support = FALSE),
         updated_at    = NOW()
       WHERE id = $1`,
      [disputeId],
    );

    await db.query('COMMIT');

    const { rows: updated } = await db.query<{ votes_for: number; votes_against: number }>(
      `SELECT votes_for, votes_against FROM disputes WHERE id = $1`,
      [disputeId],
    );

    res.json({
      success: true,
      message: 'Vote recorded.',
      data: updated[0],
    });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('[disputes] POST /:id/vote', err);
    res.status(500).json({ success: false, error: 'Failed to record vote.' });
  }
});

// ── DELETE /api/v1/disputes/:id ───────────────────────────────────────────────
// Withdraw a pending dispute (only by the original submitter, only when pending).

router.delete('/:id', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const submitter = userId.toLowerCase();
  const disputeId = parseInt(req.params.id, 10);
  if (isNaN(disputeId)) {
    return res.status(400).json({ success: false, error: 'Invalid dispute ID.' });
  }

  try {
    const { rowCount } = await db.query(
      `UPDATE disputes
       SET status = 'withdrawn', updated_at = NOW()
       WHERE id = $1 AND submitter = $2 AND status = 'pending'`,
      [disputeId, submitter],
    );

    if (rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dispute not found, not yours, or already being reviewed.',
      });
    }

    res.json({ success: true, message: 'Dispute withdrawn.' });
  } catch (err) {
    console.error('[disputes] DELETE /:id', err);
    res.status(500).json({ success: false, error: 'Failed to withdraw dispute.' });
  }
});

export default router;
