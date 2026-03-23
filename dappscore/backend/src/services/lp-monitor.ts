/**
 * LP Token Movement Monitor
 *
 * Detects suspicious LP token movements by querying a block explorer API:
 *   - LP tokens sent back to the deployer       (rug-pull preparation)
 *   - LP tokens removed from known locker contracts early (lock broken)
 *   - Large LP burns sent to dead addresses      (possible covering tracks)
 *
 * Uses Etherscan-compatible `tokentx` endpoint; works with any chain that
 * exposes this API (Etherscan, Basescan, Arbiscan, Polygonscan, …).
 *
 * NOTE: For a newly launched token, the deployer address and pair address
 * (Uniswap V2/V3 LP token) are required inputs. Both are available from
 * the block explorer getcontractcreation + GoPlus dex fields.
 */

import { logger } from './logger';

// ── Known LP locker contract addresses (lowercase) ───────────────────────────
// Add more as they are discovered on each chain.
export const KNOWN_LP_LOCKERS = new Set<string>([
  '0x407993575c91ce7643a4d4ccacc9a98c36ee1bbe', // PinkLock v1
  '0x71b5759d73262fbb223956913ecf4ecc51057641', // Uncx Network
  '0x663a5c229c09b049e36dce11a62b2baa0ed8f50a', // Unicrypt v2
  '0xdae2f39b3a4a1eea7ae09cf3c4f2d7cf4f6de7fb', // DxSale
  '0x8e5a47fc7c15a36e9e7e197ddb9ac68d0c98e3c9', // FlokiLock
  '0x1d1c8f21291bf012d9b2cf82daaefbe0a33ab2f1', // TrustSwap Lock
  // Zero address is also a valid "permanent lock" destination
  '0x0000000000000000000000000000000000000000',
]);

const DEAD_ADDRESSES = new Set<string>([
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000000000',
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export type LpMovementType = 'lp-to-deployer' | 'early-unlock' | 'lp-burn';

export interface LpMovementAlert {
  type: LpMovementType;
  severity: 'warning' | 'danger';
  txHash: string;
  blockNumber: number;
  timestamp: number;          // unix seconds
  from: string;
  to: string;
  amount: string;             // raw token units (LP token has 18 decimals)
  pctOfTotalLp?: number;      // percentage of LP total supply moved (0–100)
  description: string;
}

export interface LpMovementSummary {
  pairAddress: string;
  alerts: LpMovementAlert[];
  deployerCurrentlyHoldsLp: boolean;
  deployerLpPct: number;      // 0–100
  hasEarlyUnlock: boolean;
  hasSuspiciousMovements: boolean;
}

interface TokenTxRecord {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenDecimal: string;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Fetch recent LP token (ERC-20 pair contract) transfers and flag suspicious
 * movements.
 *
 * @param apiBase         Block explorer API base URL (Etherscan-compatible)
 * @param pairAddress     Uniswap V2 pair address — this IS the LP token
 * @param deployerAddress The original contract deployer to watch
 * @param lookbackDays    How many days of history to scan (default 30)
 */
export async function detectLpMovements(
  apiBase: string,
  pairAddress: string,
  deployerAddress: string,
  lookbackDays = 30,
): Promise<LpMovementSummary> {
  const pair     = pairAddress.toLowerCase();
  const deployer = deployerAddress.toLowerCase();
  const alerts: LpMovementAlert[] = [];

  try {
    // Fetch up to 200 most recent LP token transfers
    const res = await fetch(
      `${apiBase}?module=account&action=tokentx` +
      `&contractaddress=${pairAddress}&sort=desc&page=1&offset=200`,
    );
    const data: any = await res.json();
    const allTxs: TokenTxRecord[] = Array.isArray(data?.result) ? data.result : [];

    const cutoffTs  = Date.now() / 1000 - lookbackDays * 86_400;
    const recentTxs = allTxs.filter(tx => parseInt(tx.timeStamp, 10) >= cutoffTs);

    // ── Infer total LP supply from historical mints (Transfer from 0x0) ──────
    // This is an approximation; use totalSupply() via RPC for precision.
    const totalMinted = allTxs
      .filter(tx => tx.from === '0x0000000000000000000000000000000000000000')
      .reduce((sum, tx) => sum + BigInt(tx.value || '0'), 0n);

    // ── Compute deployer's current LP balance from full history ──────────────
    let deployerBalance = 0n;
    for (const tx of allTxs) {
      if (tx.to.toLowerCase()   === deployer) deployerBalance += BigInt(tx.value || '0');
      if (tx.from.toLowerCase() === deployer) deployerBalance -= BigInt(tx.value || '0');
    }
    const deployerLpPct = totalMinted > 0n
      ? Number((deployerBalance * 10_000n) / totalMinted) / 100
      : 0;

    const pctOf = (value: string): number | undefined =>
      totalMinted > 0n
        ? Number((BigInt(value) * 10_000n) / totalMinted) / 100
        : undefined;

    // ── Flag 1: LP tokens sent to deployer ───────────────────────────────────
    for (const tx of recentTxs) {
      if (
        tx.to.toLowerCase()   === deployer &&
        !DEAD_ADDRESSES.has(tx.from.toLowerCase())
      ) {
        const pct = pctOf(tx.value);
        alerts.push({
          type: 'lp-to-deployer',
          severity: 'danger',
          txHash: tx.hash,
          blockNumber: parseInt(tx.blockNumber, 10),
          timestamp: parseInt(tx.timeStamp, 10),
          from: tx.from,
          to: tx.to,
          amount: tx.value,
          pctOfTotalLp: pct,
          description:
            `LP tokens transferred directly to the contract deployer` +
            (pct !== undefined ? ` (${pct.toFixed(2)}% of supply)` : '') +
            ` — likely rug-pull preparation`,
        });
      }
    }

    // ── Flag 2: LP tokens removed from a known locker contract early ─────────
    for (const tx of recentTxs) {
      if (
        KNOWN_LP_LOCKERS.has(tx.from.toLowerCase()) &&
        !DEAD_ADDRESSES.has(tx.to.toLowerCase())
      ) {
        alerts.push({
          type: 'early-unlock',
          severity: 'danger',
          txHash: tx.hash,
          blockNumber: parseInt(tx.blockNumber, 10),
          timestamp: parseInt(tx.timeStamp, 10),
          from: tx.from,
          to: tx.to,
          amount: tx.value,
          description:
            `LP tokens withdrawn from locker contract ${tx.from} to ${tx.to}` +
            ` — lock broken before expiry`,
        });
      }
    }

    // ── Flag 3: Large LP burns to dead address ────────────────────────────────
    // Only flag if significant (>5%) — small burns on launch are common/benign.
    for (const tx of recentTxs) {
      if (
        DEAD_ADDRESSES.has(tx.to.toLowerCase()) &&
        !DEAD_ADDRESSES.has(tx.from.toLowerCase())
      ) {
        const pct = pctOf(tx.value);
        if (pct !== undefined && pct >= 5) {
          alerts.push({
            type: 'lp-burn',
            severity: 'warning',
            txHash: tx.hash,
            blockNumber: parseInt(tx.blockNumber, 10),
            timestamp: parseInt(tx.timeStamp, 10),
            from: tx.from,
            to: tx.to,
            amount: tx.value,
            pctOfTotalLp: pct,
            description:
              `${pct.toFixed(1)}% of LP supply burned to dead address — ` +
              `verify this is intentional and not masking a concurrent dump`,
          });
        }
      }
    }

    // Sort most-recent first
    alerts.sort((a, b) => b.timestamp - a.timestamp);

    return {
      pairAddress: pair,
      alerts,
      deployerCurrentlyHoldsLp: deployerBalance > 0n,
      deployerLpPct: Math.max(0, deployerLpPct),
      hasEarlyUnlock: alerts.some(a => a.type === 'early-unlock'),
      hasSuspiciousMovements: alerts.some(
        a => a.type === 'lp-to-deployer' || a.type === 'early-unlock',
      ),
    };
  } catch (error) {
    logger.error('[LpMonitor] detectLpMovements error:', error as Error);
    return {
      pairAddress: pair,
      alerts: [],
      deployerCurrentlyHoldsLp: false,
      deployerLpPct: 0,
      hasEarlyUnlock: false,
      hasSuspiciousMovements: false,
    };
  }
}
