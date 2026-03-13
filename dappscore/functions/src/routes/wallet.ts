import { Router } from 'express';
import { z } from 'zod';
import { gql } from '../lib/graphql';
import { getEtherscanApiBase } from '../lib/explorers';

const router = Router();

// ── Constants ─────────────────────────────────────────────────────────────────

const TRUST_LABELS: Record<number, string> = {
  0: 'New Listing',
  1: 'Trusted',
  2: 'Neutral',
  3: 'Suspicious',
  4: 'Suspected Scam',
  5: 'Probable Scam',
};

const STATUS_LABELS: Record<number, string> = {
  0: 'Pending',
  1: 'Active',
  2: 'Flagged',
  3: 'Suspended',
  4: 'Blacklisted',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExplorerTx {
  to: string;
  contractAddress: string;
  hash: string;
  timeStamp: string;
}

export interface DappScoreMatch {
  projectId: string;
  name: string;
  trustLevel: number;
  trustLabel: string;
  status: number;
  statusLabel: string;
  /** true if trustLevel >= 3 (Suspicious) or status >= 2 (Flagged) */
  isFlagged: boolean;
}

export interface EnrichedContract {
  address: string;
  txHash: string;
  timestamp: number;
  daysAgo: number;
  dappScore: DappScoreMatch | null;
}

export interface RiskyInteraction {
  contractAddress: string;
  txHash: string;
  timestamp: number;
  daysAgo: number;
  dappScore: DappScoreMatch;
}

export interface WalletScanResult {
  wallet: string;
  chain: string;
  walletAgeDays: number | null;
  deployedContracts: EnrichedContract[];
  riskyInteractions: RiskyInteraction[];
  riskSummary: {
    level: 'none' | 'low' | 'medium' | 'high' | 'critical';
    deployedFlaggedProjects: number;
    interactedWithFlaggedProjects: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchTxList(
  apiBase: string,
  walletAddress: string,
  sort: 'asc' | 'desc',
  offset: number,
): Promise<ExplorerTx[]> {
  const qs = new URLSearchParams({
    module: 'account',
    action: 'txlist',
    address: walletAddress,
    sort,
    page: '1',
    offset: String(offset),
  });
  try {
    const res = await fetch(`${apiBase}?${qs}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { result: ExplorerTx[] | string };
    return Array.isArray(json.result) ? json.result : [];
  } catch {
    return [];
  }
}

async function lookupProjectsByAddresses(
  addresses: string[],
): Promise<Map<string, DappScoreMatch>> {
  if (addresses.length === 0) return new Map();
  try {
    const data = await gql<{
      projects: Array<{
        id: string;
        name: string;
        trustLevel: number;
        status: number;
        contractAddress: string;
      }>;
    }>(
      `query WalletProjectLookup($addrs: [String!]!) {
        projects(first: 50, where: { contractAddress_in: $addrs }) {
          id name trustLevel status contractAddress
        }
      }`,
      { addrs: addresses },
    );
    const map = new Map<string, DappScoreMatch>();
    for (const p of data.projects ?? []) {
      map.set(p.contractAddress.toLowerCase(), {
        projectId: p.id,
        name: p.name,
        trustLevel: p.trustLevel,
        trustLabel: TRUST_LABELS[p.trustLevel] ?? 'Unknown',
        status: p.status,
        statusLabel: STATUS_LABELS[p.status] ?? 'Unknown',
        isFlagged: p.trustLevel >= 3 || p.status >= 2,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

function calcRiskLevel(deployedFlagged: number, interactionFlagged: number) {
  if (deployedFlagged >= 2 || (deployedFlagged >= 1 && interactionFlagged >= 2)) return 'critical';
  if (deployedFlagged >= 1) return 'high';
  if (interactionFlagged >= 2) return 'medium';
  if (interactionFlagged === 1) return 'low';
  return 'none';
}

// ── Route ─────────────────────────────────────────────────────────────────────

const paramSchema = z.object({
  chain:   z.string().min(1).max(50),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Must be a valid 0x EVM address'),
});

/** GET /api/v1/wallet/:chain/:address */
router.get('/:chain/:address', async (req, res) => {
  const parsed = paramSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid parameters.' });
  }

  const { chain, address } = parsed.data;
  const apiBase = getEtherscanApiBase(chain);
  if (!apiBase) {
    return res.status(400).json({
      error: `Chain '${chain}' is not supported for wallet scanning (EVM Etherscan-compatible chains only).`,
    });
  }

  try {
    const [firstTxList, recentTxList] = await Promise.all([
      fetchTxList(apiBase, address, 'asc', 1),
      fetchTxList(apiBase, address, 'desc', 100),
    ]);

    // Wallet age from oldest known transaction
    const firstTx = firstTxList[0];
    const walletAgeDays = firstTx
      ? Math.floor((Date.now() / 1000 - parseInt(firstTx.timeStamp, 10)) / 86_400)
      : null;

    // Contracts deployed by this wallet (tx.to === '' means contract creation)
    const deployedContracts: Omit<EnrichedContract, 'dappScore'>[] = recentTxList
      .filter(tx => tx.to === '' && tx.contractAddress)
      .slice(0, 20)
      .map(tx => {
        const ts = parseInt(tx.timeStamp, 10);
        return {
          address: tx.contractAddress,
          txHash: tx.hash,
          timestamp: ts,
          daysAgo: Math.floor((Date.now() / 1000 - ts) / 86_400),
        };
      });

    // Unique contract addresses this wallet sent transactions to
    const interactionAddresses = [
      ...new Set(
        recentTxList
          .filter(tx => tx.to && tx.to !== '' && tx.to.toLowerCase() !== address.toLowerCase())
          .map(tx => tx.to.toLowerCase()),
      ),
    ].slice(0, 50);

    // Batch DappScore lookup for both deployed and interacted addresses
    const allAddresses = [
      ...deployedContracts.map(c => c.address.toLowerCase()),
      ...interactionAddresses,
    ];
    const dappScoreMap = await lookupProjectsByAddresses(allAddresses);

    // Enrich deployed contracts with DappScore data
    const enrichedDeployments: EnrichedContract[] = deployedContracts.map(c => ({
      ...c,
      dappScore: dappScoreMap.get(c.address.toLowerCase()) ?? null,
    }));

    // Risky interactions: transactions to flagged projects we know about
    const seen = new Set<string>();
    const riskyInteractions: RiskyInteraction[] = [];
    for (const tx of recentTxList) {
      if (!tx.to) continue;
      const key = tx.to.toLowerCase();
      if (seen.has(key)) continue;
      const match = dappScoreMap.get(key);
      if (match?.isFlagged) {
        seen.add(key);
        const ts = parseInt(tx.timeStamp, 10);
        riskyInteractions.push({
          contractAddress: tx.to,
          txHash: tx.hash,
          timestamp: ts,
          daysAgo: Math.floor((Date.now() / 1000 - ts) / 86_400),
          dappScore: match,
        });
      }
      if (riskyInteractions.length >= 10) break;
    }

    const deployedFlagged = enrichedDeployments.filter(c => c.dappScore?.isFlagged).length;
    const interactionFlagged = riskyInteractions.length;

    const result: WalletScanResult = {
      wallet: address,
      chain,
      walletAgeDays,
      deployedContracts: enrichedDeployments,
      riskyInteractions,
      riskSummary: {
        level: calcRiskLevel(deployedFlagged, interactionFlagged) as WalletScanResult['riskSummary']['level'],
        deployedFlaggedProjects: deployedFlagged,
        interactedWithFlaggedProjects: interactionFlagged,
      },
    };

    res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    res.json(result);
  } catch (err) {
    console.error('[wallet] scan error:', err);
    res.status(500).json({ error: 'Wallet scan failed.' });
  }
});

export default router;
