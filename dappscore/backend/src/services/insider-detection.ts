/**
 * Insider Wallet Detection
 *
 * Detects early insider wallets and coordinated launch activity using a
 * block explorer API (Etherscan-compatible `tokentx` + `txlist` endpoints).
 *
 * Three detection strategies:
 *
 *   1. Same-block buyers  — wallets that received tokens in the exact block
 *      liquidity was added. These are almost exclusively bots, MEV searchers,
 *      or insiders with advance knowledge.
 *
 *   2. Shared funding origin clustering — early buyers whose first-ever
 *      funding transaction came from the same origin address.  Multiple
 *      wallets funded from one source = coordinated wallet farm.
 *
 *   3. Pre-launch deployer interactions — early buyers who sent or received
 *      ETH from the deployer before the token launched, indicating they knew
 *      about the project before it was public.
 *
 * NOTE: All three strategies require on-chain data. Results are only as good
 * as the block explorer coverage.  Accuracy improves as more data is indexed.
 */

import { logger } from './logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InsiderType =
  | 'sniper'
  | 'funded-by-same-origin'
  | 'pre-launch-deployer-interaction';

export interface InsiderWallet {
  address: string;
  type: InsiderType;
  evidence: string;
  buyBlock?: number;
  originAddress?: string;
  preLaunchTxHash?: string;
}

export interface WalletCluster {
  /** The shared funding source address. */
  originAddress: string;
  /** All wallets in this cluster that were funded by originAddress. */
  wallets: string[];
  description: string;
}

export interface InsiderDetectionResult {
  /** Block number when liquidity was first added. null if undetectable. */
  launchBlock: number | null;
  /** Wallets that received the token in the same block as the LP add. */
  sameBlockBuyers: InsiderWallet[];
  /** Groups of early buyers that share a common first-funding address. */
  walletClusters: WalletCluster[];
  /** Early buyers that previously interacted with the deployer pre-launch. */
  preLaunchInteractors: InsiderWallet[];
  /** 0–100 composite insider risk score. */
  riskScore: number;
  summary: string;
}

interface TxRecord {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress?: string;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Analyse early token activity for signs of insider coordination.
 *
 * @param apiBase         Block explorer API base URL (Etherscan-compatible)
 * @param tokenAddress    ERC-20 token contract address
 * @param deployerAddress Contract deployer address
 * @param pairAddress     Uniswap V2 pair address — used to find the exact
 *                        launch block via the first LP-mint Transfer event.
 *                        Optional but strongly recommended for accuracy.
 */
export async function detectInsiderWallets(
  apiBase: string,
  tokenAddress: string,
  deployerAddress: string,
  pairAddress?: string,
): Promise<InsiderDetectionResult> {
  const deployer = deployerAddress.toLowerCase();

  try {
    // ── Step 1: Find the launch block ────────────────────────────────────────
    // Preferred: first LP-mint on the pair contract (Transfer from 0x0).
    // Fallback:  first token transfer on the token contract.
    let launchBlock: number | null = null;

    if (pairAddress) {
      try {
        const res  = await fetch(
          `${apiBase}?module=account&action=tokentx` +
          `&contractaddress=${pairAddress}&sort=asc&page=1&offset=10`,
        );
        const data = await res.json();
        const firstMint = (data?.result as TxRecord[] ?? []).find(
          tx => tx.from === '0x0000000000000000000000000000000000000000',
        );
        if (firstMint) launchBlock = parseInt(firstMint.blockNumber, 10);
      } catch { /* fall through to token-based detection */ }
    }

    if (launchBlock === null) {
      const res  = await fetch(
        `${apiBase}?module=account&action=tokentx` +
        `&contractaddress=${tokenAddress}&sort=asc&page=1&offset=1`,
      );
      const data = await res.json();
      const first = (data?.result as TxRecord[] ?? [])[0];
      if (first) launchBlock = parseInt(first.blockNumber, 10);
    }

    if (launchBlock === null) {
      return emptyResult('Could not determine launch block');
    }

    // ── Step 2: Fetch the first 200 token transfers (chronological) ──────────
    const earlyRes  = await fetch(
      `${apiBase}?module=account&action=tokentx` +
      `&contractaddress=${tokenAddress}&sort=asc&page=1&offset=200`,
    );
    const earlyData = await earlyRes.json();
    const earlyTxs: TxRecord[] = Array.isArray(earlyData?.result)
      ? earlyData.result
      : [];

    // ── Step 3: Same-block buyers ─────────────────────────────────────────────
    // Any wallet that received tokens in the launch block (or launch block + 1
    // to catch transactions in the same bundle/slot) is a sniper/insider.
    const sameBlockReceivers = earlyTxs.filter(tx => {
      const block = parseInt(tx.blockNumber, 10);
      return (
        (block === launchBlock || block === launchBlock + 1) &&
        tx.to.toLowerCase() !== deployer &&
        tx.to !== '0x0000000000000000000000000000000000000000' &&
        tx.from !== '0x0000000000000000000000000000000000000000'
      );
    });

    const sameBlockAddrs = [...new Set(
      sameBlockReceivers.map(tx => tx.to.toLowerCase()),
    )];

    const sameBlockBuyers: InsiderWallet[] = sameBlockAddrs.map(addr => ({
      address: addr,
      type: 'sniper' as const,
      evidence: `Received tokens in block ${launchBlock} — ` +
        `same block as first liquidity add; only bots and insiders can do this`,
      buyBlock: launchBlock!,
    }));

    // ── Step 4: Wallet origin clustering ─────────────────────────────────────
    // For up to 20 unique early buyers, look up their first funding tx.
    // Group wallets that share the same funder.
    const uniqueEarlyBuyers = [...new Set(
      earlyTxs
        .slice(0, 200)
        .map(tx => tx.to.toLowerCase())
        .filter(addr =>
          addr !== deployer &&
          addr !== '0x0000000000000000000000000000000000000000',
        ),
    )].slice(0, 20);

    const walletOrigins = new Map<string, string>(); // wallet → first funder

    await Promise.allSettled(
      uniqueEarlyBuyers.map(async (wallet) => {
        try {
          const res  = await fetch(
            `${apiBase}?module=account&action=txlist` +
            `&address=${wallet}&sort=asc&page=1&offset=5`,
          );
          const data = await res.json();
          const txs: TxRecord[] = Array.isArray(data?.result) ? data.result : [];
          // First transaction where this wallet RECEIVED ETH = its funding source
          const fundingTx = txs.find(
            tx => tx.to.toLowerCase() === wallet && tx.value !== '0',
          );
          if (fundingTx) walletOrigins.set(wallet, fundingTx.from.toLowerCase());
        } catch { /* non-critical — wallet just won't be in a cluster */ }
      }),
    );

    // Build clusters: origin → [wallet, wallet, ...]
    const originGroups = new Map<string, string[]>();
    for (const [wallet, origin] of walletOrigins) {
      if (!originGroups.has(origin)) originGroups.set(origin, []);
      originGroups.get(origin)!.push(wallet);
    }

    const walletClusters: WalletCluster[] = [];
    for (const [origin, wallets] of originGroups) {
      if (wallets.length >= 2) {
        walletClusters.push({
          originAddress: origin,
          wallets,
          description:
            `${wallets.length} early buyer wallets were all funded from ` +
            `the same address (${origin}) — consistent with a coordinated wallet farm`,
        });
      }
    }

    // ── Step 5: Pre-launch deployer interactions ──────────────────────────────
    // Check if any same-block buyers previously sent/received ETH from/to
    // the deployer BEFORE the launch block.
    const preLaunchInteractors: InsiderWallet[] = [];

    await Promise.allSettled(
      sameBlockAddrs.slice(0, 10).map(async (wallet) => {
        try {
          const res  = await fetch(
            `${apiBase}?module=account&action=txlist` +
            `&address=${wallet}&sort=asc&page=1&offset=50`,
          );
          const data = await res.json();
          const txs: TxRecord[] = Array.isArray(data?.result) ? data.result : [];

          const interaction = txs.find(tx =>
            parseInt(tx.blockNumber, 10) < launchBlock! &&
            (
              tx.from.toLowerCase() === deployer ||
              tx.to.toLowerCase()   === deployer
            ),
          );

          if (interaction) {
            preLaunchInteractors.push({
              address: wallet,
              type: 'pre-launch-deployer-interaction',
              evidence:
                `Interacted with the deployer before launch ` +
                `(tx ${interaction.hash}, block ${interaction.blockNumber})`,
              preLaunchTxHash: interaction.hash,
            });
          }
        } catch { /* non-critical */ }
      }),
    );

    // ── Step 6: Composite risk score ─────────────────────────────────────────
    let riskScore = 0;
    // Each sniper contributes 5 pts, capped at 30
    riskScore += Math.min(30, sameBlockBuyers.length * 5);
    // Each clustered wallet contributes 5 pts, capped at 40
    riskScore += Math.min(
      40,
      walletClusters.reduce((s, c) => s + c.wallets.length * 5, 0),
    );
    // Each pre-launch interactor contributes 10 pts, capped at 30
    riskScore += Math.min(30, preLaunchInteractors.length * 10);
    riskScore = Math.min(100, riskScore);

    return {
      launchBlock,
      sameBlockBuyers,
      walletClusters,
      preLaunchInteractors,
      riskScore,
      summary: buildSummary(sameBlockBuyers, walletClusters, preLaunchInteractors),
    };
  } catch (error) {
    logger.error('[InsiderDetection] detectInsiderWallets error:', error);
    return emptyResult('Analysis failed');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyResult(summary: string): InsiderDetectionResult {
  return {
    launchBlock: null,
    sameBlockBuyers: [],
    walletClusters: [],
    preLaunchInteractors: [],
    riskScore: 0,
    summary,
  };
}

function buildSummary(
  snipers:   InsiderWallet[],
  clusters:  WalletCluster[],
  prelaunch: InsiderWallet[],
): string {
  const parts: string[] = [];
  if (snipers.length > 0) {
    parts.push(
      `${snipers.length} sniper/insider wallet${snipers.length > 1 ? 's' : ''} ` +
      `bought in the launch block`,
    );
  }
  if (clusters.length > 0) {
    const total = clusters.reduce((s, c) => s + c.wallets.length, 0);
    parts.push(
      `${total} early buyers share a common funding origin ` +
      `across ${clusters.length} cluster${clusters.length > 1 ? 's' : ''}`,
    );
  }
  if (prelaunch.length > 0) {
    parts.push(
      `${prelaunch.length} early buyer${prelaunch.length > 1 ? 's' : ''} ` +
      `previously interacted with the deployer before launch`,
    );
  }
  return parts.length > 0
    ? parts.join('; ') + '.'
    : 'No significant insider activity detected.';
}
