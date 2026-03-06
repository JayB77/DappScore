'use client';

import { useEffect, useState } from 'react';
import { Users, AlertTriangle, CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';

// ── Chain config ──────────────────────────────────────────────────────────────
// Maps the chain name stored on a project → Moralis chain id + block explorer URLs.
// Moralis supports CORS for browser calls — restrict your key to your domain in
// the Moralis dashboard: https://admin.moralis.io → API Keys → Edit → Allowed Origins.

const CHAIN_CONFIG: Record<string, {
  moralisId: string;
  token:   (a: string) => string;
  address: (a: string) => string;
}> = {
  ethereum:              { moralisId: 'eth',       token: a => `https://etherscan.io/token/${a}#balances`,             address: a => `https://etherscan.io/address/${a}` },
  eth:                   { moralisId: 'eth',       token: a => `https://etherscan.io/token/${a}#balances`,             address: a => `https://etherscan.io/address/${a}` },
  base:                  { moralisId: 'base',      token: a => `https://basescan.org/token/${a}#balances`,             address: a => `https://basescan.org/address/${a}` },
  polygon:               { moralisId: 'polygon',   token: a => `https://polygonscan.com/token/${a}#balances`,          address: a => `https://polygonscan.com/address/${a}` },
  matic:                 { moralisId: 'polygon',   token: a => `https://polygonscan.com/token/${a}#balances`,          address: a => `https://polygonscan.com/address/${a}` },
  bsc:                   { moralisId: 'bsc',       token: a => `https://bscscan.com/token/${a}#balances`,              address: a => `https://bscscan.com/address/${a}` },
  binance:               { moralisId: 'bsc',       token: a => `https://bscscan.com/token/${a}#balances`,              address: a => `https://bscscan.com/address/${a}` },
  'binance smart chain': { moralisId: 'bsc',       token: a => `https://bscscan.com/token/${a}#balances`,              address: a => `https://bscscan.com/address/${a}` },
  arbitrum:              { moralisId: 'arbitrum',  token: a => `https://arbiscan.io/token/${a}#balances`,              address: a => `https://arbiscan.io/address/${a}` },
  'arbitrum one':        { moralisId: 'arbitrum',  token: a => `https://arbiscan.io/token/${a}#balances`,              address: a => `https://arbiscan.io/address/${a}` },
  optimism:              { moralisId: 'optimism',  token: a => `https://optimistic.etherscan.io/token/${a}#balances`, address: a => `https://optimistic.etherscan.io/address/${a}` },
  avalanche:             { moralisId: 'avalanche', token: a => `https://snowtrace.io/token/${a}#balances`,             address: a => `https://snowtrace.io/address/${a}` },
  avax:                  { moralisId: 'avalanche', token: a => `https://snowtrace.io/token/${a}#balances`,             address: a => `https://snowtrace.io/address/${a}` },
  fantom:                { moralisId: 'fantom',    token: a => `https://ftmscan.com/token/${a}#balances`,              address: a => `https://ftmscan.com/address/${a}` },
  ftm:                   { moralisId: 'fantom',    token: a => `https://ftmscan.com/token/${a}#balances`,              address: a => `https://ftmscan.com/address/${a}` },
  linea:                 { moralisId: 'linea',     token: a => `https://lineascan.build/token/${a}#balances`,          address: a => `https://lineascan.build/address/${a}` },
  blast:                 { moralisId: 'blast',     token: a => `https://blastscan.io/token/${a}#balances`,             address: a => `https://blastscan.io/address/${a}` },
  zksync:                { moralisId: 'zksync-era',token: a => `https://explorer.zksync.io/address/${a}`,              address: a => `https://explorer.zksync.io/address/${a}` },
  'zksync era':          { moralisId: 'zksync-era',token: a => `https://explorer.zksync.io/address/${a}`,              address: a => `https://explorer.zksync.io/address/${a}` },
  scroll:                { moralisId: 'scroll',    token: a => `https://scrollscan.com/token/${a}#balances`,           address: a => `https://scrollscan.com/address/${a}` },
  celo:                  { moralisId: 'celo',      token: a => `https://celoscan.io/token/${a}#balances`,              address: a => `https://celoscan.io/address/${a}` },
  gnosis:                { moralisId: 'gnosis',    token: a => `https://gnosisscan.io/token/${a}#balances`,            address: a => `https://gnosisscan.io/address/${a}` },
  mantle:                { moralisId: 'mantle',    token: a => `https://explorer.mantle.xyz/token/${a}`,               address: a => `https://explorer.mantle.xyz/address/${a}` },
};

// ── Known addresses ───────────────────────────────────────────────────────────
const KNOWN: Record<string, string> = {
  '0x0000000000000000000000000000000000000000': 'Burn Address',
  '0x000000000000000000000000000000000000dead': 'Burn Address',
  '0xdead000000000000000042069420694206942069': 'Burn Address',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Holder {
  address: string;
  share: number; // 0–100
}

interface TokenMeta {
  holdersCount: number;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; holders: Holder[]; meta: TokenMeta }
  | { status: 'error' }
  | { status: 'unsupported' }
  | { status: 'no-key' };

interface ContractAddress { chain: string; address: string }

// ── Risk helpers ──────────────────────────────────────────────────────────────

function concentrationRisk(holders: Holder[]) {
  if (!holders.length) return null;
  const top1  = holders[0].share;
  const top3  = holders.slice(0, 3).reduce((s, h) => s + h.share, 0);
  const top10 = holders.reduce((s, h) => s + h.share, 0);

  if (top1 > 50)  return { label: `Top holder owns ${top1.toFixed(1)}% of supply`,    color: 'text-red-400',    flag: 'CRITICAL' };
  if (top3 > 60)  return { label: `Top 3 wallets hold ${top3.toFixed(1)}% of supply`, color: 'text-red-400',    flag: 'HIGH RISK' };
  if (top10 > 80) return { label: `Top 10 hold ${top10.toFixed(1)}% — elevated`,       color: 'text-orange-400', flag: 'ELEVATED' };
  if (top10 > 50) return { label: `Top 10 hold ${top10.toFixed(1)}% — moderate`,       color: 'text-yellow-400' };
  return                 { label: 'Well distributed',                                   color: 'text-green-400' };
}

function shareColor(pct: number): string {
  if (pct > 20) return 'text-red-400';
  if (pct > 10) return 'text-orange-400';
  if (pct > 5)  return 'text-yellow-400';
  return 'text-gray-400';
}

function barFill(pct: number): string {
  if (pct > 20) return 'bg-red-500';
  if (pct > 10) return 'bg-orange-500';
  if (pct > 5)  return 'bg-yellow-500';
  return 'bg-gray-500';
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchHolders(
  moralisId: string,
  address: string,
  apiKey: string,
): Promise<{ holders: Holder[]; meta: TokenMeta }> {
  const url = `https://deep-index.moralis.io/api/v2.2/erc20/${address}/owners`
    + `?chain=${moralisId}&limit=10&order=DESC`;

  const res = await fetch(url, { headers: { 'X-API-Key': apiKey } });
  if (!res.ok) throw new Error(`${res.status}`);

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holders = (data.result ?? []).map((h: any) => ({
    address: h.owner_address as string,
    share:   parseFloat(h.percentage_relative_to_total_supply ?? '0'),
  }));

  return { holders, meta: { holdersCount: data.total ?? 0 } };
}

// ── Single contract row ───────────────────────────────────────────────────────

function ContractRow({ chain, address }: ContractAddress) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const chainKey = chain.toLowerCase().trim();
  const config   = CHAIN_CONFIG[chainKey];

  useEffect(() => {
    if (!config) { setState({ status: 'unsupported' }); return; }

    const apiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    if (!apiKey) { setState({ status: 'no-key' }); return; }

    setState({ status: 'loading' });
    fetchHolders(config.moralisId, address, apiKey)
      .then(({ holders, meta }) => setState({ status: 'ok', holders, meta }))
      .catch(() => setState({ status: 'error' }));
  }, [chain, address, config]);

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>
        {config && (
          <a
            href={config.token(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span className="font-mono">{shortAddr(address)}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {state.status === 'loading' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Fetching top holders…</span>
        </div>
      )}
      {state.status === 'unsupported' && (
        <span className="text-xs text-gray-500">Holder analysis not available for this chain</span>
      )}
      {state.status === 'no-key' && (
        <span className="text-xs text-gray-500">Set NEXT_PUBLIC_MORALIS_API_KEY to enable holder data</span>
      )}
      {state.status === 'error' && (
        <span className="text-xs text-gray-500">Unable to fetch holder data</span>
      )}

      {state.status === 'ok' && (() => {
        const { holders, meta } = state;
        const risk = concentrationRisk(holders);
        const maxShare = holders[0]?.share ?? 1;

        return (
          <div className="space-y-3">
            {/* Verdict */}
            {risk && (
              <div className="flex items-center justify-between">
                <div className={`flex items-center space-x-1.5 text-sm ${risk.color}`}>
                  {risk.flag
                    ? <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    : <CheckCircle   className="h-3.5 w-3.5 flex-shrink-0" />
                  }
                  <span>{risk.label}</span>
                </div>
                {risk.flag && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                    risk.flag === 'CRITICAL' || risk.flag === 'HIGH RISK'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}>{risk.flag}</span>
                )}
              </div>
            )}

            {/* Holder count */}
            {meta.holdersCount > 0 && (
              <div className="flex items-center space-x-1.5 text-xs text-gray-500">
                <Users className="h-3 w-3" />
                <span>{meta.holdersCount.toLocaleString()} total holders</span>
              </div>
            )}

            {/* Top holders */}
            <div className="space-y-2">
              {holders.map((h, i) => {
                const known = KNOWN[h.address.toLowerCase()];
                return (
                  <div key={h.address}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <span className="text-xs text-gray-600 w-4 flex-shrink-0">{i + 1}</span>
                        {known ? (
                          <span className="text-xs text-green-400">{known}</span>
                        ) : (
                          <a
                            href={config?.address(h.address) ?? `https://etherscan.io/address/${h.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-blue-400 font-mono transition-colors truncate"
                          >
                            {shortAddr(h.address)}
                          </a>
                        )}
                      </div>
                      <span className={`text-xs font-medium flex-shrink-0 ml-2 ${shareColor(h.share)}`}>
                        {h.share.toFixed(2)}%
                      </span>
                    </div>
                    <div className="bg-gray-700 rounded-full h-1 overflow-hidden ml-6">
                      <div
                        className={`h-full rounded-full ${barFill(h.share)}`}
                        style={{ width: `${(h.share / maxShare) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
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

export default function TokenDistributionPanel({ contractAddresses }: Props) {
  const enabled = useFeatureFlag('tokenDistribution', false);
  if (!enabled) return null;
  if (!contractAddresses.length) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Users className="h-4 w-4 text-gray-400" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Token Distribution</h3>
      </div>

      <div className="space-y-3">
        {contractAddresses.map(({ chain, address }) => (
          <ContractRow key={`${chain}:${address}`} chain={chain} address={address} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Top holders via Moralis · Burn addresses shown in green
      </p>
    </div>
  );
}
