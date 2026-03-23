'use client';

import { useEffect, useState } from 'react';
import { Rocket, Clock, Loader2, ExternalLink, TrendingUp } from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';
import type { SaleData } from '@/types/sale';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number, symbol: string): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M ${symbol}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K ${symbol}`;
  return `${n.toLocaleString('en-US')} ${symbol}`;
}

function getSaleStatus(data: SaleData): 'upcoming' | 'live' | 'ended' {
  const now = Math.floor(Date.now() / 1000);
  if (now < data.startDate) return 'upcoming';
  if (now > data.endDate) return 'ended';
  return 'live';
}

function useCountdown(targetTs: number) {
  // Initialize to 0 so server and client render identically; set real value after mount.
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    setDiff(targetTs - Math.floor(Date.now() / 1000));
    const id = setInterval(() => setDiff(targetTs - Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [targetTs]);

  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'upcoming' | 'live' | 'ended' }) {
  if (status === 'live') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-2.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === 'upcoming') {
    return (
      <span className="text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full px-2.5 py-0.5">
        UPCOMING
      </span>
    );
  }
  return (
    <span className="text-xs font-medium bg-gray-600/40 text-gray-400 border border-gray-600/40 rounded-full px-2.5 py-0.5">
      ENDED
    </span>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  projectId: string | number;
  /** Optional: pre-seeded mock data for local dev (bypasses API fetch) */
  mockData?: SaleData;
}

export default function TokenSalePanel({ projectId, mockData }: Props) {
  const enabled = useFeatureFlag('tokenSale', true);
  const [data, setData] = useState<SaleData | null>(mockData ?? null);
  const [loading, setLoading] = useState(!mockData);
  // Defer status to after mount so server and client render identically.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const status = (mounted && data) ? getSaleStatus(data) : null;
  const countdown = useCountdown(data ? (status === 'upcoming' ? data.startDate : data.endDate) : 0);

  useEffect(() => {
    if (mockData || !enabled) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/projects/${projectId}/sale`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SaleData | null) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, enabled, mockData]);

  if (!enabled) return null;
  if (loading) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 flex items-center gap-3 text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading sale data…</span>
      </div>
    );
  }
  if (!data) return null;

  const pct = Math.min(100, (data.raised / data.goal) * 100);
  const pctDisplay = pct.toFixed(1);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Rocket className="h-5 w-5 text-purple-400" />
        <h3 className="font-semibold text-white">Token Sale</h3>
        {status && <StatusBadge status={status} />}
        {data.saleContract && (
          <a
            href={`https://etherscan.io/address/${data.saleContract}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-gray-500 hover:text-gray-300"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-gray-400">Raised</span>
          <span className="text-white font-medium">{pctDisplay}%</span>
        </div>
        <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          <span>{fmtCurrency(data.raised, data.currency)}</span>
          <span>{fmtCurrency(data.goal, data.currency)}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-700/40 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Token Price</p>
          <p className="text-white font-medium">${data.tokenPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</p>
        </div>
        <div className="bg-gray-700/40 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {status === 'upcoming' ? 'Starts in' : status === 'live' ? 'Ends in' : 'Ended'}
          </p>
          <p className="text-white font-medium">
            {status === 'ended' ? '—' : (countdown ?? '—')}
          </p>
        </div>
        {data.minContribution !== undefined && (
          <div className="bg-gray-700/40 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Min</p>
            <p className="text-white font-medium">{fmtCurrency(data.minContribution, data.currency)}</p>
          </div>
        )}
        {data.maxContribution !== undefined && (
          <div className="bg-gray-700/40 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Max</p>
            <p className="text-white font-medium">{fmtCurrency(data.maxContribution, data.currency)}</p>
          </div>
        )}
      </div>

      {/* Network row */}
      {data.network && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <TrendingUp className="h-3 w-3" />
          <span>Network: <span className="text-gray-300">{data.network}</span></span>
          {data.updatedAt && (
            <span className="ml-auto">
              Updated {new Date(data.updatedAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        Sale data is reported by the project owner via authenticated API. DappScore does not verify fundraising claims.
      </p>
    </div>
  );
}
