import { Router } from 'express';
import { promises as dns } from 'dns';

const router = Router();

// ── POST /api/v1/verify/dns ───────────────────────────────────────────────────
// Check whether a domain has a specific TXT record.
// Caller supplies the domain and the expected token value.
// Returns { success: true } or { success: false, reason, message }.
//
// Reason codes:
//   not_found — record absent or not yet propagated
//   timeout   — DNS resolver timed out
//   error     — unexpected DNS error

router.post('/dns', async (req, res) => {
  const { domain, token } = req.body as { domain?: string; token?: string };

  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'domain is required' });
  }
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }

  // Strip protocol/path — we only need the bare hostname.
  const host = domain
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();

  if (!host.includes('.')) {
    return res.status(400).json({ error: 'domain must be a valid hostname' });
  }

  const expected = `dappscore-verify=${token.trim()}`;

  try {
    const records = await dns.resolveTxt(host);
    // Each entry from resolveTxt is a string[] (split chunks); join them.
    const flat = records.map(chunks => chunks.join(''));
    const found = flat.some(r => r.toLowerCase() === expected.toLowerCase());

    if (found) {
      return res.json({ success: true });
    }
    return res.json({
      success: false,
      reason: 'not_found',
      message: 'TXT record not found — DNS may not have propagated yet.',
    });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code ?? '';
    if (code === 'ENODATA' || code === 'ENOTFOUND') {
      return res.json({
        success: false,
        reason: 'not_found',
        message: 'TXT record not found — DNS may not have propagated yet.',
      });
    }
    if (code === 'ETIMEOUT' || code === 'ECONNREFUSED') {
      return res.json({
        success: false,
        reason: 'timeout',
        message: 'DNS lookup timed out.',
      });
    }
    console.error('[verify/dns] unexpected error:', err);
    return res.json({
      success: false,
      reason: 'error',
      message: 'DNS lookup failed.',
    });
  }
});

export default router;
