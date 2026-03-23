'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Loader2, AlertTriangle,
  DollarSign, BarChart2, Droplets, ExternalLink, Minus,
} from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';
import { getChainConfig } from '@/lib/chainAdapters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DSPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { symbol: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  volume?: { h24?: number; h6?: number; h1?: number };
  liquidity?: { usd?: number };
  txns?: { h24?: { buys: number; sells: number } };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

interface DSResponse {
  pairs: DSPair[] | null;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; pairs: DSPair[] }
  | { status: 'none' }      // no pairs found
  | { status: 'error' };

interface ContractAddress { chain: string; address: string }

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPrice(p: string | undefined): string {
  if (!p) return '—';
  const n = parseFloat(p);
  if (n >= 1000)     return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1)        return `$${n.toFixed(4)}`;
  if (n >= 0.0001)   return `$${n.toFixed(6)}`;
  return `$${n.toExponential(3)}`;
}

function pctColor(v: number): string {
  return v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400';
}

function pctIcon(v: number) {
  if (v > 0)  return <TrendingUp className="h-3.5 w-3.5" />;
  if (v < 0)  return <TrendingDown className="h-3.5 w-3.5" />;
  return <Minus className="h-3.5 w-3.5" />;
}

// ── Risk helpers ──────────────────────────────────────────────────────────────

function liquidityRisk(usd: number): { label: string; color: string; flag?: string } {
  if (usd < 10_000)    return { label: 'Very low',  color: 'text-red-400',    flag: 'RUG RISK' };
  if (usd < 50_000)    return { label: 'Low',        color: 'text-orange-400', flag: 'CAUTION' };
  if (usd < 250_000)   return { label: 'Moderate',   color: 'text-yellow-400' };
  if (usd < 1_000_000) return { label: 'Good',       color: 'text-green-400' };
  return                      { label: 'Strong',      color: 'text-green-400' };
}

function washTradingRisk(vol24: number, liq: number): boolean {
  return liq > 0 && vol24 / liq > 15;
}

function pairAgeLabel(createdAt: number): { label: string; warn: boolean } {
  const days = Math.floor((Date.now() - createdAt) / 86_400_000);
  if (days < 1)   return { label: 'Created today',     warn: true };
  if (days < 7)   return { label: `${days}d old pair`, warn: true };
  if (days < 30)  return { label: `${days}d old pair`, warn: false };
  if (days < 365) return { label: `${Math.floor(days / 30)}mo old pair`, warn: false };
  return                 { label: `${Math.floor(days / 365)}yr old pair`, warn: false };
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchPairs(address: string, dsChainId: string): Promise<DSPair[]> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${address}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error('DexScreener error');
  const data = await res.json() as DSResponse;
  const pairs = (data.pairs ?? []).filter(
    (p) => p.chainId.toLowerCase() === dsChainId.toLowerCase(),
  );
  // Sort by liquidity descending
  return pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
}

// ── Single contract row ───────────────────────────────────────────────────────

function ContractRow({ chain, address }: ContractAddress) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const dsChainId = getChainConfig(chain)?.dexscreenerId;

  useEffect(() => {
    if (!dsChainId) { setState({ status: 'none' }); return; }
    setState({ status: 'loading' });
    fetchPairs(address, dsChainId)
      .then((pairs) => setState(pairs.length ? { status: 'ok', pairs } : { status: 'none' }))
      .catch(() => setState({ status: 'error' }));
  }, [address, dsChainId]);

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-3">
      {/* Chain label */}
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>

      {state.status === 'loading' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Fetching DEX data…</span>
        </div>
      )}
      {state.status === 'error' && (
        <span className="text-xs text-gray-500">Unable to fetch DEX data</span>
      )}
      {state.status === 'none' && (
        <span className="text-sm text-gray-500">No DEX pairs found</span>
      )}

      {state.status === 'ok' && (() => {
        const top = state.pairs[0];
        const liq = top.liquidity?.usd ?? 0;
        const vol24 = top.volume?.h24 ?? 0;
        const ch24 = top.priceChange?.h24 ?? 0;
        const ch1  = top.priceChange?.h1  ?? 0;
        const buys  = top.txns?.h24?.buys  ?? 0;
        const sells = top.txns?.h24?.sells ?? 0;
        const total = buys + sells;
        const liqRisk = liquidityRisk(liq);
        const washRisk = washTradingRisk(vol24, liq);
        const age = top.pairCreatedAt ? pairAgeLabel(top.pairCreatedAt) : null;

        return (
          <div className="space-y-3">
            {/* Price + DEX */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{fmtPrice(top.priceUsd)}</div>
                <div className="text-xs text-gray-500 capitalize">{top.dexId} · {top.baseToken.symbol}/{top.quoteToken.symbol}</div>
              </div>
              <a
                href={top.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span>DexScreener</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              {/* Liquidity */}
              <div className="bg-gray-700/50 rounded-lg p-2">
                <div className="flex items-center space-x-1 mb-1">
                  <Droplets className="h-3 w-3 text-gray-500" />
                  <span className="text-xs text-gray-500">Liquidity</span>
                </div>
                <div className={`text-sm font-medium ${liqRisk.color}`}>{fmtUsd(liq)}</div>
                <div className={`text-xs ${liqRisk.color}`}>{liqRisk.label}</div>
              </div>

              {/* 24h Volume */}
              <div className="bg-gray-700/50 rounded-lg p-2">
                <div className="flex items-center space-x-1 mb-1">
                  <BarChart2 className="h-3 w-3 text-gray-500" />
                  <span className="text-xs text-gray-500">Vol 24h</span>
                </div>
                <div className="text-sm font-medium">{fmtUsd(vol24)}</div>
                {total > 0 && (
                  <div className="text-xs text-gray-500">{buys}B / {sells}S</div>
                )}
              </div>

              {/* Price change */}
              <div className="bg-gray-700/50 rounded-lg p-2">
                <div className="flex items-center space-x-1 mb-1">
                  <DollarSign className="h-3 w-3 text-gray-500" />
                  <span className="text-xs text-gray-500">Change</span>
                </div>
                <div className={`flex items-center space-x-0.5 text-sm font-medium ${pctColor(ch24)}`}>
                  {pctIcon(ch24)}
                  <span>{Math.abs(ch24).toFixed(1)}%</span>
                </div>
                <div className={`text-xs ${pctColor(ch1)}`}>
                  {ch1 >= 0 ? '+' : ''}{ch1.toFixed(1)}% 1h
                </div>
              </div>
            </div>

            {/* FDV / Market Cap */}
            {(top.fdv || top.marketCap) && (
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                {top.marketCap && <span>Market Cap: <span className="text-gray-300">{fmtUsd(top.marketCap)}</span></span>}
                {top.fdv && <span>FDV: <span className="text-gray-300">{fmtUsd(top.fdv)}</span></span>}
              </div>
            )}

            {/* Risk flags */}
            <div className="space-y-1">
              {liqRisk.flag && (
                <div className="flex items-center space-x-1.5 text-xs">
                  <AlertTriangle className={`h-3 w-3 ${liqRisk.color}`} />
                  <span className={liqRisk.color}>Liquidity {fmtUsd(liq)} — {liqRisk.flag}</span>
                </div>
              )}
              {washRisk && (
                <div className="flex items-center space-x-1.5 text-xs text-orange-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Vol/Liq ratio {(vol24 / liq).toFixed(0)}× — possible wash trading</span>
                </div>
              )}
              {age?.warn && (
                <div className="flex items-center space-x-1.5 text-xs text-orange-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{age.label} — new pair, higher risk</span>
                </div>
              )}
              {!age?.warn && age && (
                <div className="text-xs text-gray-600">{age.label}</div>
              )}
            </div>

            {/* More pairs note */}
            {state.pairs.length > 1 && (
              <div className="text-xs text-gray-600">
                +{state.pairs.length - 1} more pair{state.pairs.length > 2 ? 's' : ''} on this chain
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
}

export default function DexLiquidityPanel({ contractAddresses }: Props) {
  const enabled = useFeatureFlag('dexLiquidity', false);
  if (!enabled) return null;

  const supported = contractAddresses.filter(({ chain }) => !!getChainConfig(chain)?.dexscreenerId);
  if (supported.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <TrendingUp className="h-4 w-4 text-gray-400" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">DEX Liquidity</h3>
      </div>

      <div className="space-y-3">
        {supported.map(({ chain, address }) => (
          <ContractRow key={`${chain}:${address}`} chain={chain} address={address} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Data via DexScreener · No API key required · Not financial advice
      </p>
    </div>
  );
}
