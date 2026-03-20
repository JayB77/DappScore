'use client';

import { useEffect, useState } from 'react';
import {
  Lock, Unlock, Clock, Loader2,
  HelpCircle, Flame,
} from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';

// ── Chain ID map (GoPlus uses numeric EVM chain IDs) ─────────────────────────

const GOPLUS_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,        eth: 1,
  bsc: 56,            bnb: 56,            'bnb smart chain': 56,  opbnb: 204,
  polygon: 137,       matic: 137,         'polygon zkevm': 1101,
  arbitrum: 42161,    'arbitrum one': 42161,  'arbitrum nova': 42170,
  optimism: 10,       'op mainnet': 10,
  base: 8453,
  blast: 81457,
  linea: 59144,
  scroll: 534352,
  'zksync era': 324,  zksync: 324,
  mantle: 5000,
  avalanche: 43114,   avax: 43114,
  fantom: 250,        ftm: 250,           sonic: 146,
  cronos: 25,         cro: 25,
  gnosis: 100,        xdai: 100,
  celo: 42220,
  moonbeam: 1284,     glmr: 1284,
  moonriver: 1285,    movr: 1285,
  kava: 2222,
  aurora: 1313161554,
  core: 1116,         'core dao': 1116,
};

const DEAD_ADDRESSES = new Set([
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000000000',
]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface LpHolder {
  address: string;
  tag: string;
  percent: string;         // decimal string, e.g. "0.95"
  is_locked: 0 | 1;
  is_contract: 0 | 1;
  locked_detail?: Array<{
    amount: string;
    end_time: string;      // unix timestamp string
    opt_time: string;
  }>;
}

interface UnlockedHolder {
  address: string;
  tag: string;        // GoPlus-provided label, if any
  pct: number;        // 0–100: percentage of total LP supply held
  isContract: boolean;
}

interface LockSummary {
  lockedPct: number;       // 0–100
  burnedPct: number;       // 0–100
  platforms: string[];     // e.g. ["PinkLock", "Uncx"]
  earliestUnlock: number | null;   // unix seconds; null = no dated locks
  lpHolderCount: number;
  /** Unlocked LP holders that each control >2% of LP supply. */
  unlockedHolders: UnlockedHolder[];
  /** Uniswap V2/V3 pair addresses for the token (from GoPlus dex field). */
  pairAddresses: string[];
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; summary: LockSummary }
  | { status: 'error' }
  | { status: 'unsupported' };

interface ContractAddress { chain: string; address: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function pctColor(pct: number): string {
  if (pct >= 80) return 'text-green-400';
  if (pct >= 50) return 'text-yellow-400';
  if (pct > 0)   return 'text-orange-400';
  return 'text-red-400';
}

function lockLabel(pct: number): { label: string; flag?: string } {
  if (pct >= 95) return { label: 'Strongly locked' };
  if (pct >= 80) return { label: 'Well locked' };
  if (pct >= 50) return { label: 'Partially locked' };
  if (pct > 0)   return { label: 'Mostly unlocked', flag: 'CAUTION' };
  return { label: 'No locks found', flag: 'RUG RISK' };
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function fmtUnlockCountdown(ts: number): string {
  const daysLeft = Math.ceil((ts * 1000 - Date.now()) / 86_400_000);
  if (daysLeft <= 0) return 'expired';
  if (daysLeft < 30)  return `${daysLeft}d`;
  if (daysLeft < 365) return `${Math.floor(daysLeft / 30)}mo`;
  const yrs = Math.floor(daysLeft / 365);
  const mos = Math.floor((daysLeft % 365) / 30);
  return mos > 0 ? `${yrs}yr ${mos}mo` : `${yrs}yr`;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchLockSummary(chainId: number, address: string): Promise<LockSummary> {
  const res = await fetch(
    `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`GoPlus error ${res.status}`);
  const data = await res.json();
  const token = Object.values(data?.result ?? {})[0] as Record<string, unknown> | undefined;
  if (!token) throw new Error('no data');

  const holders: LpHolder[] = Array.isArray(token.lp_holders)
    ? (token.lp_holders as LpHolder[])
    : [];

  const lpHolderCount = typeof token.lp_holder_count === 'string'
    ? parseInt(token.lp_holder_count, 10)
    : holders.length;

  let lockedPct = 0;
  let burnedPct = 0;
  const platforms: string[] = [];
  let earliestUnlock: number | null = null;
  const unlockedHolders: UnlockedHolder[] = [];

  for (const h of holders) {
    const pct    = parseFloat(h.percent) * 100;
    const isDead = DEAD_ADDRESSES.has(h.address.toLowerCase());

    if (isDead) {
      burnedPct += pct;
      lockedPct += pct;   // burned = permanently locked
    } else if (h.is_locked === 1) {
      lockedPct += pct;
      if (h.tag && !platforms.includes(h.tag)) platforms.push(h.tag);

      // Find earliest unlock date across all lock details
      for (const detail of h.locked_detail ?? []) {
        const endTs = parseInt(detail.end_time, 10);
        if (endTs > 0 && (earliestUnlock === null || endTs < earliestUnlock)) {
          earliestUnlock = endTs;
        }
      }
    } else {
      // Unlocked, non-dead holder — flag those with meaningful holdings (>2%)
      if (pct >= 2) {
        unlockedHolders.push({
          address:    h.address,
          tag:        h.tag ?? '',
          pct,
          isContract: h.is_contract === 1,
        });
      }
    }
  }

  // Sort unlocked holders by size descending
  unlockedHolders.sort((a, b) => b.pct - a.pct);

  // Extract pair addresses from GoPlus dex field
  const dexList = Array.isArray(token.dex)
    ? (token.dex as Array<{ pair?: string; name?: string }>)
    : [];
  const pairAddresses = dexList
    .map(d => d.pair ?? '')
    .filter(Boolean);

  return {
    lockedPct:      Math.min(lockedPct, 100),
    burnedPct:      Math.min(burnedPct, 100),
    platforms,
    earliestUnlock,
    lpHolderCount,
    unlockedHolders,
    pairAddresses,
  };
}

// ── Single contract row ───────────────────────────────────────────────────────

function ContractRow({ chain, address, expanded = false }: ContractAddress & { expanded?: boolean }) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const chainId = GOPLUS_CHAIN_IDS[chain.toLowerCase()];

  useEffect(() => {
    if (!chainId) { setState({ status: 'unsupported' }); return; }
    setState({ status: 'loading' });
    fetchLockSummary(chainId, address)
      .then((summary) => setState({ status: 'ok', summary }))
      .catch(() => setState({ status: 'error' }));
  }, [address, chainId]);

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-2">
      {/* Chain header */}
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>

      {state.status === 'loading' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Checking LP locks…</span>
        </div>
      )}

      {state.status === 'unsupported' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-xs">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Chain not supported</span>
        </div>
      )}

      {state.status === 'error' && (
        <span className="text-xs text-gray-500">Lock data unavailable</span>
      )}

      {state.status === 'ok' && (() => {
        const { summary } = state;
        const { lockedPct, burnedPct, platforms, earliestUnlock, lpHolderCount } = summary;
        const { label, flag } = lockLabel(lockedPct);
        const nonBurnedLocked = lockedPct - burnedPct;
        const isExpired = earliestUnlock !== null && earliestUnlock * 1000 < Date.now();

        return (
          <div className="space-y-2">
            {/* Primary verdict */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {lockedPct >= 50
                  ? <Lock className={`h-4 w-4 flex-shrink-0 ${pctColor(lockedPct)}`} />
                  : <Unlock className="h-4 w-4 flex-shrink-0 text-red-400" />
                }
                <span className={`text-sm font-semibold ${pctColor(lockedPct)}`}>
                  {lockedPct.toFixed(1)}% locked
                </span>
              </div>
              {flag && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  flag === 'RUG RISK'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {flag}
                </span>
              )}
            </div>

            {/* Label */}
            <p className={`text-xs ${pctColor(lockedPct)}`}>{label}</p>

            {/* Breakdown */}
            {(burnedPct > 0 || nonBurnedLocked > 0) && (
              <div className="space-y-1 pl-1 border-l border-gray-700">
                {burnedPct > 0 && (
                  <div className="flex items-center space-x-1.5 text-xs">
                    <Flame className="h-3 w-3 text-orange-400 flex-shrink-0" />
                    <span className="text-gray-300">{burnedPct.toFixed(1)}% burned (permanent)</span>
                  </div>
                )}
                {nonBurnedLocked > 0 && (
                  <div className="flex items-center space-x-1.5 text-xs">
                    <Lock className="h-3 w-3 text-green-400 flex-shrink-0" />
                    <span className="text-gray-300">
                      {nonBurnedLocked.toFixed(1)}% in locker contract
                      {platforms.length > 0 && (
                        <span className="text-gray-500"> ({platforms.join(', ')})</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Unlock date */}
            {earliestUnlock !== null && nonBurnedLocked > 0 && (
              <div suppressHydrationWarning className={`flex items-center space-x-1.5 text-xs ${isExpired ? 'text-red-400' : 'text-gray-400'}`}>
                <Clock className="h-3 w-3 flex-shrink-0" />
                {isExpired ? (
                  <span>Lock expired {fmtDate(earliestUnlock)} — <span className="font-medium text-red-400">LP may be withdrawable</span></span>
                ) : (
                  <span>
                    Unlocks {fmtDate(earliestUnlock)}
                    <span className="text-gray-500 ml-1">({fmtUnlockCountdown(earliestUnlock)} remaining)</span>
                  </span>
                )}
              </div>
            )}

            {/* LP holder count context */}
            {lpHolderCount > 0 && (
              <p className="text-xs text-gray-600">{lpHolderCount} LP holder{lpHolderCount !== 1 ? 's' : ''} total</p>
            )}

            {/* Unlocked LP holder risk — wallets holding >2% LP with no lock */}
            {summary.unlockedHolders.length > 0 && (
              <div className="mt-1 space-y-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-orange-400">
                  <Unlock className="h-3 w-3 flex-shrink-0" />
                  <span>Unlocked LP — rug-pull risk</span>
                </div>
                <div className="space-y-1 pl-1 border-l border-orange-500/30">
                  {(expanded ? summary.unlockedHolders : summary.unlockedHolders.slice(0, 4)).map((h) => (
                    <div key={h.address} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-gray-400 truncate">
                        {h.tag || `${h.address.slice(0, 6)}…${h.address.slice(-4)}`}
                      </span>
                      <span className={`font-semibold shrink-0 ${h.pct >= 10 ? 'text-red-400' : 'text-orange-400'}`}>
                        {h.pct.toFixed(1)}%
                        {h.pct >= 10 && (
                          <span className="ml-1 px-1 py-0.5 bg-red-500/20 rounded text-red-400">HIGH</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {!expanded && summary.unlockedHolders.length > 4 && (
                    <p className="text-gray-600">+{summary.unlockedHolders.length - 4} more unlocked holders — see Full Analysis</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  contractAddresses: ContractAddress[];
  /** When true, render all unlocked LP holders instead of top 4. Used by the analysis page. */
  expanded?: boolean;
}

export default function LiquidityLockPanel({ contractAddresses, expanded = false }: Props) {
  const enabled = useFeatureFlag('liquidityLock', false);
  if (!enabled) return null;

  const supported = contractAddresses.filter(
    ({ chain }) => !!GOPLUS_CHAIN_IDS[chain.toLowerCase()],
  );
  if (supported.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Lock className="h-4 w-4 text-gray-400" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Liquidity Lock</h3>
      </div>

      <div className="space-y-3">
        {supported.map(({ chain, address }) => (
          <ContractRow key={`${chain}:${address}`} chain={chain} address={address} expanded={expanded} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        LP lock data via GoPlus Security · No API key required
      </p>
    </div>
  );
}
