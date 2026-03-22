/**
 * Admin API — protected by ADMIN_API_KEY.
 *
 * Feature flags, project overrides, cache invalidation, system health.
 *
 * Tables:
 *   feature_flags     (replaces Firestore feature_flags/{flagId})
 *   project_overrides (replaces Firestore project_overrides/{projectId})
 *   admin_audit_log   (replaces Firestore admin_audit_log/{logId})
 *   project_sales     (replaces Firestore project_sales/{projectId})
 *   scam_reports      (replaces Firestore scam_reports/{id})
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { cacheDel, cacheDelPattern, redisPing } from '../lib/cache';
import { requireAdmin } from '../lib/auth';

const router = Router();

router.use(requireAdmin);

// ── Audit helper ──────────────────────────────────────────────────────────────

async function audit(action: string, payload: Record<string, unknown>): Promise<void> {
  await db.query(
    `INSERT INTO admin_audit_log (action, payload, timestamp)
     VALUES ($1, $2::jsonb, NOW())`,
    [action, JSON.stringify(payload)],
  );
}

// ── Feature Flags ─────────────────────────────────────────────────────────────

const flagSchema = z.object({
  enabled:     z.boolean(),
  description: z.string().max(500).optional(),
  rollout:     z.number().min(0).max(100).optional(),
  allowlist:   z.array(z.string()).optional(),
  metadata:    z.record(z.unknown()).optional(),
});

/** GET /api/v1/admin/flags */
router.get('/flags', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM feature_flags ORDER BY updated_at DESC',
    );
    res.json({ success: true, data: { flags: rows } });
  } catch (err) {
    console.error('[admin] GET /flags', err);
    res.status(500).json({ success: false, error: 'Failed to fetch flags.' });
  }
});

/** PUT /api/v1/admin/flags/:id */
router.put('/flags/:id', async (req, res) => {
  const parsed = flagSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, error: 'Invalid fields.', details: parsed.error.flatten() });
  }

  const d = parsed.data;
  try {
    await db.query(
      `INSERT INTO feature_flags (id, enabled, description, rollout, allowlist, metadata, updated_at)
       VALUES ($1,$2,$3,$4,$5::text[],$6::jsonb,NOW())
       ON CONFLICT (id) DO UPDATE SET
         enabled     = $2,
         description = COALESCE($3, feature_flags.description),
         rollout     = COALESCE($4, feature_flags.rollout),
         allowlist   = COALESCE($5::text[], feature_flags.allowlist),
         metadata    = COALESCE($6::jsonb, feature_flags.metadata),
         updated_at  = NOW()`,
      [
        req.params.id, d.enabled,
        d.description ?? null,
        d.rollout ?? null,
        d.allowlist ? `{${d.allowlist.join(',')}}` : null,
        d.metadata ? JSON.stringify(d.metadata) : null,
      ],
    );
    await audit('flag.updated', { flagId: req.params.id, ...d });
    res.json({ success: true, message: `Flag '${req.params.id}' updated.` });
  } catch (err) {
    console.error('[admin] PUT /flags/:id', err);
    res.status(500).json({ success: false, error: 'Failed to update flag.' });
  }
});

/** DELETE /api/v1/admin/flags/:id */
router.delete('/flags/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM feature_flags WHERE id = $1', [req.params.id]);
    await audit('flag.deleted', { flagId: req.params.id });
    res.json({ success: true, message: 'Flag deleted.' });
  } catch (err) {
    console.error('[admin] DELETE /flags/:id', err);
    res.status(500).json({ success: false, error: 'Failed to delete flag.' });
  }
});

// ── Project Overrides ─────────────────────────────────────────────────────────

const overrideSchema = z.object({
  trustLevel:    z.number().int().min(0).max(5).optional(),
  verified:      z.boolean().optional(),
  scamFlag:      z.boolean().optional(),
  scamReason:    z.string().max(500).optional(),
  featured:      z.boolean().optional(),
  bannerMessage: z.string().max(300).optional(),
  riskFlags:     z.array(z.string()).optional(),
  notes:         z.string().max(1000).optional(),
});

/** GET /api/v1/admin/overrides */
router.get('/overrides', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM project_overrides ORDER BY updated_at DESC',
    );
    res.json({ success: true, data: { overrides: rows } });
  } catch (err) {
    console.error('[admin] GET /overrides', err);
    res.status(500).json({ success: false, error: 'Failed to fetch overrides.' });
  }
});

/** PUT /api/v1/admin/overrides/:projectId */
router.put('/overrides/:projectId', async (req, res) => {
  const parsed = overrideSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, error: 'Invalid fields.', details: parsed.error.flatten() });
  }

  const d = parsed.data;
  try {
    await db.query(
      `INSERT INTO project_overrides
         (project_id, trust_level, verified, scam_flag, scam_reason,
          featured, banner_message, risk_flags, notes, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9,NOW())
       ON CONFLICT (project_id) DO UPDATE SET
         trust_level    = COALESCE($2, project_overrides.trust_level),
         verified       = COALESCE($3, project_overrides.verified),
         scam_flag      = COALESCE($4, project_overrides.scam_flag),
         scam_reason    = COALESCE($5, project_overrides.scam_reason),
         featured       = COALESCE($6, project_overrides.featured),
         banner_message = COALESCE($7, project_overrides.banner_message),
         risk_flags     = COALESCE($8::text[], project_overrides.risk_flags),
         notes          = COALESCE($9, project_overrides.notes),
         updated_at     = NOW()`,
      [
        req.params.projectId,
        d.trustLevel ?? null, d.verified ?? null,
        d.scamFlag ?? null, d.scamReason ?? null,
        d.featured ?? null, d.bannerMessage ?? null,
        d.riskFlags ? `{${d.riskFlags.join(',')}}` : null,
        d.notes ?? null,
      ],
    );
    await audit('override.updated', { projectId: req.params.projectId, ...d });
    res.json({ success: true, message: 'Override saved.' });
  } catch (err) {
    console.error('[admin] PUT /overrides/:id', err);
    res.status(500).json({ success: false, error: 'Failed to save override.' });
  }
});

/** DELETE /api/v1/admin/overrides/:projectId */
router.delete('/overrides/:projectId', async (req, res) => {
  try {
    await db.query('DELETE FROM project_overrides WHERE project_id = $1', [req.params.projectId]);
    await audit('override.deleted', { projectId: req.params.projectId });
    res.json({ success: true, message: 'Override removed.' });
  } catch (err) {
    console.error('[admin] DELETE /overrides/:id', err);
    res.status(500).json({ success: false, error: 'Failed to remove override.' });
  }
});

// ── Sale Management ───────────────────────────────────────────────────────────

/** GET /api/v1/admin/sales */
router.get('/sales', async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM project_sales ORDER BY updated_at DESC',
    );
    res.json({ success: true, data: { sales: rows } });
  } catch (err) {
    console.error('[admin] GET /sales', err);
    res.status(500).json({ success: false, error: 'Failed to fetch sales.' });
  }
});

/** DELETE /api/v1/admin/sales/:projectId */
router.delete('/sales/:projectId', async (req, res) => {
  try {
    await db.query('DELETE FROM project_sales WHERE project_id = $1', [req.params.projectId]);
    await audit('sale.deleted', { projectId: req.params.projectId });
    res.json({ success: true, message: 'Sale data removed.' });
  } catch (err) {
    console.error('[admin] DELETE /sales/:id', err);
    res.status(500).json({ success: false, error: 'Failed to delete sale.' });
  }
});

// ── Cache Management ──────────────────────────────────────────────────────────

/** DELETE /api/v1/admin/cache/:key */
router.delete('/cache/:key', async (req, res) => {
  try {
    await cacheDel(req.params.key);
    await audit('cache.invalidated', { key: req.params.key });
    res.json({ success: true, message: `Cache '${req.params.key}' invalidated.` });
  } catch (err) {
    console.error('[admin] DELETE /cache/:key', err);
    res.status(500).json({ success: false, error: 'Failed to invalidate cache.' });
  }
});

/** DELETE /api/v1/admin/cache — wipe entire stats cache */
router.delete('/cache', async (_req, res) => {
  try {
    await cacheDelPattern('*');
    await audit('cache.purged', {});
    res.json({ success: true, message: 'Stats cache purged.' });
  } catch (err) {
    console.error('[admin] DELETE /cache', err);
    res.status(500).json({ success: false, error: 'Failed to purge cache.' });
  }
});

// ── Scam Reports Management ───────────────────────────────────────────────────

/** GET /api/v1/admin/reports?status=pending */
router.get('/reports', async (req, res) => {
  try {
    const { status } = req.query;
    const params: unknown[] = [];
    let where = '';

    if (typeof status === 'string') {
      params.push(status);
      where = `WHERE status = $1`;
    }

    const { rows } = await db.query(
      `SELECT * FROM scam_reports ${where} ORDER BY created_at DESC LIMIT 100`,
      params,
    );
    res.json({ success: true, data: { reports: rows } });
  } catch (err) {
    console.error('[admin] GET /reports', err);
    res.status(500).json({ success: false, error: 'Failed to fetch reports.' });
  }
});

/** PUT /api/v1/admin/reports/:id */
router.put('/reports/:id', async (req, res) => {
  const { status, resolution } = req.body ?? {};
  if (!['pending', 'investigating', 'confirmed', 'dismissed'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status.' });
  }

  try {
    const { rowCount } = await db.query(
      `UPDATE scam_reports
       SET status = $1, resolution = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, resolution ?? null, req.params.id],
    );

    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Report not found.' });
    }

    await audit('report.updated', { reportId: req.params.id, status });
    res.json({ success: true, message: 'Report updated.' });
  } catch (err) {
    console.error('[admin] PUT /reports/:id', err);
    res.status(500).json({ success: false, error: 'Failed to update report.' });
  }
});

// ── Disputes Management ───────────────────────────────────────────────────────

/** GET /api/v1/admin/disputes?status=pending&limit=50 */
router.get('/disputes', async (req, res) => {
  try {
    const { status } = req.query;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const params: unknown[] = [limit];
    let where = '';
    if (typeof status === 'string') {
      params.push(status);
      where = `WHERE status = $2`;
    }
    const { rows } = await db.query(
      `SELECT id, project_id, submitter, category, description,
              evidence_urls, status, votes_for, votes_against,
              admin_notes, resolved_by, created_at, updated_at, resolved_at
       FROM disputes ${where}
       ORDER BY created_at DESC
       LIMIT $1`,
      params,
    );
    res.json({ success: true, data: { disputes: rows } });
  } catch (err) {
    console.error('[admin] GET /disputes', err);
    res.status(500).json({ success: false, error: 'Failed to fetch disputes.' });
  }
});

const disputeDecisionSchema = z.object({
  status:        z.enum(['under_review', 'upheld', 'rejected']),
  adminNotes:    z.string().max(1000).optional(),
  /** When true and status='upheld', automatically clear scam_flag in project_overrides. */
  clearScamFlag: z.boolean().optional(),
});

/** PUT /api/v1/admin/disputes/:id */
router.put('/disputes/:id', async (req, res) => {
  const parsed = disputeDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      error:   'Invalid fields.',
      details: parsed.error.flatten(),
    });
  }

  const { status, adminNotes, clearScamFlag } = parsed.data;
  const disputeId = parseInt(req.params.id, 10);
  if (isNaN(disputeId)) {
    return res.status(400).json({ success: false, error: 'Invalid dispute ID.' });
  }

  try {
    const { rows: dispute, rowCount } = await db.query<{ project_id: string; status: string }>(
      `UPDATE disputes
       SET status       = $1,
           admin_notes  = COALESCE($2, admin_notes),
           resolved_by  = $3,
           resolved_at  = CASE WHEN $1 IN ('upheld','rejected') THEN NOW() ELSE resolved_at END,
           updated_at   = NOW()
       WHERE id = $4
       RETURNING project_id, status`,
      [status, adminNotes ?? null, 'admin', disputeId],
    );

    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Dispute not found.' });
    }

    const projectId = dispute[0].project_id;

    if (status === 'upheld' && clearScamFlag) {
      await db.query(
        `INSERT INTO project_overrides (project_id, scam_flag, scam_reason, updated_at)
         VALUES ($1, FALSE, NULL, NOW())
         ON CONFLICT (project_id) DO UPDATE SET
           scam_flag   = FALSE,
           scam_reason = NULL,
           updated_at  = NOW()`,
        [projectId],
      );
      await audit('override.scam_flag_cleared_by_dispute', { projectId, disputeId });
    }

    await audit('dispute.decision', { disputeId, projectId, status, adminNotes, clearScamFlag });
    res.json({ success: true, message: `Dispute ${status}.` });
  } catch (err) {
    console.error('[admin] PUT /disputes/:id', err);
    res.status(500).json({ success: false, error: 'Failed to update dispute.' });
  }
});

// ── Audit Log ─────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/audit?limit=50 */
router.get('/audit', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const { rows } = await db.query(
      'SELECT * FROM admin_audit_log ORDER BY timestamp DESC LIMIT $1',
      [limit],
    );
    res.json({ success: true, data: { entries: rows } });
  } catch (err) {
    console.error('[admin] GET /audit', err);
    res.status(500).json({ success: false, error: 'Failed to fetch audit log.' });
  }
});

// ── System Health ─────────────────────────────────────────────────────────────

/** GET /api/v1/admin/health */
router.get('/health', async (_req, res) => {
  try {
    // Probe PostgreSQL
    const t0 = Date.now();
    await db.query('SELECT 1');
    const pgMs = Date.now() - t0;

    // Probe Redis
    const redisStatus = await redisPing();

    // Probe subgraph
    let subgraphStatus = 'not_configured';
    const subgraphUrl  = process.env.SUBGRAPH_URL;
    if (subgraphUrl) {
      try {
        const r = await fetch(subgraphUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ query: '{ _meta { block { number } } }' }),
          signal:  AbortSignal.timeout(5_000),
        });
        subgraphStatus = r.ok ? 'ok' : `http_${r.status}`;
      } catch {
        subgraphStatus = 'unreachable';
      }
    }

    res.json({
      success: true,
      data: {
        status:   'ok',
        postgres: { status: 'ok', latencyMs: pgMs },
        redis:    { status: redisStatus },
        subgraph: { status: subgraphStatus },
        env: {
          hasAlchemyKey:   !!process.env.ALCHEMY_API_KEY,
          hasAdminKey:     !!process.env.ADMIN_API_KEY,
          hasSubgraphUrl:  !!process.env.SUBGRAPH_URL,
          hasDatabaseUrl:  !!process.env.DATABASE_URL,
          hasRedisUrl:     !!process.env.REDIS_URL,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[admin] health', err);
    res.status(500).json({ success: false, error: 'Health check failed.' });
  }
});

export default router;
