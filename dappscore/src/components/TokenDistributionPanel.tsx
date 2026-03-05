'use client';

import { useEffect, useState } from 'react';
import { Users, AlertTriangle, CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';

// ── Supported chains ──────────────────────────────────────────────────────────
// Ethplorer supports Ethereum only. BSC/Polygon etc. require paid APIs.
const SUPPORTED = new Set(['ethereum', 'eth']);

// ── Known addresses ───────────────────────────────────────────────────────────
const KNOWN: Record<string, string> = {
  '0x0000000000000000000000000000000000000000': 'Burn Address',
  '0x000000000000000000000000000000000000dead': 'Burn Address',
  '0xdead000000000000000042069420694206942069': 'Burn Address',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Holder {
  address: string;
  balance: number;
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
  | { status: 'unsupported' };

interface ContractAddress { chain: string; address: string }

// ── Risk helpers ──────────────────────────────────────────────────────────────

function concentrationRisk(holders: Holder[]) {
  if (!holders.length) return null;
  const top1  = holders[0].share;
  const top3  = holders.slice(0, 3).reduce((s, h) => s + h.share, 0);
  const top10 = holders.reduce((s, h) => s + h.share, 0);

  if (top1 > 50)  return { label: `Top holder owns ${top1.toFixed(1)}% of supply`,   color: 'text-red-400',    flag: 'CRITICAL' };
  if (top3 > 60)  return { label: `Top 3 wallets hold ${top3.toFixed(1)}% of supply`, color: 'text-red-400',    flag: 'HIGH RISK' };
  if (top10 > 80) return { label: `Top 10 hold ${top10.toFixed(1)}% — elevated`,       color: 'text-orange-400', flag: 'ELEVATED' };
  if (top10 > 50) return { label: `Top 10 hold ${top10.toFixed(1)}% — moderate`,       color: 'text-yellow-400' };
  return                 { label: 'Well distributed',                                   color: 'text-green-400'  };
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

async function fetchHolders(address: string): Promise<{ holders: Holder[]; meta: TokenMeta }> {
  const [holdersRes, infoRes] = await Promise.all([
    fetch(`https://api.ethplorer.io/getTopTokenHolders/${address}?apiKey=freekey&limit=10`),
    fetch(`https://api.ethplorer.io/getTokenInfo/${address}?apiKey=freekey`),
  ]);
  const [holdersData, infoData] = await Promise.all([holdersRes.json(), infoRes.json()]) as [
    { holders?: Holder[] },
    { holdersCount?: number },
  ];
  return {
    holders: holdersData.holders ?? [],
    meta: { holdersCount: infoData.holdersCount ?? 0 },
  };
}

// ── Single contract row ───────────────────────────────────────────────────────

function ContractRow({ chain, address }: ContractAddress) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const supported = SUPPORTED.has(chain.toLowerCase());

  useEffect(() => {
    if (!supported) { setState({ status: 'unsupported' }); return; }
    setState({ status: 'loading' });
    fetchHolders(address)
      .then(({ holders, meta }) => setState({ status: 'ok', holders, meta }))
      .catch(() => setState({ status: 'error' }));
  }, [address, supported]);

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>
        <a
          href={`https://etherscan.io/token/${address}#balances`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span className="font-mono">{shortAddr(address)}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {state.status === 'loading' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Fetching top holders…</span>
        </div>
      )}
      {state.status === 'unsupported' && (
        <span className="text-xs text-gray-500">Holder analysis available for Ethereum only</span>
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
                            href={`https://etherscan.io/address/${h.address}`}
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
        Top holders via Ethplorer · Ethereum only · Burn addresses shown in green
      </p>
    </div>
  );
}
