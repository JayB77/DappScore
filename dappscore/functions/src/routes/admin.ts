/**
 * Admin API — protected by ADMIN_API_KEY.
 *
 * Feature flags, project overrides, cache invalidation, system health.
 *
 * Collections:
 *   feature_flags/{flagId}
 *   project_overrides/{projectId}
 *   admin_audit_log/{logId}
 */

import { Router } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireAdmin } from '../lib/auth';

const router = Router();

// All admin routes require the API key
router.use(requireAdmin);

// ── Audit helper ──────────────────────────────────────────────────────────────

async function audit(action: string, payload: Record<string, unknown>): Promise<void> {
  await getFirestore().collection('admin_audit_log').add({
    action,
    payload,
    timestamp: Timestamp.now(),
  });
}

// ── Feature Flags ─────────────────────────────────────────────────────────────

const flagSchema = z.object({
  enabled:     z.boolean(),
  description: z.string().max(500).optional(),
  rollout:     z.number().min(0).max(100).optional(), // % of users to enable for
  allowlist:   z.array(z.string()).optional(),         // specific user IDs
  metadata:    z.record(z.unknown()).optional(),
});

/** GET /api/v1/admin/flags */
router.get('/flags', async (_req, res) => {
  try {
    const snap = await getFirestore().collection('feature_flags').orderBy('updatedAt', 'desc').get();
    const flags = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: { flags } });
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

  try {
    const ref = getFirestore().collection('feature_flags').doc(req.params.id);
    await ref.set({ ...parsed.data, updatedAt: Timestamp.now() }, { merge: true });
    await audit('flag.updated', { flagId: req.params.id, ...parsed.data });
    res.json({ success: true, message: `Flag '${req.params.id}' updated.` });
  } catch (err) {
    console.error('[admin] PUT /flags/:id', err);
    res.status(500).json({ success: false, error: 'Failed to update flag.' });
  }
});

/** DELETE /api/v1/admin/flags/:id */
router.delete('/flags/:id', async (req, res) => {
  try {
    await getFirestore().collection('feature_flags').doc(req.params.id).delete();
    await audit('flag.deleted', { flagId: req.params.id });
    res.json({ success: true, message: 'Flag deleted.' });
  } catch (err) {
    console.error('[admin] DELETE /flags/:id', err);
    res.status(500).json({ success: false, error: 'Failed to delete flag.' });
  }
});

// ── Project Overrides ─────────────────────────────────────────────────────────
// Overrides let admins manually pin trust scores, add/remove risk flags,
// or mark a project as verified/scam without waiting for subgraph indexing.

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
    const snap = await getFirestore().collection('project_overrides').orderBy('updatedAt', 'desc').get();
    res.json({ success: true, data: { overrides: snap.docs.map(d => ({ id: d.id, ...d.data() })) } });
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

  try {
    const ref = getFirestore().collection('project_overrides').doc(req.params.projectId);
    await ref.set({ ...parsed.data, updatedAt: Timestamp.now() }, { merge: true });
    await audit('override.updated', { projectId: req.params.projectId, ...parsed.data });
    res.json({ success: true, message: 'Override saved.' });
  } catch (err) {
    console.error('[admin] PUT /overrides/:id', err);
    res.status(500).json({ success: false, error: 'Failed to save override.' });
  }
});

/** DELETE /api/v1/admin/overrides/:projectId */
router.delete('/overrides/:projectId', async (req, res) => {
  try {
    await getFirestore().collection('project_overrides').doc(req.params.projectId).delete();
    await audit('override.deleted', { projectId: req.params.projectId });
    res.json({ success: true, message: 'Override removed.' });
  } catch (err) {
    console.error('[admin] DELETE /overrides/:id', err);
    res.status(500).json({ success: false, error: 'Failed to remove override.' });
  }
});

// ── Sale Management ───────────────────────────────────────────────────────────

/** GET /api/v1/admin/sales — list all project sales */
router.get('/sales', async (_req, res) => {
  try {
    const snap = await getFirestore().collection('project_sales').orderBy('updatedAt', 'desc').get();
    res.json({ success: true, data: { sales: snap.docs.map(d => ({ id: d.id, ...d.data() })) } });
  } catch (err) {
    console.error('[admin] GET /sales', err);
    res.status(500).json({ success: false, error: 'Failed to fetch sales.' });
  }
});

/** DELETE /api/v1/admin/sales/:projectId */
router.delete('/sales/:projectId', async (req, res) => {
  try {
    await getFirestore().collection('project_sales').doc(req.params.projectId).delete();
    await audit('sale.deleted', { projectId: req.params.projectId });
    res.json({ success: true, message: 'Sale data removed.' });
  } catch (err) {
    console.error('[admin] DELETE /sales/:id', err);
    res.status(500).json({ success: false, error: 'Failed to delete sale.' });
  }
});

// ── Cache Management ──────────────────────────────────────────────────────────

/** DELETE /api/v1/admin/cache/:key — invalidate a specific stats cache key */
router.delete('/cache/:key', async (req, res) => {
  try {
    await getFirestore().collection('stats_cache').doc(req.params.key).delete();
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
    const snap  = await getFirestore().collection('stats_cache').get();
    const batch = getFirestore().batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    await audit('cache.purged', { count: snap.size });
    res.json({ success: true, message: `Purged ${snap.size} cache entries.` });
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
    let query = getFirestore().collection('scam_reports').orderBy('createdAt', 'desc') as FirebaseFirestore.Query;
    if (status) query = query.where('status', '==', status);

    const snap = await query.limit(100).get();
    res.json({ success: true, data: { reports: snap.docs.map(d => ({ id: d.id, ...d.data() })) } });
  } catch (err) {
    console.error('[admin] GET /reports', err);
    res.status(500).json({ success: false, error: 'Failed to fetch reports.' });
  }
});

/** PUT /api/v1/admin/reports/:id — update status */
router.put('/reports/:id', async (req, res) => {
  const { status, resolution } = req.body ?? {};
  if (!['pending', 'investigating', 'confirmed', 'dismissed'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status.' });
  }

  try {
    const ref = getFirestore().collection('scam_reports').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Report not found.' });

    await ref.update({ status, resolution: resolution ?? null, updatedAt: Timestamp.now() });
    await audit('report.updated', { reportId: req.params.id, status });
    res.json({ success: true, message: 'Report updated.' });
  } catch (err) {
    console.error('[admin] PUT /reports/:id', err);
    res.status(500).json({ success: false, error: 'Failed to update report.' });
  }
});

// ── Audit Log ─────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/audit?limit=50 */
router.get('/audit', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const snap  = await getFirestore()
      .collection('admin_audit_log')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    res.json({ success: true, data: { entries: snap.docs.map(d => ({ id: d.id, ...d.data() })) } });
  } catch (err) {
    console.error('[admin] GET /audit', err);
    res.status(500).json({ success: false, error: 'Failed to fetch audit log.' });
  }
});

// ── System Health ─────────────────────────────────────────────────────────────

/** GET /api/v1/admin/health */
router.get('/health', async (_req, res) => {
  try {
    // Probe Firestore
    const t0 = Date.now();
    await getFirestore().collection('_health_probe').doc('ping').set({ ts: Timestamp.now() });
    const firestoreMs = Date.now() - t0;

    // Probe subgraph (if configured)
    let subgraphStatus = 'not_configured';
    const subgraphUrl  = process.env.SUBGRAPH_URL;
    if (subgraphUrl) {
      try {
        const r = await fetch(subgraphUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ _meta { block { number } } }' }),
          signal: AbortSignal.timeout(5_000),
        });
        subgraphStatus = r.ok ? 'ok' : `http_${r.status}`;
      } catch {
        subgraphStatus = 'unreachable';
      }
    }

    res.json({
      success: true,
      data: {
        status: 'ok',
        firestore: { status: 'ok', latencyMs: firestoreMs },
        subgraph: { status: subgraphStatus },
        env: {
          hasAlchemyKey:  !!process.env.ALCHEMY_API_KEY,
          hasAdminKey:    !!process.env.ADMIN_API_KEY,
          hasSubgraphUrl: !!process.env.SUBGRAPH_URL,
          hasSaleKeys:    !!process.env.SALE_API_KEYS,
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
