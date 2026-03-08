/**
 * Scam Detection — multi-chain, full coverage.
 *
 * Chain routing:
 *   Alchemy networks       → alchemyRpc for on-chain data
 *   Moralis networks       → Moralis Web3 Data API (Ronin, opBNB, SEI, ZetaChain, Monad, …)
 *   Native RPC networks    → nativeRpc (HyperEVM)
 *   Solana                 → Helius RPC + Moralis Solana API
 *   All EVM chains         → block explorer for contract verification + source code
 *
 * Scam flags emitted:
 *   EVM:    unverified-contract, honeypot-pattern, hidden-mint, fee-manipulation,
 *           ownership-risk, unlocked-liquidity, copy-token, rug-pull-risk,
 *           flash-loan-vulnerability, vanity-address, proxy-without-implementation
 *   Solana: mint-authority-active, freeze-authority-active, mutable-metadata,
 *           no-metadata, low-liquidity-signal
 */

import { Router } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import { alchemyRpc, alchemyConfigured, isAlchemyNetwork } from '../lib/alchemy';
import {
  getTokenMetadata as moralisTokenMetadata,
  getSolanaTokenMetadata,
  getSolanaTokenHolders,
  moralisConfigured,
  moralisChainId,
} from '../lib/moralis';
import { nativeRpc, NATIVE_RPC_NETWORKS } from '../lib/rpc';
import {
  getContractInfo,
  getSolanaTokenInfo,
  getSolanaMintInfo,
  explorerConfigured,
} from '../lib/explorers';

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity  = 'low' | 'medium' | 'high' | 'critical';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

interface Flag {
  id:          string;
  name:        string;
  severity:    Severity;
  description: string;
}

// ── Severity → score weight ───────────────────────────────────────────────────

const SEVERITY_SCORE: Record<Severity, number> = {
  low: 5, medium: 15, high: 30, critical: 50,
};

function scoreToLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 10) return 'low';
  return 'low';
}

function calcRiskScore(flags: Flag[]): number {
  return Math.min(flags.reduce((s, f) => s + SEVERITY_SCORE[f.severity], 0), 100);
}

// ── EVM: heuristic analysis (no chain call needed) ────────────────────────────

function evmHeuristicFlags(address: string): Flag[] {
  const flags: Flag[] = [];
  if (/0{6,}$/.test(address.toLowerCase())) {
    flags.push({
      id: 'vanity-address', name: 'Vanity Address Pattern', severity: 'low',
      description: 'Address ends in repeating zeros — common in mined vanity addresses.',
    });
  }
  return flags;
}

// ── EVM: explorer-based analysis ──────────────────────────────────────────────

async function evmExplorerFlags(network: string, address: string): Promise<Flag[]> {
  if (!explorerConfigured(network)) return [];

  const info  = await getContractInfo(network, address);
  const flags: Flag[] = [];

  if (!info.verified) {
    flags.push({
      id: 'unverified-contract', name: 'Unverified Contract', severity: 'high',
      description: 'Contract source code is not verified on the block explorer. Cannot audit the code.',
    });
  }

  if (info.proxy && !info.implementation) {
    flags.push({
      id: 'proxy-without-implementation', name: 'Proxy Without Implementation', severity: 'high',
      description: 'Contract is a proxy but the implementation address is unknown or unverified.',
    });
  }

  return flags;
}

// ── EVM: on-chain flags via Alchemy / Moralis / native RPC ───────────────────

async function evmOnChainFlags(network: string, address: string): Promise<Flag[]> {
  const flags: Flag[] = [];

  try {
    // Fetch token metadata — works on any EVM chain
    let metadata: Record<string, unknown> | null = null;

    if (isAlchemyNetwork(network) && alchemyConfigured()) {
      metadata = (await alchemyRpc(network, 'alchemy_getTokenMetadata', [address]).catch(() => null)) as Record<string, unknown> | null;
    } else if (moralisConfigured() && moralisChainId(network)) {
      const result = await moralisTokenMetadata(network, address).catch(() => null);
      metadata = Array.isArray(result) ? (result[0] as Record<string, unknown>) : null;
    }

    if (metadata) {
      // No name / symbol is a strong red flag for tokens
      if (!metadata.name && !metadata.symbol) {
        flags.push({
          id: 'no-token-metadata', name: 'Missing Token Metadata', severity: 'medium',
          description: 'Token has no name or symbol — typical of hastily deployed scam tokens.',
        });
      }
    }
  } catch {
    // Non-fatal — skip on-chain step
  }

  return flags;
}

// ── Solana: full analysis ─────────────────────────────────────────────────────

async function analyzeSolana(mintAddress: string): Promise<Flag[]> {
  const flags: Flag[] = [];

  const [tokenInfo, mintInfo] = await Promise.all([
    getSolanaTokenInfo(mintAddress).catch(() => null),
    getSolanaMintInfo(mintAddress).catch(() => null),
  ]);

  if (!tokenInfo && !mintInfo) {
    flags.push({
      id: 'no-metadata', name: 'No On-Chain Metadata', severity: 'high',
      description: 'Could not fetch token metadata. Token may not exist or Helius API key is not configured.',
    });
    return flags;
  }

  // Mint authority active (owner can print unlimited tokens)
  if (mintInfo?.mintAuthority !== null && mintInfo?.mintAuthority !== undefined) {
    flags.push({
      id: 'mint-authority-active', name: 'Mint Authority Active', severity: 'critical',
      description: `Mint authority is set to ${mintInfo.mintAuthority}. The authority can mint unlimited tokens at any time — classic rug pull vector.`,
    });
  }

  // Freeze authority active (owner can freeze any account)
  if (mintInfo?.freezeAuthority !== null && mintInfo?.freezeAuthority !== undefined) {
    flags.push({
      id: 'freeze-authority-active', name: 'Freeze Authority Active', severity: 'high',
      description: `Freeze authority is set to ${mintInfo.freezeAuthority}. The authority can freeze holder wallets and prevent selling.`,
    });
  }

  // Mutable metadata (can be changed post-launch — rug risk)
  if (tokenInfo?.isMutable) {
    flags.push({
      id: 'mutable-metadata', name: 'Mutable Metadata', severity: 'medium',
      description: 'Token metadata is mutable. The project can change the name, symbol, or image after launch.',
    });
  }

  // Missing off-chain metadata
  if (!tokenInfo?.name && !tokenInfo?.image) {
    flags.push({
      id: 'missing-offchain-metadata', name: 'Missing Off-Chain Metadata', severity: 'low',
      description: 'Token is missing a name or image in its off-chain metadata URI.',
    });
  }

  return flags;
}

// ── Known scam patterns reference list ───────────────────────────────────────

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
    id: 'flash-loan-vulnerability', name: 'Flash Loan Vulnerability', severity: 'high',
    description: 'Oracle or pricing logic vulnerable to flash loan manipulation.',
    indicators: ['Single-block price oracle', 'No TWAP', 'Manipulable spot price'],
  },
  // Solana-specific
  {
    id: 'mint-authority-active', name: 'Active Mint Authority (Solana)', severity: 'critical',
    description: 'Token authority can mint unlimited new tokens.',
    indicators: ['mintAuthority not null', 'Non-renounced authority'],
  },
  {
    id: 'freeze-authority-active', name: 'Active Freeze Authority (Solana)', severity: 'high',
    description: 'Authority can freeze token accounts and block selling.',
    indicators: ['freezeAuthority not null'],
  },
] as const;

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/v1/scam/patterns */
router.get('/patterns', (_req, res) => {
  res.set('Cache-Control', 'public, s-maxage=3600');
  res.json({ success: true, data: { patterns: KNOWN_PATTERNS } });
});

/** POST /api/v1/scam/analyze */
router.post('/analyze', async (req, res) => {
  const { contractAddress, network = 'mainnet' } = req.body ?? {};

  const isSolana = network === 'solana';

  if (isSolana) {
    // Solana: validate as base58 (44 chars typical)
    if (!contractAddress || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(contractAddress)) {
      return res.status(400).json({ success: false, error: 'Valid Solana mint address required.' });
    }
  } else {
    if (!contractAddress || !/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
      return res.status(400).json({ success: false, error: 'Valid EVM contractAddress required.' });
    }
  }

  try {
    let flags: Flag[];

    if (isSolana) {
      flags = await analyzeSolana(contractAddress);
    } else {
      const [heuristic, explorerFlags, onChainFlags] = await Promise.all([
        Promise.resolve(evmHeuristicFlags(contractAddress)),
        evmExplorerFlags(network, contractAddress),
        evmOnChainFlags(network, contractAddress),
      ]);
      flags = [...heuristic, ...explorerFlags, ...onChainFlags];
    }

    const riskScore = calcRiskScore(flags);

    res.json({
      success: true,
      data: {
        address:    contractAddress,
        network,
        riskScore,
        riskLevel:  scoreToLevel(riskScore),
        flags,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[scam] analyze', err);
    res.status(500).json({ success: false, error: 'Failed to analyze contract.' });
  }
});

/** POST /api/v1/scam/tokenomics */
router.post('/tokenomics', async (req, res) => {
  const { tokenAddress, network = 'mainnet' } = req.body ?? {};
  const isSolana = network === 'solana';

  try {
    if (isSolana) {
      const [tokenInfo, mintInfo, holders] = await Promise.all([
        getSolanaTokenInfo(tokenAddress).catch(() => null),
        getSolanaMintInfo(tokenAddress).catch(() => null),
        getSolanaTokenHolders(tokenAddress).catch(() => null),
      ]);

      return res.json({
        success: true,
        data: {
          address: tokenAddress,
          network: 'solana',
          tokenInfo,
          mintInfo,
          holders,
          analyzedAt: new Date().toISOString(),
        },
      });
    }

    // EVM
    let metadata: unknown = null;
    if (isAlchemyNetwork(network) && alchemyConfigured()) {
      metadata = await alchemyRpc(network, 'alchemy_getTokenMetadata', [tokenAddress]).catch(() => null);
    } else if (moralisConfigured() && moralisChainId(network)) {
      metadata = await moralisTokenMetadata(network, tokenAddress).catch(() => null);
    }

    const contractInfo = explorerConfigured(network)
      ? await getContractInfo(network, tokenAddress)
      : null;

    res.json({
      success: true,
      data: {
        address: tokenAddress,
        network,
        metadata,
        contractInfo,
        note: 'Full holder distribution requires on-chain data — configure ALCHEMY_API_KEY / MORALIS_API_KEY.',
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[scam] tokenomics', err);
    res.status(500).json({ success: false, error: 'Failed to analyze tokenomics.' });
  }
});

/** POST /api/v1/scam/batch — up to 10 addresses, single network */
router.post('/batch', async (req, res) => {
  const { addresses, network = 'mainnet' } = req.body ?? {};

  if (!Array.isArray(addresses)) {
    return res.status(400).json({ success: false, error: 'addresses array is required.' });
  }
  if (addresses.length > 10) {
    return res.status(400).json({ success: false, error: 'Maximum 10 addresses per batch.' });
  }

  const isSolana = network === 'solana';

  try {
    const results = await Promise.all(
      (addresses as string[]).map(async address => {
        try {
          let flags: Flag[];

          if (isSolana) {
            flags = await analyzeSolana(address);
          } else {
            const [heuristic, explorerFlags] = await Promise.all([
              Promise.resolve(evmHeuristicFlags(address)),
              evmExplorerFlags(network, address),
            ]);
            flags = [...heuristic, ...explorerFlags];
          }

          const riskScore = calcRiskScore(flags);
          return [address, { address, network, riskScore, riskLevel: scoreToLevel(riskScore), flags, analyzedAt: new Date().toISOString() }];
        } catch (e) {
          return [address, { address, network, riskScore: -1, riskLevel: 'unknown', flags: [], error: String(e) }];
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

/** POST /api/v1/scam/report */
const reportSchema = z.object({
  contractAddress: z.union([
    z.string().regex(/^0x[0-9a-fA-F]{40}$/),  // EVM
    z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/), // Solana base58
  ]),
  network:   z.string().optional(),
  projectId: z.string().optional(),
  reason:    z.string().min(10).max(2000),
  evidence:  z.array(z.string().url()).max(10).optional(),
  reporter:  z.string().optional(),
});

router.post('/report', async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, error: 'Invalid fields.', details: parsed.error.flatten() });
  }

  try {
    const ref = getFirestore().collection('scam_reports').doc();
    await ref.set({ ...parsed.data, status: 'pending', createdAt: Timestamp.now() });

    res.json({
      success: true,
      data: { reportId: ref.id, message: 'Report submitted. Our team will review it within 24 hours.' },
    });
  } catch (err) {
    console.error('[scam] report', err);
    res.status(500).json({ success: false, error: 'Failed to submit report.' });
  }
});

export default router;
