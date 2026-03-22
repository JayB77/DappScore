'use client';

import { useEffect, useState } from 'react';
import {
  Lock, Unlock, Clock, Loader2,
  HelpCircle, Flame, AlertTriangle, ExternalLink, ShieldCheck,
} from 'lucide-react';
import SectionInsight, { type Insight } from '@/components/SectionInsight';
import { useFeatureFlag } from '@/lib/featureFlags';
import { getChainConfig, getExplorerUrl } from '@/lib/chainAdapters';

const DEAD_ADDRESSES = new Set([
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000000000',
]);

// Known locker platforms → homepage/locker page URL for one-click verification
const PLATFORM_URLS: Record<string, string> = {
  'pinklock':       'https://www.pinksale.finance/pinklock',
  'pinksale':       'https://www.pinksale.finance/pinklock',
  'pink':           'https://www.pinksale.finance/pinklock',
  'uncx':           'https://app.uncx.network/',
  'unicrypt':       'https://app.uncx.network/',
  'univ3':          'https://app.uncx.network/',
  'team.finance':   'https://team.finance/',
  'teamfinance':    'https://team.finance/',
  'team finance':   'https://team.finance/',
  'mudra':          'https://mudra.website/',
  'dxsale':         'https://www.dxsale.io/',
  'dxlock':         'https://www.dxsale.io/',
  'flokifi':        'https://locker.floki.com/',
  'floki':          'https://locker.floki.com/',
  'gempad':         'https://gempad.app/',
  'covalent':       'https://www.covalenthq.com/',
  'liquidity guard':'https://liquidityguard.io/',
};

function platformUrl(tag: string): string | null {
  return PLATFORM_URLS[tag.toLowerCase()] ?? null;
}

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
  tag: string;
  pct: number;
  isContract: boolean;
}

export type ExpiryRisk =
  | 'expired'    // end_time < now
  | 'critical'   // ≤ 7 days
  | 'warning'    // ≤ 30 days
  | 'caution'    // ≤ 90 days
  | 'safe'       // > 90 days
  | 'burned'     // dead address
  | 'unknown';   // no end_time

interface SubLock {
  amount: string;   // token amount (raw)
  expiresAt: number; // unix seconds
}

interface LockEntry {
  platform: string;         // e.g. "PinkLock"
  address: string;          // locker contract address (for explorer link)
  pct: number;              // % of LP in this entry
  subLocks: SubLock[];      // individual lock instances from locked_detail
  earliestExpiry: number | null;
  expiryRisk: ExpiryRisk;
  burned: boolean;
}

interface LockSummary {
  lockedPct: number;
  burnedPct: number;
  lockEntries: LockEntry[];
  /** Sum of LP % held in expired or near-expiry (≤30d) locks — for the warning banner. */
  nearExpiryPct: number;
  /** Days until the soonest upcoming non-burned lock expiry (null = none). */
  nearestExpiryDays: number | null;
  lpHolderCount: number;
  unlockedHolders: UnlockedHolder[];
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

function classifyExpiry(ts: number | null, burned: boolean): ExpiryRisk {
  if (burned) return 'burned';
  if (ts === null) return 'unknown';
  const daysLeft = (ts * 1000 - Date.now()) / 86_400_000;
  if (daysLeft <= 0)  return 'expired';
  if (daysLeft <= 7)  return 'critical';
  if (daysLeft <= 30) return 'warning';
  if (daysLeft <= 90) return 'caution';
  return 'safe';
}

const EXPIRY_RISK_STYLES: Record<ExpiryRisk, {
  badge: string; text: string; icon: string;
}> = {
  expired:  { badge: 'bg-red-500/20 text-red-400',        text: 'text-red-400',     icon: 'text-red-400' },
  critical: { badge: 'bg-red-500/20 text-red-400',        text: 'text-red-400',     icon: 'text-red-400' },
  warning:  { badge: 'bg-orange-500/20 text-orange-400',  text: 'text-orange-400',  icon: 'text-orange-400' },
  caution:  { badge: 'bg-yellow-500/20 text-yellow-400',  text: 'text-yellow-400',  icon: 'text-yellow-400' },
  safe:     { badge: 'bg-green-500/20 text-green-400',    text: 'text-green-400',   icon: 'text-green-400' },
  burned:   { badge: 'bg-orange-500/20 text-orange-400',  text: 'text-orange-400',  icon: 'text-orange-400' },
  unknown:  { badge: 'bg-gray-700 text-gray-400',         text: 'text-gray-500',    icon: 'text-gray-500' },
};

function expiryBadgeLabel(risk: ExpiryRisk, ts: number | null): string {
  if (risk === 'burned')  return 'PERMANENT';
  if (risk === 'unknown') return 'NO EXPIRY';
  if (risk === 'expired') return 'EXPIRED';
  if (ts === null) return '?';
  const daysLeft = Math.ceil((ts * 1000 - Date.now()) / 86_400_000);
  if (daysLeft < 30)  return `${daysLeft}d`;
  if (daysLeft < 365) return `${Math.floor(daysLeft / 30)}mo`;
  const yrs = Math.floor(daysLeft / 365);
  const mos = Math.floor((daysLeft % 365) / 30);
  return mos > 0 ? `${yrs}yr ${mos}mo` : `${yrs}yr`;
}

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
  let nearExpiryPct = 0;
  let nearestExpiryDays: number | null = null;
  const lockEntries: LockEntry[] = [];
  const unlockedHolders: UnlockedHolder[] = [];

  for (const h of holders) {
    const pct    = parseFloat(h.percent) * 100;
    const isDead = DEAD_ADDRESSES.has(h.address.toLowerCase());

    if (isDead) {
      burnedPct += pct;
      lockedPct += pct;
      lockEntries.push({
        platform:       'Burned',
        address:        h.address,
        pct,
        subLocks:       [],
        earliestExpiry: null,
        expiryRisk:     'burned',
        burned:         true,
      });
    } else if (h.is_locked === 1) {
      lockedPct += pct;

      // Build sub-locks from locked_detail
      const subLocks: SubLock[] = (h.locked_detail ?? [])
        .map(d => ({ amount: d.amount, expiresAt: parseInt(d.end_time, 10) }))
        .filter(s => s.expiresAt > 0);

      // Earliest expiry for this locker entry
      let earliestExpiry: number | null = null;
      for (const s of subLocks) {
        if (earliestExpiry === null || s.expiresAt < earliestExpiry) {
          earliestExpiry = s.expiresAt;
        }
      }

      const risk = classifyExpiry(earliestExpiry, false);

      // Accumulate near-expiry stats (expired or ≤30d)
      if (risk === 'expired' || risk === 'critical' || risk === 'warning') {
        nearExpiryPct += pct;
      }

      // Track nearest upcoming expiry (future locks only)
      if (earliestExpiry !== null && earliestExpiry * 1000 > Date.now()) {
        const daysLeft = Math.ceil((earliestExpiry * 1000 - Date.now()) / 86_400_000);
        if (nearestExpiryDays === null || daysLeft < nearestExpiryDays) {
          nearestExpiryDays = daysLeft;
        }
      }

      lockEntries.push({
        platform:   h.tag || 'Unknown',
        address:    h.address,
        pct,
        subLocks,
        earliestExpiry,
        expiryRisk: risk,
        burned:     false,
      });
    } else {
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

  unlockedHolders.sort((a, b) => b.pct - a.pct);

  // Sort lock entries: worst risk first (expired → critical → warning → ...), then by pct
  const riskOrder: Record<ExpiryRisk, number> = {
    expired: 0, critical: 1, warning: 2, caution: 3, safe: 4, unknown: 5, burned: 6,
  };
  lockEntries.sort((a, b) => {
    const rd = riskOrder[a.expiryRisk] - riskOrder[b.expiryRisk];
    return rd !== 0 ? rd : b.pct - a.pct;
  });

  // Extract pair addresses from GoPlus dex field
  const dexList = Array.isArray(token.dex)
    ? (token.dex as Array<{ pair?: string }>)
    : [];
  const pairAddresses = dexList.map(d => d.pair ?? '').filter(Boolean);

  return {
    lockedPct:        Math.min(lockedPct, 100),
    burnedPct:        Math.min(burnedPct, 100),
    lockEntries,
    nearExpiryPct:    Math.min(nearExpiryPct, 100),
    nearestExpiryDays,
    lpHolderCount,
    unlockedHolders,
    pairAddresses,
  };
}

// ── Lock entry row ────────────────────────────────────────────────────────────

function LockEntryRow({
  entry,
  chain,
  expanded,
}: {
  entry: LockEntry;
  chain: string;
  expanded: boolean;
}) {
  const [showSubs, setShowSubs] = useState(false);
  const s = EXPIRY_RISK_STYLES[entry.expiryRisk];
  const badgeLabel = expiryBadgeLabel(entry.expiryRisk, entry.earliestExpiry);
  const explorerUrl = getExplorerUrl(chain, entry.address);
  const pUrl = entry.burned ? null : platformUrl(entry.platform);

  // Sub-locks to show (skip if only one — the summary row already conveys it)
  const hasMultiSubs = entry.subLocks.length > 1 && !entry.burned;

  return (
    <div>
      <div className="flex items-center gap-2 py-1">
        {/* Icon */}
        {entry.burned
          ? <Flame className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
          : entry.expiryRisk === 'expired' || entry.expiryRisk === 'critical'
            ? <Unlock className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
            : <Lock className={`h-3.5 w-3.5 flex-shrink-0 ${s.icon}`} />
        }

        {/* Platform name */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {pUrl ? (
            <a
              href={pUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-200 hover:text-white font-medium flex items-center gap-0.5 truncate transition-colors"
            >
              {entry.platform}
              <ExternalLink className="h-2.5 w-2.5 opacity-50 flex-shrink-0" />
            </a>
          ) : (
            <span className="text-sm text-gray-300 font-medium truncate">{entry.platform}</span>
          )}
          {explorerUrl && !entry.burned && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
              title="View locker contract on explorer"
            >
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>

        {/* LP % */}
        <span className={`text-sm font-semibold flex-shrink-0 ${s.text}`}>
          {entry.pct.toFixed(1)}%
        </span>

        {/* Expiry badge */}
        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${s.badge}`}>
          {badgeLabel}
        </span>

        {/* Toggle sub-locks */}
        {hasMultiSubs && (expanded || entry.expiryRisk !== 'safe') && (
          <button
            onClick={() => setShowSubs(v => !v)}
            className="text-xs text-gray-600 hover:text-gray-400 flex-shrink-0"
          >
            {showSubs ? '▲' : `▼${entry.subLocks.length}`}
          </button>
        )}
      </div>

      {/* Sub-lock detail */}
      {showSubs && hasMultiSubs && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-gray-700 pl-2">
          {entry.subLocks
            .slice()
            .sort((a, b) => a.expiresAt - b.expiresAt)
            .map((s, i) => {
              const sr = classifyExpiry(s.expiresAt, false);
              const ss = EXPIRY_RISK_STYLES[sr];
              return (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-500">
                    {s.expiresAt * 1000 < Date.now()
                      ? 'Expired ' + fmtDate(s.expiresAt)
                      : 'Unlocks ' + fmtDate(s.expiresAt)
                    }
                  </span>
                  <span className={`px-1 py-0.5 rounded text-xs font-semibold ${ss.badge}`}>
                    {expiryBadgeLabel(sr, s.expiresAt)}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ── Single contract row ───────────────────────────────────────────────────────

function ContractRow({ chain, address, expanded = false }: ContractAddress & { expanded?: boolean }) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const chainId = getChainConfig(chain)?.goplusId;

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
        const {
          lockedPct, burnedPct, lockEntries, nearExpiryPct,
          nearestExpiryDays, lpHolderCount,
        } = summary;
        const { label, flag } = lockLabel(lockedPct);
        const nonBurnedLocked = lockedPct - burnedPct;

        // Effective locked% if we discount near-expiry locks (for context)
        const effectivePct = Math.max(0, lockedPct - nearExpiryPct);

        // Near-expiry warning: only show if nearExpiryPct is meaningful (>5%)
        const showNearExpiryWarning = nearExpiryPct >= 5;

        return (
          <div className="space-y-2">
            {/* ── Near-expiry warning banner ───────────────────────────── */}
            {showNearExpiryWarning && (
              <div className={`flex items-start gap-1.5 rounded px-2 py-1.5 text-xs border ${
                nearestExpiryDays !== null && nearestExpiryDays <= 7
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
              }`}>
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{nearExpiryPct.toFixed(1)}% of LP</strong>{' '}
                  {nearestExpiryDays !== null && nearestExpiryDays <= 0
                    ? 'lock has expired — LP may be withdrawable'
                    : nearestExpiryDays !== null
                      ? `unlocks in ${nearestExpiryDays}d — nearly as bad as no lock`
                      : 'lock is expired or expiring soon'
                  }
                  {effectivePct < 50 && lockedPct >= 50 && (
                    <span className="block mt-0.5 text-gray-400">
                      Effective locked % after expiry: <strong className="text-orange-400">{effectivePct.toFixed(1)}%</strong>
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* ── Primary verdict ──────────────────────────────────────── */}
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

            <p className={`text-xs ${pctColor(lockedPct)}`}>{label}</p>

            {/* ── Per-lock breakdown ───────────────────────────────────── */}
            {lockEntries.length === 0 ? (
              nonBurnedLocked === 0 && burnedPct === 0 ? null : null
            ) : (
              <div className="mt-1 space-y-0">
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-semibold">
                  Lock detail
                </p>
                <div className="border-l border-gray-700 pl-2 space-y-0.5">
                  {lockEntries.map((entry, i) => (
                    <LockEntryRow
                      key={`${entry.address}-${i}`}
                      entry={entry}
                      chain={chain}
                      expanded={expanded}
                    />
                  ))}
                </div>

                {/* Verification nudge for safe locks */}
                {lockEntries.some(e => !e.burned && e.expiryRisk === 'safe') && (
                  <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Click platform name to verify lock on-chain</span>
                  </div>
                )}
              </div>
            )}

            {/* ── LP holder count ──────────────────────────────────────── */}
            {lpHolderCount > 0 && (
              <p className="text-xs text-gray-600">
                {lpHolderCount} LP holder{lpHolderCount !== 1 ? 's' : ''} total
              </p>
            )}

            {/* ── Unlocked LP holder risk ──────────────────────────────── */}
            {summary.unlockedHolders.length > 0 && (
              <div className="mt-1 space-y-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-orange-400">
                  <Unlock className="h-3 w-3 flex-shrink-0" />
                  <span>Unlocked LP — rug-pull risk</span>
                </div>
                <div className="space-y-1 pl-1 border-l border-orange-500/30">
                  {(expanded
                    ? summary.unlockedHolders
                    : summary.unlockedHolders.slice(0, 4)
                  ).map((h) => (
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
                    <p className="text-gray-600">
                      +{summary.unlockedHolders.length - 4} more unlocked holders — see Full Analysis
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Plain English insight ─────────────────────────────────── */}
            {(() => {
              const list: Insight[] = [];

              if (lockedPct === 0) {
                list.push({ level: 'critical', text: 'No liquidity is locked. The team can remove all trading liquidity at any moment, instantly making your tokens worthless and unsellable (rug pull).' });
              } else if (lockedPct < 50) {
                list.push({ level: 'warning', text: `Only ${lockedPct.toFixed(1)}% of liquidity is locked — the remaining ${(100 - lockedPct).toFixed(1)}% can be removed by the team at any time, collapsing the ability to trade.` });
              } else if (lockedPct < 80) {
                list.push({ level: 'caution', text: `${lockedPct.toFixed(1)}% of liquidity is locked. The unlocked ${(100 - lockedPct).toFixed(1)}% remains withdrawable by the team.` });
              } else {
                list.push({ level: 'safe', text: `${lockedPct.toFixed(1)}% of liquidity is locked, providing strong protection against a sudden liquidity removal.` });
              }

              if (nearestExpiryDays !== null && nearestExpiryDays > 0 && nearestExpiryDays <= 30) {
                const lvl = nearestExpiryDays <= 7 ? 'critical' as const : 'warning' as const;
                list.push({ level: lvl, text: `The earliest lock expires in ${nearestExpiryDays} day${nearestExpiryDays !== 1 ? 's' : ''}. After expiry the team can withdraw that portion of liquidity, making selling difficult or impossible.` });
              } else if (nearestExpiryDays !== null && nearestExpiryDays <= 0) {
                list.push({ level: 'critical', text: 'A liquidity lock has already expired. The team can withdraw that portion right now.' });
              }

              if (burnedPct > 0) {
                list.push({ level: 'safe', text: `${burnedPct.toFixed(1)}% of LP tokens have been permanently burned — that portion of liquidity can never be removed, even by the team.` });
              }

              return <SectionInsight insights={list} className="mt-2" />;
            })()}
          </div>
        );
      })()}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  contractAddresses: ContractAddress[];
  expanded?: boolean;
}

export default function LiquidityLockPanel({ contractAddresses, expanded = false }: Props) {
  const enabled = useFeatureFlag('liquidityLock', false);
  if (!enabled) return null;

  const supported = contractAddresses.filter(({ chain }) => !!getChainConfig(chain)?.goplusId);
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
        LP lock data via GoPlus Security · Verify locks on Unicrypt / PinkLock / Team.Finance directly
      </p>
    </div>
  );
}
