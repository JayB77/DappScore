/**
 * Scam Detection — pure logic + Firestore for reports.
 * Uses lib/alchemy.ts for per-network API key resolution.
 */

import { Router } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { alchemyRpc, alchemyConfigured } from '../lib/alchemy';

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

interface Flag {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface Analysis {
  address: string;
  network: string;
  riskScore: number;
  riskLevel: RiskLevel;
  flags: Flag[];
  analyzedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch basic token metadata via Alchemy (per-network key resolved automatically). */
async function fetchContractInfo(
  address: string,
  network: string,
): Promise<{ name?: string; symbol?: string; totalSupply?: string; verified?: boolean }> {
  if (!alchemyConfigured()) return {};

  try {
    const result = await alchemyRpc(network, 'alchemy_getTokenMetadata', [address]);
    return (result ?? {}) as { name?: string; symbol?: string; totalSupply?: string };
  } catch {
    return {};
  }
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'low';
}

/** Heuristic-only analysis — no on-chain calls required. */
function heuristicAnalysis(address: string, _network: string): Flag[] {
  const flags: Flag[] = [];
  const lower = address.toLowerCase();

  // Vanity address patterns common in scams (all-zeros suffix)
  if (/0{6,}$/.test(lower)) {
    flags.push({
      id: 'vanity-address',
      name: 'Vanity Address Pattern',
      severity: 'low',
      description: 'Contract address ends in repeating zeros — common in mined vanity addresses.',
    });
  }

  return flags;
}

// ── Routes ────────────────────────────────────────────────────────────────────

const KNOWN_PATTERNS = [
  {
    id: 'honeypot', name: 'Honeypot', severity: 'critical',
    description: 'Contract prevents selling tokens.',
    indicators: ['Transfer restrictions on sell', 'Blacklist on sell path', 'Max sell tx limits'],
  },
  {
    id: 'hidden-mint', name: 'Hidden Mint', severity: 'critical',
    description: 'Owner can mint unlimited tokens without transparency.',
    indicators: ['Owner mint function', 'Hidden mint in bytecode', 'Mintable proxy'],
  },
  {
    id: 'fee-manipulation', name: 'Fee Manipulation', severity: 'high',
    description: 'Fees can be raised to 100% by owner.',
    indicators: ['Fees > 25%', 'Asymmetric buy/sell fees', 'Owner can change fees freely'],
  },
  {
    id: 'ownership-risk', name: 'Ownership Risk', severity: 'medium',
    description: 'Owner holds excessive control over the contract.',
    indicators: ['Ownership not renounced', 'Owner can pause', 'Owner can blacklist'],
  },
  {
    id: 'unlocked-liquidity', name: 'Unlocked Liquidity', severity: 'high',
    description: 'LP tokens are not locked in a time-lock contract.',
    indicators: ['LP in deployer wallet', 'No lock contract detected', 'Short lock period'],
  },
  {
    id: 'copy-token', name: 'Copy Token', severity: 'medium',
    description: 'Token impersonates a known project.',
    indicators: ['Same name as known project', 'Similar bytecode to known scam', 'Impersonation metadata'],
  },
  {
    id: 'rug-pull-risk', name: 'Rug Pull Risk', severity: 'critical',
    description: 'Contract allows owner to drain liquidity.',
    indicators: ['Owner can remove liquidity', 'No time-lock on admin functions', 'Large team allocation'],
  },
  {
    id: 'flash-loan-attack', name: 'Flash Loan Vulnerability', severity: 'high',
    description: 'Oracle or pricing logic vulnerable to flash loan manipulation.',
    indicators: ['Single-block price oracle', 'No TWAP', 'Manipulable spot price'],
  },
] as const;

/** GET /api/v1/scam/patterns */
router.get('/patterns', (_req, res) => {
  res.set('Cache-Control', 'public, s-maxage=3600');
  res.json({ success: true, data: { patterns: KNOWN_PATTERNS } });
});

/** POST /api/v1/scam/analyze */
router.post('/analyze', async (req, res) => {
  const { contractAddress, network = 'mainnet' } = req.body ?? {};

  if (!contractAddress || !/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    return res.status(400).json({ success: false, error: 'Valid contractAddress required.' });
  }

  try {
    const [contractInfo, heuristicFlags] = await Promise.all([
      fetchContractInfo(contractAddress, network),
      Promise.resolve(heuristicAnalysis(contractAddress, network)),
    ]);

    const flags = [...heuristicFlags];
    const riskScore = Math.min(flags.reduce((acc, f) => {
      const weights = { low: 5, medium: 15, high: 30, critical: 50 };
      return acc + (weights[f.severity] ?? 0);
    }, 0), 100);

    const analysis: Analysis = {
      address:     contractAddress,
      network,
      riskScore,
      riskLevel:   scoreToLevel(riskScore),
      flags,
      analyzedAt:  new Date().toISOString(),
    };

    // Include any available metadata
    const result = contractInfo.name
      ? { ...analysis, tokenInfo: contractInfo }
      : analysis;

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[scam] analyze', err);
    res.status(500).json({ success: false, error: 'Failed to analyze contract.' });
  }
});

/** POST /api/v1/scam/tokenomics */
router.post('/tokenomics', async (req, res) => {
  const { tokenAddress, network = 'mainnet' } = req.body ?? {};

  if (!tokenAddress || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
    return res.status(400).json({ success: false, error: 'Valid tokenAddress required.' });
  }

  try {
    const tokenInfo = await fetchContractInfo(tokenAddress, network);

    // In production, query on-chain holder distribution via Alchemy
    res.json({
      success: true,
      data: {
        address: tokenAddress,
        network,
        tokenInfo,
        distributionWarnings: [],
        note: 'Full tokenomics analysis requires on-chain data — configure ALCHEMY_API_KEY.',
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[scam] tokenomics', err);
    res.status(500).json({ success: false, error: 'Failed to analyze tokenomics.' });
  }
});

/** POST /api/v1/scam/batch */
router.post('/batch', async (req, res) => {
  const { addresses, network = 'mainnet' } = req.body ?? {};

  if (!Array.isArray(addresses)) {
    return res.status(400).json({ success: false, error: 'addresses array is required.' });
  }
  if (addresses.length > 10) {
    return res.status(400).json({ success: false, error: 'Maximum 10 addresses per batch.' });
  }

  try {
    const results = await Promise.all(
      addresses.map(async (address: string) => {
        try {
          const flags     = heuristicAnalysis(address, network);
          const riskScore = Math.min(flags.reduce((acc, f) => {
            const w = { low: 5, medium: 15, high: 30, critical: 50 };
            return acc + (w[f.severity] ?? 0);
          }, 0), 100);
          return [address, { address, network, riskScore, riskLevel: scoreToLevel(riskScore), flags, analyzedAt: new Date().toISOString() }];
        } catch (e: unknown) {
          return [address, { address, riskScore: -1, riskLevel: 'unknown', flags: [], error: String(e) }];
        }
      }),
    );

    res.json({
      success: true,
      data: { analyzed: results.length, results: Object.fromEntries(results) },
    });
  } catch (err) {
    console.error('[scam] batch', err);
    res.status(500).json({ success: false, error: 'Failed to batch analyze.' });
  }
});

const reportSchema = z.object({
  contractAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  projectId:       z.string().optional(),
  reason:          z.string().min(10).max(2000),
  evidence:        z.array(z.string().url()).max(10).optional(),
  reporter:        z.string().optional(),
});

/** POST /api/v1/scam/report */
router.post('/report', async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, error: 'Invalid fields.', details: parsed.error.flatten() });
  }

  try {
    const ref = getFirestore().collection('scam_reports').doc();
    await ref.set({
      ...parsed.data,
      status: 'pending',
      createdAt: Timestamp.now(),
    });

    res.json({
      success: true,
      data: {
        reportId: ref.id,
        message: 'Report submitted. Our team will review it within 24 hours.',
      },
    });
  } catch (err) {
    console.error('[scam] report', err);
    res.status(500).json({ success: false, error: 'Failed to submit report.' });
  }
});

export default router;
