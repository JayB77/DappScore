/**
 * B2B API Routes — /api/v1/b2b
 *
 * Monetised endpoints for exchanges, wallets, and launchpads to query
 * DappScore's trust/scam intelligence.
 *
 * Authentication: B2B API key in header  x-b2b-api-key: b2b_live_<key>
 *
 * Tiers:
 *   starter      – 1,000 queries/month,  per_query  $0.005
 *   professional – 50,000/month,          flat_rate  $199/mo
 *   enterprise   – unlimited,             flat_rate  custom
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../lib/db';
import { cacheGet, cacheSet } from '../lib/cache';
import { analyzeContract } from '../services/scam-patterns';
import { logger } from '../services/logger';

const router = Router();

// ── Tier limits ────────────────────────────────────────────────────────────────
const TIER_LIMITS: Record<string, number> = {
  starter:      1_000,
  professional: 50_000,
  enterprise:   Infinity,
};

// ── Helper: hash a raw B2B API key ────────────────────────────────────────────
function hashB2BKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ── Middleware: authenticate B2B key ─────────────────────────────────────────

interface B2BAccount {
  id: string;
  company_name: string;
  tier: string;
  status: string;
  monthly_query_limit: number;
  queries_this_month: number;
  billing_cycle_start: Date;
  pricing_model: string;
  price_per_query_usd: string;
}

declare module 'express' {
  interface Request {
    b2bAccount?: B2BAccount;
  }
}

async function requireB2BKey(req: Request, res: Response, next: Function): Promise<void> {
  const raw = req.headers['x-b2b-api-key'] as string | undefined;
  if (!raw || !raw.startsWith('b2b_live_')) {
    res.status(401).json({ success: false, error: 'Missing or invalid B2B API key. Set header: x-b2b-api-key' });
    return;
  }

  const hash = hashB2BKey(raw);

  try {
    const { rows } = await db.query<B2BAccount>(
      `SELECT id, company_name, tier, status,
              monthly_query_limit, queries_this_month, billing_cycle_start,
              pricing_model, price_per_query_usd
       FROM b2b_accounts
       WHERE api_key_hash = $1`,
      [hash],
    );

    if (!rows.length) {
      res.status(401).json({ success: false, error: 'Invalid B2B API key' });
      return;
    }

    const acct = rows[0];

    if (acct.status !== 'active') {
      res.status(403).json({ success: false, error: `Account is ${acct.status}. Contact support@dappscore.io` });
      return;
    }

    // Reset monthly counter if billing cycle rolled over
    const cycleStart = new Date(acct.billing_cycle_start);
    const now = new Date();
    if (now.getMonth() !== cycleStart.getMonth() || now.getFullYear() !== cycleStart.getFullYear()) {
      await db.query(
        `UPDATE b2b_accounts SET queries_this_month = 0, billing_cycle_start = DATE_TRUNC('month', NOW()) WHERE id = $1`,
        [acct.id],
      );
      acct.queries_this_month = 0;
    }

    // Quota check (enterprise = Infinity)
    const limit = TIER_LIMITS[acct.tier] ?? acct.monthly_query_limit;
    if (acct.queries_this_month >= limit) {
      res.status(429).json({
        success: false,
        error: 'Monthly query quota exceeded. Upgrade your plan or wait for next billing cycle.',
        quota: { used: acct.queries_this_month, limit },
      });
      return;
    }

    req.b2bAccount = acct;
    next();
  } catch (err) {
    logger.error('[B2B] Auth error', err as Error);
    res.status(500).json({ success: false, error: 'Authentication error' });
  }
}

// ── Helper: log query + increment counter ────────────────────────────────────
async function logQuery(
  accountId: string,
  queryType: string,
  address: string,
  chain: string,
  riskScore: number | null,
  cached: boolean,
  ip: string,
): Promise<void> {
  await db.query(
    `INSERT INTO b2b_query_logs (account_id, query_type, address, chain, risk_score, response_cached, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [accountId, queryType, address.toLowerCase(), chain, riskScore, cached, ip],
  );
  await db.query(
    `UPDATE b2b_accounts SET queries_this_month = queries_this_month + 1, updated_at = NOW() WHERE id = $1`,
    [accountId],
  );
}

// ── GET /api/v1/b2b/account ──────────────────────────────────────────────────
// Returns current account info + quota usage
router.get('/account', requireB2BKey, async (req: Request, res: Response) => {
  const acct = req.b2bAccount!;
  const limit = TIER_LIMITS[acct.tier] ?? acct.monthly_query_limit;

  res.json({
    success: true,
    data: {
      company:    acct.company_name,
      tier:       acct.tier,
      quota: {
        used:       acct.queries_this_month,
        limit:      limit === Infinity ? null : limit,
        remaining:  limit === Infinity ? null : Math.max(0, limit - acct.queries_this_month),
      },
      pricing:    acct.pricing_model,
      pricePerQuery: acct.pricing_model === 'per_query' ? acct.price_per_query_usd : null,
    },
  });
});

// ── POST /api/v1/b2b/scam-check ──────────────────────────────────────────────
// Single address trust/scam check — wallet or contract
router.post('/scam-check', requireB2BKey, async (req: Request, res: Response) => {
  const { address, chain = 'ethereum', type = 'auto' } = req.body;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ success: false, error: 'address is required' });
  }

  const addr = address.toLowerCase().trim();
  const ip = req.ip ?? 'unknown';
  const cacheKey = `b2b:check:${chain}:${addr}`;

  // ── Cache hit ──
  const cached = await cacheGet<object>(cacheKey);
  if (cached) {
    await logQuery(req.b2bAccount!.id, 'contract_check', addr, chain, (cached as any).riskScore ?? null, true, ip);
    return res.json({ success: true, cached: true, data: cached });
  }

  try {
    // Run analysis
    const network = chain === 'mainnet' || chain === 'ethereum' ? 'mainnet' : 'testnet';
    const analysis = await analyzeContract(addr, network);

    // Lookup any confirmed community scam reports for this address
    const { rows: reports } = await db.query(
      `SELECT id, category, title, severity, votes_confirm, created_at
       FROM community_scam_reports
       WHERE LOWER(address) = $1 AND chain = $2 AND status = 'confirmed'
       ORDER BY created_at DESC LIMIT 5`,
      [addr, chain],
    );

    // Lookup any platform project record
    const { rows: projects } = await db.query(
      `SELECT id, name, trust_level, scam_flag, scam_reason
       FROM project_overrides
       WHERE LOWER(contract_address) = $1
       LIMIT 1`,
      [addr],
    ).catch(() => ({ rows: [] as any[] }));

    const result = {
      address: addr,
      chain,
      riskScore:     analysis.riskScore,
      riskLevel:     analysis.riskLevel,
      flags:         analysis.flags,
      confirmedScam: reports.length > 0,
      scamReports:   reports,
      platformData:  projects[0] ?? null,
      checkedAt:     new Date().toISOString(),
    };

    // Cache 10 minutes
    await cacheSet(cacheKey, result, 600);
    await logQuery(req.b2bAccount!.id, 'contract_check', addr, chain, analysis.riskScore, false, ip);

    return res.json({ success: true, cached: false, data: result });
  } catch (err: any) {
    logger.error('[B2B] scam-check error', err);
    return res.status(500).json({ success: false, error: err.message ?? 'Analysis failed' });
  }
});

// ── POST /api/v1/b2b/wallet-check ────────────────────────────────────────────
// Check a wallet address for scam history / reports
router.post('/wallet-check', requireB2BKey, async (req: Request, res: Response) => {
  const { address, chain = 'ethereum' } = req.body;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ success: false, error: 'address is required' });
  }

  const addr = address.toLowerCase().trim();
  const ip = req.ip ?? 'unknown';
  const cacheKey = `b2b:wallet:${chain}:${addr}`;

  const cached = await cacheGet<object>(cacheKey);
  if (cached) {
    await logQuery(req.b2bAccount!.id, 'wallet_check', addr, chain, null, true, ip);
    return res.json({ success: true, cached: true, data: cached });
  }

  try {
    // Community scam reports for this wallet
    const { rows: reports } = await db.query(
      `SELECT id, category, title, severity, votes_confirm, created_at
       FROM community_scam_reports
       WHERE LOWER(address) = $1 AND status IN ('confirmed','investigating')
       ORDER BY created_at DESC LIMIT 10`,
      [addr],
    );

    // Was this wallet involved in scam_reports table (as a deployer/reporter)
    const { rows: historicScams } = await db.query(
      `SELECT id, contract_address, status, reason, created_at
       FROM scam_reports
       WHERE LOWER(reporter_address) = $1 OR LOWER(contract_address) = $1
       ORDER BY created_at DESC LIMIT 5`,
      [addr],
    ).catch(() => ({ rows: [] as any[] }));

    const riskScore = reports.filter(r => r.severity === 'critical').length * 30
      + reports.filter(r => r.severity === 'high').length * 20
      + reports.filter(r => r.severity === 'medium').length * 10;

    const result = {
      address: addr,
      chain,
      riskScore:     Math.min(100, riskScore),
      riskLevel:     riskScore >= 60 ? 'critical' : riskScore >= 30 ? 'high' : riskScore >= 10 ? 'medium' : 'low',
      confirmedReports: reports.filter(r => r.status === 'confirmed').length,
      reports,
      historicScams,
      checkedAt: new Date().toISOString(),
    };

    await cacheSet(cacheKey, result, 600);
    await logQuery(req.b2bAccount!.id, 'wallet_check', addr, chain, result.riskScore, false, ip);

    return res.json({ success: true, cached: false, data: result });
  } catch (err: any) {
    logger.error('[B2B] wallet-check error', err);
    return res.status(500).json({ success: false, error: err.message ?? 'Check failed' });
  }
});

// ── POST /api/v1/b2b/batch-check ─────────────────────────────────────────────
// Batch check up to 50 addresses (counts as 1 query per address)
router.post('/batch-check', requireB2BKey, async (req: Request, res: Response) => {
  const { addresses, chain = 'ethereum' } = req.body;

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ success: false, error: 'addresses array is required' });
  }
  if (addresses.length > 50) {
    return res.status(400).json({ success: false, error: 'Maximum 50 addresses per batch' });
  }

  // Check quota for the full batch
  const acct = req.b2bAccount!;
  const limit = TIER_LIMITS[acct.tier] ?? acct.monthly_query_limit;
  if (acct.queries_this_month + addresses.length > limit) {
    return res.status(429).json({
      success: false,
      error: `Batch of ${addresses.length} would exceed your monthly quota (${limit - acct.queries_this_month} remaining)`,
    });
  }

  const ip = req.ip ?? 'unknown';
  const results: Record<string, object> = {};

  for (const address of addresses) {
    const addr = String(address).toLowerCase().trim();
    const cacheKey = `b2b:check:${chain}:${addr}`;
    const cached = await cacheGet<object>(cacheKey);

    if (cached) {
      results[addr] = { ...cached as object, cached: true };
      await logQuery(acct.id, 'batch_check', addr, chain, (cached as any).riskScore ?? null, true, ip);
      continue;
    }

    try {
      const network = chain === 'mainnet' || chain === 'ethereum' ? 'mainnet' : 'testnet';
      const analysis = await analyzeContract(addr, network);
      const { rows: reports } = await db.query(
        `SELECT id, category, title, severity FROM community_scam_reports
         WHERE LOWER(address) = $1 AND status = 'confirmed' LIMIT 3`,
        [addr],
      );

      const result = {
        address: addr,
        riskScore:     analysis.riskScore,
        riskLevel:     analysis.riskLevel,
        flags:         analysis.flags,
        confirmedScam: reports.length > 0,
        scamReports:   reports,
        cached:        false,
      };
      await cacheSet(cacheKey, result, 600);
      await logQuery(acct.id, 'batch_check', addr, chain, analysis.riskScore, false, ip);
      results[addr] = result;
    } catch (err: any) {
      results[addr] = { address: addr, error: err.message, riskScore: -1, riskLevel: 'unknown', cached: false };
      await logQuery(acct.id, 'batch_check', addr, chain, null, false, ip);
    }
  }

  return res.json({
    success: true,
    data: {
      chain,
      count:   addresses.length,
      results,
    },
  });
});

// ── GET /api/v1/b2b/reports ──────────────────────────────────────────────────
// Confirmed scam report feed — useful for bulk ingestion by B2B clients
router.get('/reports', requireB2BKey, async (req: Request, res: Response) => {
  const chain  = (req.query.chain  as string) || undefined;
  const since  = (req.query.since  as string) || undefined;
  const limit  = Math.min(500, parseInt(req.query.limit as string, 10) || 100);
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const ip     = req.ip ?? 'unknown';

  try {
    const params: (string | number)[] = ['confirmed'];
    let where = 'WHERE status = $1';
    if (chain)  { params.push(chain);  where += ` AND chain = $${params.length}`; }
    if (since)  { params.push(since);  where += ` AND created_at > $${params.length}`; }
    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, address, chain, report_type, category, title, severity, votes_confirm, created_at, resolved_at
       FROM community_scam_reports
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    await logQuery(req.b2bAccount!.id, 'report_feed', 'feed', chain || 'all', null, false, ip);

    return res.json({ success: true, data: { count: rows.length, reports: rows } });
  } catch (err: any) {
    logger.error('[B2B] reports feed error', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/v1/b2b/apply ───────────────────────────────────────────────────
// Public: submit a B2B application (no key required, goes to pending)
router.post('/apply', async (req: Request, res: Response) => {
  const { company_name, contact_name, email, website, use_case, tier = 'starter' } = req.body;

  if (!company_name || !email) {
    return res.status(400).json({ success: false, error: 'company_name and email are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address' });
  }

  const validTiers = ['starter', 'professional', 'enterprise'];
  if (!validTiers.includes(tier)) {
    return res.status(400).json({ success: false, error: 'tier must be starter, professional, or enterprise' });
  }

  try {
    // Check if already applied
    const { rows: existing } = await db.query(
      `SELECT id, status FROM b2b_accounts WHERE email = $1`,
      [email.toLowerCase()],
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: `An application for this email already exists (status: ${existing[0].status}). Contact support@dappscore.io`,
      });
    }

    // Generate a placeholder key — admin will activate and issue real key
    const placeholderRaw = `b2b_pending_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash   = hashB2BKey(placeholderRaw);
    const keyPrefix = placeholderRaw.substring(0, 12);

    const tierLimits: Record<string, number> = {
      starter: 1_000, professional: 50_000, enterprise: 1_000_000,
    };

    await db.query(
      `INSERT INTO b2b_accounts
         (company_name, contact_name, email, website, use_case, tier, status,
          api_key_hash, api_key_prefix, monthly_query_limit)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9)`,
      [
        company_name, contact_name || null, email.toLowerCase(),
        website || null, use_case || null, tier,
        keyHash, keyPrefix, tierLimits[tier],
      ],
    );

    logger.info(`[B2B] New application: ${company_name} (${email}) tier=${tier}`);

    return res.status(201).json({
      success: true,
      data: {
        message: 'Application received. We will review and contact you within 1–2 business days.',
        tier,
      },
    });
  } catch (err: any) {
    logger.error('[B2B] apply error', err);
    return res.status(500).json({ success: false, error: 'Failed to submit application' });
  }
});

export default router;
