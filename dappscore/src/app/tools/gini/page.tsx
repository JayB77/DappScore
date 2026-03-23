'use client';

import { useState } from 'react';
import { BarChart3, Loader2, Search, ExternalLink, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { getChainConfig } from '@/lib/chainAdapters';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Holder {
  address: string;
  share: number; // 0–100
}

interface HolderData {
  holders: Holder[];
  holdersCount: number;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: HolderData; address: string; chain: string }
  | { status: 'error'; message: string }
  | { status: 'no-key' }
  | { status: 'unsupported' };

// ── Moralis chain IDs (same mapping as TokenDistributionPanel) ────────────────

const MORALIS_CHAIN_ID: Record<string, string> = {
  ethereum: 'eth', eth: 'eth',
  base: 'base',
  bsc: 'bsc', bnb: 'bsc', 'bnb chain': 'bsc', 'bnb smart chain': 'bsc',
  polygon: 'polygon', matic: 'polygon',
  arbitrum: 'arbitrum', 'arbitrum one': 'arbitrum',
  optimism: 'optimism', 'op mainnet': 'optimism',
  avalanche: 'avalanche', avax: 'avalanche',
  fantom: 'fantom', ftm: 'fantom',
  linea: 'linea', blast: 'blast', scroll: 'scroll', zksync: 'zksync-era', 'zksync era': 'zksync-era',
  mantle: 'mantle', celo: 'celo', gnosis: 'gnosis',
};

// ── Chain options for dropdown ────────────────────────────────────────────────

const CHAIN_OPTIONS = [
  { value: 'base',     label: 'Base' },
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'bsc',      label: 'BNB Chain' },
  { value: 'polygon',  label: 'Polygon' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'optimism', label: 'Optimism' },
  { value: 'avalanche',label: 'Avalanche' },
  { value: 'solana',   label: 'Solana' },
  { value: 'tron',     label: 'Tron' },
  { value: 'ton',      label: 'TON' },
  { value: 'near',     label: 'NEAR' },
];

// ── Fetchers (same API calls as TokenDistributionPanel) ───────────────────────

async function fetchEvmHolders(moralisId: string, address: string, apiKey: string): Promise<HolderData> {
  const res = await fetch(
    `https://deep-index.moralis.io/api/v2.2/erc20/${address}/owners?chain=${moralisId}&limit=20&order=DESC`,
    { headers: { 'X-API-Key': apiKey } },
  );
  if (!res.ok) throw new Error(`Moralis ${res.status}`);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holders: Holder[] = (data.result ?? []).map((h: any) => ({
    address: h.owner_address as string,
    share: parseFloat(h.percentage_relative_to_total_supply ?? '0'),
  }));
  return { holders, holdersCount: data.total ?? 0 };
}

async function fetchSolanaHolders(mint: string, apiKey: string): Promise<HolderData> {
  const res = await fetch(
    `https://solana-gateway.moralis.io/token/mainnet/${mint}/top-holders?limit=20`,
    { headers: { 'X-API-Key': apiKey } },
  );
  if (!res.ok) throw new Error(`Moralis Solana ${res.status}`);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holders: Holder[] = (data.result ?? []).map((h: any) => ({
    address: h.owner_address as string,
    share: parseFloat(h.percentage_relative_to_total_supply ?? '0'),
  }));
  return { holders, holdersCount: data.total ?? 0 };
}

async function fetchTronHolders(contractAddress: string): Promise<HolderData> {
  const res = await fetch(
    `https://apilist.tronscanapi.com/api/token_trc20/holders?contractAddress=${contractAddress}&limit=20&start=0`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`TronScan ${res.status}`);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holders: Holder[] = (data.trc20_tokens ?? []).map((h: any) => ({
    address: h.address as string,
    share: parseFloat(h.percentage ?? '0'),
  }));
  return { holders, holdersCount: data.total ?? 0 };
}

async function fetchTonHolders(jettonAddress: string): Promise<HolderData> {
  const metaRes = await fetch(
    `https://toncenter.com/api/v3/jetton/masters?address=${jettonAddress}&limit=1`,
    { headers: { Accept: 'application/json' } },
  );
  if (!metaRes.ok) throw new Error(`TonCenter ${metaRes.status}`);
  const metaData = await metaRes.json();
  const totalSupply = BigInt(metaData.jetton_masters?.[0]?.total_supply ?? '0');

  const holdersRes = await fetch(
    `https://toncenter.com/api/v3/jetton/wallets?jetton_address=${jettonAddress}&limit=20&sort=balance&direction=desc`,
    { headers: { Accept: 'application/json' } },
  );
  if (!holdersRes.ok) throw new Error(`TonCenter holders ${holdersRes.status}`);
  const holdersData = await holdersRes.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holders: Holder[] = (holdersData.jetton_wallets ?? []).map((w: any) => {
    const balance = BigInt(w.balance ?? '0');
    const share = totalSupply > BigInt(0) ? Number((balance * BigInt(10000)) / totalSupply) / 100 : 0;
    return { address: w.owner as string, share };
  });
  return { holders, holdersCount: holdersData.total ?? 0 };
}

async function fetchNearHolders(contractId: string): Promise<HolderData> {
  const [topRes, metaRes] = await Promise.all([
    fetch(`https://api.fastnear.com/v1/ft/${contractId}/top`),
    fetch(`https://api.nearblocks.io/v1/fts/${contractId}`),
  ]);
  if (!topRes.ok) throw new Error(`FastNEAR ${topRes.status}`);
  const topData = await topRes.json();
  const metaData = metaRes.ok ? await metaRes.json() : null;
  const totalSupply = BigInt(metaData?.contracts?.[0]?.total_supply ?? '0');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holders: Holder[] = (topData.accounts ?? []).slice(0, 20).map((a: any) => {
    const balance = BigInt(a.balance ?? '0');
    const share = totalSupply > BigInt(0) ? Number((balance * BigInt(10000)) / totalSupply) / 100 : 0;
    return { address: a.account_id as string, share };
  });
  return { holders, holdersCount: topData.total_count ?? 0 };
}

// ── Gini coefficient ───────────────────────────────────────────────────────────

/**
 * Compute the Gini coefficient from an array of shares (0–100).
 * Uses the standard discrete formula: G = 1 − (2 * area under Lorenz curve).
 * Returns 0 (perfect equality) → 1 (total inequality).
 */
function computeGini(shares: number[]): number {
  if (shares.length === 0) return 0;
  const sorted = [...shares].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  if (sum === 0) return 0;
  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return Math.abs(numerator) / (n * sum);
}

// ── Lorenz curve SVG ─────────────────────────────────────────────────────────

function LorenzCurve({ holders }: { holders: Holder[] }) {
  if (holders.length < 2) return null;

  const sorted = [...holders].sort((a, b) => a.share - b.share);
  const totalShare = sorted.reduce((s, h) => s + h.share, 0) || 1;
  const n = sorted.length;

  // Build Lorenz curve points: (cumulative % of population, cumulative % of wealth)
  const points: [number, number][] = [[0, 0]];
  let cumShare = 0;
  for (let i = 0; i < n; i++) {
    cumShare += sorted[i].share;
    points.push([(i + 1) / n, cumShare / totalShare]);
  }

  const W = 280;
  const H = 180;
  const PAD = 28;

  const toSvg = (x: number, y: number) => ({
    cx: PAD + x * (W - PAD * 2),
    // y=0 at bottom, y=1 at top in chart space
    cy: H - PAD - y * (H - PAD * 2),
  });

  const lorenzPath = points
    .map(([x, y], i) => {
      const { cx, cy } = toSvg(x, y);
      return `${i === 0 ? 'M' : 'L'}${cx.toFixed(1)},${cy.toFixed(1)}`;
    })
    .join(' ');

  const { cx: x0, cy: y0 } = toSvg(0, 0);
  const { cx: x1, cy: y1 } = toSvg(1, 1);
  const equalityLine = `M${x0.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)}`;

  // Fill between equality line and Lorenz curve
  const fillPath = [
    `M${x0.toFixed(1)},${y0.toFixed(1)}`,
    `L${x1.toFixed(1)},${y1.toFixed(1)}`,
    // reverse along Lorenz curve
    ...points
      .slice()
      .reverse()
      .map(([x, y]) => {
        const { cx, cy } = toSvg(x, y);
        return `L${cx.toFixed(1)},${cy.toFixed(1)}`;
      }),
    'Z',
  ].join(' ');

  return (
    <svg width={W} height={H} className="w-full h-auto">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(v => {
        const { cx: gx } = toSvg(v, 0);
        const { cy: gy } = toSvg(0, v);
        return (
          <g key={v}>
            <line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke="#374151" strokeWidth="1" strokeDasharray="3,3" />
            <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="#374151" strokeWidth="1" strokeDasharray="3,3" />
          </g>
        );
      })}
      {/* Gini fill area */}
      <path d={fillPath} fill="rgba(239,68,68,0.15)" />
      {/* Equality line (45°) */}
      <path d={equalityLine} stroke="#6b7280" strokeWidth="1.5" strokeDasharray="5,4" fill="none" />
      {/* Lorenz curve */}
      <path d={lorenzPath} stroke="#eab308" strokeWidth="2" fill="none" strokeLinejoin="round" />
      {/* Axis labels */}
      <text x={PAD} y={H - 6} fill="#6b7280" fontSize="9" textAnchor="middle">0%</text>
      <text x={W - PAD} y={H - 6} fill="#6b7280" fontSize="9" textAnchor="middle">100%</text>
      <text x={8} y={H - PAD} fill="#6b7280" fontSize="9" textAnchor="middle">0%</text>
      <text x={8} y={PAD} fill="#6b7280" fontSize="9" textAnchor="middle">100%</text>
      {/* Legend */}
      <g transform={`translate(${PAD + 6},${PAD + 6})`}>
        <line x1="0" y1="5" x2="14" y2="5" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x="18" y="9" fill="#9ca3af" fontSize="9">Equal distribution</text>
        <line x1="0" y1="19" x2="14" y2="19" stroke="#eab308" strokeWidth="2" />
        <text x="18" y="23" fill="#9ca3af" fontSize="9">Actual distribution</text>
      </g>
    </svg>
  );
}

// ── Gini gauge ───────────────────────────────────────────────────────────────

function GiniGauge({ gini }: { gini: number }) {
  const pct = gini * 100;
  const color =
    gini < 0.4 ? 'text-green-400' :
    gini < 0.6 ? 'text-yellow-400' :
    gini < 0.8 ? 'text-orange-400' :
                 'text-red-400';
  const barColor =
    gini < 0.4 ? 'bg-green-500' :
    gini < 0.6 ? 'bg-yellow-500' :
    gini < 0.8 ? 'bg-orange-500' :
                 'bg-red-500';
  const label =
    gini < 0.4 ? 'Well Distributed' :
    gini < 0.6 ? 'Moderate Concentration' :
    gini < 0.8 ? 'High Concentration' :
                 'Extreme Concentration';

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Gini Coefficient</p>
          <span className={`text-4xl font-bold tabular-nums ${color}`}>{gini.toFixed(3)}</span>
        </div>
        <span className={`text-sm font-semibold ${color} pb-1`}>{label}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>0 — Perfect equality</span>
        <span>1 — One holder owns all</span>
      </div>
    </div>
  );
}

// ── Concentration metrics ─────────────────────────────────────────────────────

function concentrationColor(pct: number): string {
  if (pct > 50) return 'text-red-400';
  if (pct > 30) return 'text-orange-400';
  if (pct > 15) return 'text-yellow-400';
  return 'text-green-400';
}

// ── Known addresses ───────────────────────────────────────────────────────────

const KNOWN_LABELS: Record<string, string> = {
  '0x0000000000000000000000000000000000000000': 'Burn Address',
  '0x000000000000000000000000000000000000dead': 'Burn Address',
  '1nc1nerator11111111111111111111111111111124': 'Incinerator',
};

function shortAddr(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function barFill(pct: number): string {
  if (pct > 20) return 'bg-red-500';
  if (pct > 10) return 'bg-orange-500';
  if (pct > 5)  return 'bg-yellow-500';
  return 'bg-gray-500';
}

function shareColor(pct: number): string {
  if (pct > 20) return 'text-red-400';
  if (pct > 10) return 'text-orange-400';
  if (pct > 5)  return 'text-yellow-400';
  return 'text-gray-300';
}

// ── Explorer URLs (reuse same config as TokenDistributionPanel) ───────────────

const EXP_ADDRESS: Record<string, (a: string) => string> = {
  moralis: a => `https://etherscan.io/address/${a}`,
  solana:  a => `https://solscan.io/account/${a}`,
  tron:    a => `https://tronscan.org/#/address/${a}`,
  ton:     a => `https://tonscan.org/address/${a}`,
  near:    a => `https://nearblocks.io/address/${a}`,
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GiniPage() {
  const [address, setAddress]   = useState('');
  const [chain, setChain]       = useState('base');
  const [state, setState]       = useState<State>({ status: 'idle' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;

    const addr  = address.trim();
    const cfg   = getChainConfig(chain);
    if (!cfg) { setState({ status: 'unsupported' }); return; }

    setState({ status: 'loading' });
    try {
      let data: HolderData;

      if (chain === 'near') {
        data = await fetchNearHolders(addr);
      } else if (cfg.family === 'tron') {
        data = await fetchTronHolders(addr);
      } else if (cfg.family === 'ton') {
        data = await fetchTonHolders(addr);
      } else if (cfg.family === 'solana') {
        const apiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
        if (!apiKey) { setState({ status: 'no-key' }); return; }
        data = await fetchSolanaHolders(addr, apiKey);
      } else if (cfg.family === 'evm') {
        const apiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
        if (!apiKey) { setState({ status: 'no-key' }); return; }
        const moralisId = MORALIS_CHAIN_ID[chain];
        if (!moralisId) { setState({ status: 'unsupported' }); return; }
        data = await fetchEvmHolders(moralisId, addr, apiKey);
      } else {
        setState({ status: 'unsupported' }); return;
      }

      setState({ status: 'ok', data, address: addr, chain });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to fetch holder data',
      });
    }
  }

  const explorerType =
    state.status === 'ok'
      ? (() => {
          const c = getChainConfig(state.chain);
          if (!c) return 'moralis';
          if (c.family === 'solana')     return 'solana';
          if (c.family === 'tron')       return 'tron';
          if (c.family === 'ton')        return 'ton';
          if (state.chain === 'near')    return 'near';
          return 'moralis';
        })()
      : 'moralis';

  const explorerBase =
    state.status === 'ok'
      ? (() => {
          const c = getChainConfig(state.chain);
          return c?.explorerBase ?? 'https://etherscan.io';
        })()
      : 'https://etherscan.io';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <BarChart3 className="h-7 w-7 text-green-400" />
          <h1 className="text-2xl font-bold text-white">Holder Distribution</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Analyse token supply concentration. The Gini coefficient measures how evenly tokens are distributed — 0 is perfectly equal, 1 means one wallet owns everything.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={chain}
            onChange={e => setChain(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500 sm:w-40 flex-shrink-0"
          >
            {CHAIN_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Token / contract address…"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
          />
          <button
            type="submit"
            disabled={!address.trim() || state.status === 'loading'}
            className="px-5 py-2.5 rounded-lg font-semibold text-sm bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2 flex-shrink-0"
          >
            {state.status === 'loading'
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Fetching…</>
              : <><Search className="h-4 w-4" /> Analyse</>
            }
          </button>
        </div>

        {/* Info */}
        <p className="mt-3 text-xs text-gray-600 flex items-center gap-1.5">
          <Info className="h-3 w-3 flex-shrink-0" />
          EVM &amp; Solana require a Moralis API key (NEXT_PUBLIC_MORALIS_API_KEY). Tron, TON and NEAR use free public APIs.
        </p>
      </form>

      {/* States */}
      {state.status === 'error' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{state.message}</p>
        </div>
      )}

      {state.status === 'no-key' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-400 text-sm">
            Set <code className="bg-gray-800 px-1 rounded">NEXT_PUBLIC_MORALIS_API_KEY</code> to enable holder data for EVM &amp; Solana chains.
          </p>
        </div>
      )}

      {state.status === 'unsupported' && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-3">
          <Info className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <p className="text-gray-400 text-sm">This chain is not yet supported for holder analysis.</p>
        </div>
      )}

      {state.status === 'ok' && (() => {
        const { holders, holdersCount } = state.data;
        if (holders.length === 0) {
          return (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 text-center text-gray-400">
              No holder data returned for this token.
            </div>
          );
        }

        const gini = computeGini(holders.map(h => h.share));
        const top1  = holders[0]?.share ?? 0;
        const top3  = holders.slice(0, 3).reduce((s, h) => s + h.share, 0);
        const top5  = holders.slice(0, 5).reduce((s, h) => s + h.share, 0);
        const top10 = holders.slice(0, 10).reduce((s, h) => s + h.share, 0);

        const addrUrl = EXP_ADDRESS[explorerType] ?? ((a: string) => `${explorerBase}/address/${a}`);

        return (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: metrics */}
            <div className="lg:col-span-2 space-y-4">
              {/* Gini gauge */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <GiniGauge gini={gini} />
              </div>

              {/* Lorenz curve */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Lorenz Curve</h3>
                <LorenzCurve holders={holders} />
                <p className="text-xs text-gray-600 mt-2 text-center">
                  The shaded area between the curves is proportional to the Gini coefficient
                </p>
              </div>

              {/* Concentration stats */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Concentration Metrics</h3>
                <div className="space-y-2.5">
                  {[
                    { label: 'Top 1 holder',   pct: top1  },
                    { label: 'Top 3 holders',  pct: top3  },
                    { label: 'Top 5 holders',  pct: top5  },
                    { label: 'Top 10 holders', pct: top10 },
                  ].map(({ label, pct }) => (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs text-gray-400">{label}</span>
                        <span className={`text-xs font-bold tabular-nums ${concentrationColor(pct)}`}>
                          {pct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            pct > 50 ? 'bg-red-500' :
                            pct > 30 ? 'bg-orange-500' :
                            pct > 15 ? 'bg-yellow-500' :
                                       'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-500">
                    Total holders on-chain: <span className="text-gray-300 font-medium">{holdersCount.toLocaleString()}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Analysis based on top {holders.length} holders</p>
                </div>
              </div>
            </div>

            {/* Right: top holders list */}
            <div className="lg:col-span-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Top Holders
                </h3>

                <div className="space-y-2.5">
                  {holders.map((h, i) => {
                    const knownLabel = KNOWN_LABELS[h.address.toLowerCase()];
                    return (
                      <div key={h.address} className="group">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-gray-600 w-5 flex-shrink-0 text-right">#{i + 1}</span>
                          <a
                            href={addrUrl(h.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-yellow-400 transition-colors font-mono flex-1 min-w-0"
                          >
                            <span className="truncate">{knownLabel ?? shortAddr(h.address)}</span>
                            <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                          <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${shareColor(h.share)}`}>
                            {h.share.toFixed(2)}%
                          </span>
                        </div>
                        <div className="ml-7 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barFill(h.share)}`}
                            style={{ width: `${Math.min(h.share * 3, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* What does it mean */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mt-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Reading the Gini Coefficient
                </h3>
                <div className="space-y-2">
                  {[
                    { range: '0.00 – 0.40', label: 'Well Distributed',       color: 'bg-green-500',  desc: 'Supply is spread across many wallets. Lower manipulation risk.' },
                    { range: '0.40 – 0.60', label: 'Moderate Concentration', color: 'bg-yellow-500', desc: 'Some wallets hold a notable share. Monitor for coordinated moves.' },
                    { range: '0.60 – 0.80', label: 'High Concentration',     color: 'bg-orange-500', desc: 'A few wallets dominate supply. Price is vulnerable to whale dumps.' },
                    { range: '0.80 – 1.00', label: 'Extreme Concentration',  color: 'bg-red-500',    desc: 'Near-total concentration. High risk of rug or coordinated dump.' },
                  ].map(row => (
                    <div key={row.range} className="flex items-start gap-2.5">
                      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${row.color}`} />
                      <div>
                        <span className="text-xs font-medium text-white">{row.range} — {row.label}</span>
                        <p className="text-xs text-gray-500">{row.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Idle state hint */}
      {state.status === 'idle' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <BarChart3 className="h-12 w-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-1">Enter a token address above to analyse its holder distribution</p>
          <p className="text-gray-600 text-xs">Supports EVM chains, Solana, Tron, TON and NEAR</p>
        </div>
      )}
    </div>
  );
}
