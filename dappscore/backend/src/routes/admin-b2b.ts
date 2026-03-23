/**
 * Admin B2B Routes — /api/v1/admin/b2b
 *
 * Full control over B2B accounts and community scam report moderation.
 * Requires: Authorization: Bearer <ADMIN_API_KEY>
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../lib/db';
import { logger } from '../services/logger';

const router = Router();

// ── Auth guard (re-uses the same pattern as existing admin routes) ─────────────
function requireAdmin(req: Request, res: Response, next: Function): void {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = process.env.ADMIN_API_KEY ?? '';

  // Constant-time compare
  if (!token || !expected || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  next();
}

router.use(requireAdmin);

// ────────────────────────────────────────────────────────────────────────────
// B2B ACCOUNT MANAGEMENT
// ────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/b2b/accounts
router.get('/accounts', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const limit  = Math.min(200, parseInt(req.query.limit as string, 10) || 50);
  const offset = parseInt(req.query.offset as string, 10) || 0;

  const params: (string | number)[] = [];
  let where = '';
  if (status) { params.push(status); where = `WHERE status = $1`; }
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT id, company_name, contact_name, email, website, tier, status,
            pricing_model, price_per_query_usd, flat_rate_monthly_usd,
            monthly_query_limit, queries_this_month, billing_cycle_start,
            api_key_prefix, admin_notes, created_at, updated_at
     FROM b2b_accounts
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const { rows: totals } = await db.query(
    `SELECT status, COUNT(*)::int AS count FROM b2b_accounts GROUP BY status`,
  );

  return res.json({ success: true, data: { accounts: rows, totals } });
});

// GET /api/v1/admin/b2b/accounts/:id
router.get('/accounts/:id', async (req: Request, res: Response) => {
  const { rows } = await db.query(
    `SELECT * FROM b2b_accounts WHERE id = $1`,
    [req.params.id],
  );
  if (!rows.length) return res.status(404).json({ success: false, error: 'Account not found' });

  // Usage history (last 30 days)
  const { rows: usage } = await db.query(
    `SELECT DATE(created_at) AS day, COUNT(*)::int AS queries, query_type
     FROM b2b_query_logs
     WHERE account_id = $1 AND created_at > NOW() - INTERVAL '30 days'
     GROUP BY day, query_type
     ORDER BY day DESC`,
    [req.params.id],
  );

  return res.json({ success: true, data: { account: rows[0], usageHistory: usage } });
});

// POST /api/v1/admin/b2b/accounts — create + activate an account (admin-issued key)
router.post('/accounts', async (req: Request, res: Response) => {
  const {
    company_name, contact_name, email, website, use_case,
    tier = 'starter', pricing_model = 'per_query',
    price_per_query_usd = 0.005, flat_rate_monthly_usd,
    monthly_query_limit, admin_notes,
  } = req.body;

  if (!company_name || !email) {
    return res.status(400).json({ success: false, error: 'company_name and email are required' });
  }

  // Generate live key
  const rawKey   = `b2b_live_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash  = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 16);

  const tierDefaults: Record<string, number> = { starter: 1_000, professional: 50_000, enterprise: 1_000_000 };
  const limit = monthly_query_limit ?? tierDefaults[tier] ?? 1_000;

  try {
    const { rows } = await db.query(
      `INSERT INTO b2b_accounts
         (company_name, contact_name, email, website, use_case, tier, status,
          api_key_hash, api_key_prefix, pricing_model, price_per_query_usd,
          flat_rate_monthly_usd, monthly_query_limit, admin_notes)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, company_name, tier, status, api_key_prefix`,
      [
        company_name, contact_name || null, email.toLowerCase(), website || null,
        use_case || null, tier, keyHash, keyPrefix, pricing_model,
        price_per_query_usd, flat_rate_monthly_usd || null, limit, admin_notes || null,
      ],
    );

    logger.info(`[AdminB2B] Created account: ${company_name} (${email})`);

    return res.status(201).json({
      success: true,
      data: {
        ...rows[0],
        // Return the raw key ONCE — not stored in plain text
        apiKey: rawKey,
        message: 'Store this API key securely — it will not be shown again.',
      },
    });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    logger.error('[AdminB2B] create account error', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/admin/b2b/accounts/:id — update tier, status, limits, notes
router.put('/accounts/:id', async (req: Request, res: Response) => {
  const {
    tier, status, monthly_query_limit, pricing_model,
    price_per_query_usd, flat_rate_monthly_usd, admin_notes,
  } = req.body;

  const sets: string[] = ['updated_at = NOW()'];
  const params: (string | number | null)[] = [];

  function addSet(col: string, val: unknown) {
    if (val !== undefined) { params.push(val as any); sets.push(`${col} = $${params.length}`); }
  }

  addSet('tier', tier);
  addSet('status', status);
  addSet('monthly_query_limit', monthly_query_limit);
  addSet('pricing_model', pricing_model);
  addSet('price_per_query_usd', price_per_query_usd);
  addSet('flat_rate_monthly_usd', flat_rate_monthly_usd);
  addSet('admin_notes', admin_notes);

  if (sets.length === 1) {
    return res.status(400).json({ success: false, error: 'No fields to update' });
  }

  params.push(req.params.id);
  const { rows } = await db.query(
    `UPDATE b2b_accounts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );

  if (!rows.length) return res.status(404).json({ success: false, error: 'Account not found' });
  logger.info(`[AdminB2B] Updated account ${req.params.id}`);
  return res.json({ success: true, data: rows[0] });
});

// POST /api/v1/admin/b2b/accounts/:id/rotate-key — issue a new API key
router.post('/accounts/:id/rotate-key', async (req: Request, res: Response) => {
  const rawKey   = `b2b_live_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash  = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 16);

  const { rows } = await db.query(
    `UPDATE b2b_accounts SET api_key_hash = $1, api_key_prefix = $2, updated_at = NOW()
     WHERE id = $3 RETURNING id, company_name`,
    [keyHash, keyPrefix, req.params.id],
  );

  if (!rows.length) return res.status(404).json({ success: false, error: 'Account not found' });
  logger.info(`[AdminB2B] Rotated key for account ${req.params.id}`);

  return res.json({
    success: true,
    data: { ...rows[0], apiKey: rawKey, message: 'Store this API key securely — not shown again.' },
  });
});

// DELETE /api/v1/admin/b2b/accounts/:id — cancel/delete
router.delete('/accounts/:id', async (req: Request, res: Response) => {
  const { hard = false } = req.query;

  if (hard === 'true') {
    await db.query(`DELETE FROM b2b_accounts WHERE id = $1`, [req.params.id]);
    return res.json({ success: true, data: { deleted: true } });
  }

  const { rows } = await db.query(
    `UPDATE b2b_accounts SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING id`,
    [req.params.id],
  );
  if (!rows.length) return res.status(404).json({ success: false, error: 'Account not found' });
  return res.json({ success: true, data: { cancelled: true } });
});

// ── Activate a pending application ───────────────────────────────────────────
// POST /api/v1/admin/b2b/accounts/:id/activate
router.post('/accounts/:id/activate', async (req: Request, res: Response) => {
  const rawKey   = `b2b_live_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash  = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 16);

  const { rows } = await db.query(
    `UPDATE b2b_accounts
     SET status = 'active', api_key_hash = $1, api_key_prefix = $2, updated_at = NOW()
     WHERE id = $3 AND status = 'pending'
     RETURNING id, company_name, email, tier`,
    [keyHash, keyPrefix, req.params.id],
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, error: 'Account not found or not in pending status' });
  }

  logger.info(`[AdminB2B] Activated account ${req.params.id} (${rows[0].company_name})`);

  return res.json({
    success: true,
    data: { ...rows[0], apiKey: rawKey, message: 'Account activated. Send apiKey to the client.' },
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SCAM REPORT MODERATION
// ────────────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/b2b/scam-reports
router.get('/scam-reports', async (req: Request, res: Response) => {
  const status = (req.query.status as string) || 'pending';
  const chain  = req.query.chain as string | undefined;
  const limit  = Math.min(200, parseInt(req.query.limit as string, 10) || 50);
  const offset = parseInt(req.query.offset as string, 10) || 0;

  const params: (string | number)[] = [status];
  let where = 'WHERE status = $1';
  if (chain) { params.push(chain); where += ` AND chain = $${params.length}`; }
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT id, address, chain, report_type, category, title, description,
            evidence, reporter_address, reporter_email, severity,
            votes_confirm, votes_dismiss, admin_notes, created_at
     FROM community_scam_reports
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const { rows: counts } = await db.query(
    `SELECT status, COUNT(*)::int AS count FROM community_scam_reports GROUP BY status`,
  );

  return res.json({ success: true, data: { reports: rows, statusCounts: counts } });
});

// PUT /api/v1/admin/b2b/scam-reports/:id — moderate a report
router.put('/scam-reports/:id', async (req: Request, res: Response) => {
  const { status, severity, admin_notes, reviewed_by } = req.body;

  const valid = ['pending', 'investigating', 'confirmed', 'dismissed', 'spam'];
  if (status && !valid.includes(status)) {
    return res.status(400).json({ success: false, error: `status must be one of: ${valid.join(', ')}` });
  }

  const sets: string[] = ['updated_at = NOW()'];
  const params: (string | null)[] = [];

  function addSet(col: string, val: unknown) {
    if (val !== undefined) { params.push(val as any); sets.push(`${col} = $${params.length}`); }
  }

  addSet('status', status);
  addSet('severity', severity);
  addSet('admin_notes', admin_notes);
  addSet('reviewed_by', reviewed_by);

  if (['confirmed', 'dismissed'].includes(status)) {
    sets.push('resolved_at = NOW()');
  }

  params.push(req.params.id);
  const { rows } = await db.query(
    `UPDATE community_scam_reports SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );

  if (!rows.length) return res.status(404).json({ success: false, error: 'Report not found' });
  logger.info(`[AdminB2B] Report ${req.params.id} → ${status}`);
  return res.json({ success: true, data: rows[0] });
});

// DELETE /api/v1/admin/b2b/scam-reports/:id
router.delete('/scam-reports/:id', async (req: Request, res: Response) => {
  await db.query(`DELETE FROM community_scam_reports WHERE id = $1`, [req.params.id]);
  return res.json({ success: true, data: { deleted: true } });
});

// ── Usage analytics overview ─────────────────────────────────────────────────
// GET /api/v1/admin/b2b/analytics
router.get('/analytics', async (req: Request, res: Response) => {
  const [accounts, queryStats, topClients, reportStats] = await Promise.all([
    db.query(`SELECT tier, status, COUNT(*)::int AS count FROM b2b_accounts GROUP BY tier, status`),
    db.query(
      `SELECT DATE(created_at) AS day, COUNT(*)::int AS queries
       FROM b2b_query_logs WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY day ORDER BY day DESC`,
    ),
    db.query(
      `SELECT a.id, a.company_name, a.tier, COUNT(l.id)::int AS total_queries
       FROM b2b_accounts a
       LEFT JOIN b2b_query_logs l ON l.account_id = a.id
         AND l.created_at > NOW() - INTERVAL '30 days'
       GROUP BY a.id, a.company_name, a.tier
       ORDER BY total_queries DESC LIMIT 10`,
    ),
    db.query(`SELECT status, COUNT(*)::int AS count FROM community_scam_reports GROUP BY status`),
  ]);

  return res.json({
    success: true,
    data: {
      accountsByTierStatus: accounts.rows,
      dailyQueries:         queryStats.rows,
      topClients:           topClients.rows,
      reportsByStatus:      reportStats.rows,
    },
  });
});

export default router;
