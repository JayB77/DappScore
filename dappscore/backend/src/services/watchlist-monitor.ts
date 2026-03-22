/**
 * Watchlist Monitor
 *
 * Runs hourly (wired into the existing cron in index.ts).
 * For each unique token address stored in user_watchlist:
 *   1. Fetches current LP USD value from DexScreener
 *   2. Compares to the last snapshot in watchlist_lp_snapshots
 *   3. If LP dropped >50% since last check → fires a liquidity_drop alert
 *      for every user watching that token with alert_liquidity_drop = TRUE
 *
 * Ownership-transfer and trust-change alerts are triggered elsewhere
 * (event-monitor.ts and admin overrides) — this service focuses on LP drops.
 */

import { db } from '../lib/db';
import { alertService } from './alerts';
import { logger } from './logger';

interface DexScreenerPair {
  liquidity?: { usd?: number };
  baseToken?: { address?: string; symbol?: string };
}

async function fetchLpUsd(tokenAddress: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const pairs: DexScreenerPair[] = Array.isArray(data?.pairs) ? data.pairs : [];
    if (pairs.length === 0) return null;
    // Use the pair with the highest liquidity as the canonical source
    const best = pairs.reduce<DexScreenerPair | null>((top, p) =>
      (p.liquidity?.usd ?? 0) > (top?.liquidity?.usd ?? 0) ? p : top, null,
    );
    return best?.liquidity?.usd ?? null;
  } catch {
    return null;
  }
}

export async function runWatchlistMonitor(): Promise<void> {
  logger.info('[WatchlistMonitor] Starting LP drop check');

  // 1. Collect all unique watched token addresses
  const { rows: tokens } = await db.query<{ token_address: string; network: string }>(
    `SELECT DISTINCT token_address, network
     FROM user_watchlist
     WHERE token_address IS NOT NULL`,
  );

  if (tokens.length === 0) {
    logger.info('[WatchlistMonitor] No tokens to monitor');
    return;
  }

  for (const { token_address, network } of tokens) {
    try {
      const currentLp = await fetchLpUsd(token_address);
      if (currentLp === null) continue;

      // 2. Fetch last snapshot
      const { rows: snapRows } = await db.query<{ lp_usd: string }>(
        `SELECT lp_usd FROM watchlist_lp_snapshots
         WHERE token_address = $1 AND network = $2`,
        [token_address, network],
      );

      const lastLp = snapRows.length > 0 ? parseFloat(snapRows[0].lp_usd) : null;

      // 3. Update snapshot
      await db.query(
        `INSERT INTO watchlist_lp_snapshots (token_address, network, lp_usd, checked_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (token_address, network) DO UPDATE
           SET lp_usd = EXCLUDED.lp_usd, checked_at = NOW()`,
        [token_address, network, currentLp],
      );

      // 4. Check for >50% drop (only if we have a prior reading)
      if (lastLp !== null && lastLp > 0) {
        const dropPct = ((lastLp - currentLp) / lastLp) * 100;
        if (dropPct >= 50) {
          logger.warn(`[WatchlistMonitor] LP drop ${dropPct.toFixed(1)}% detected for ${token_address}`);

          // 5. Find all users watching this token with alert enabled
          const { rows: watchers } = await db.query<{
            user_id: string;
            project_id: string;
          }>(
            `SELECT user_id, project_id FROM user_watchlist
             WHERE token_address = $1 AND network = $2
               AND alert_liquidity_drop = TRUE`,
            [token_address, network],
          );

          for (const { user_id, project_id } of watchers) {
            await alertService.createAlert({
              userId:    user_id,
              type:      'trust_change',
              projectId: project_id,
              severity:  dropPct >= 80 ? 'critical' : 'high',
              title:     `Liquidity Drop Detected`,
              message:   `Liquidity for a watched token (${token_address.slice(0, 10)}…) dropped ${dropPct.toFixed(1)}% in the last hour ($${lastLp.toLocaleString('en-US', { maximumFractionDigits: 0 })} → $${currentLp.toLocaleString('en-US', { maximumFractionDigits: 0 })}). This may indicate a rug pull.`,
              metadata:  { tokenAddress: token_address, network, lastLp, currentLp, dropPct },
            });
          }
        }
      }
    } catch (err) {
      logger.error(`[WatchlistMonitor] Error checking ${token_address}`, err as Error);
    }
  }

  logger.info(`[WatchlistMonitor] Checked ${tokens.length} token(s)`);
}
