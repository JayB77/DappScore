'use client';

import { useEffect, useState } from 'react';
import {
  Fish, ArrowUpRight, ArrowDownRight, ExternalLink,
  Loader2, AlertTriangle, Activity, TrendingUp,
} from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContractAddress { chain: string; address: string }

interface Transfer {
  from?: string;
  to?:   string;
  value?: number;
  txHash?: string;
  /** unix ms — derived from Alchemy metadata */
  timestamp?: number;
}

interface Analysis {
  last24h: {
    transferCount: number;
    totalVolume: number;
    avgTransferSize: number;
  };
  trend: 'high_activity' | 'moderate' | 'low';
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; analysis: Analysis; recentLarge: Transfer[] }
  | { status: 'unsupported' }
  | { status: 'error' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(addr: string, chars = 4): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr ?? '';
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

function trendLabel(trend: Analysis['trend']): { text: string; color: string } {
  if (trend === 'high_activity') return { text: 'High activity', color: 'text-orange-400' };
  if (trend === 'moderate')      return { text: 'Moderate activity', color: 'text-yellow-400' };
  return { text: 'Low activity', color: 'text-green-400' };
}

/** True if address looks like a zero or well-known burn address */
function isBurnAddress(addr: string): boolean {
  return /^0x0+$/.test(addr) || addr.toLowerCase() === '0x000000000000000000000000000000000000dead';
}

/** Format a token amount with K/M suffix */
function fmtAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

// ── EVM chains mapped to their explorer base (for tx links) ──────────────────

const EVM_EXPLORER: Record<string, string> = {
  ethereum: 'https://etherscan.io',
  eth:      'https://etherscan.io',
  base:     'https://basescan.org',
  polygon:  'https://polygonscan.com',
  bsc:      'https://bscscan.com',
  arbitrum: 'https://arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
  blast:    'https://blastscan.io',
  gnosis:   'https://gnosisscan.io',
  avalanche:'https://snowtrace.io',
  linea:    'https://lineascan.build',
  scroll:   'https://scrollscan.com',
  mantle:   'https://mantlescan.xyz',
  mode:     'https://modescan.io',
  taiko:    'https://taikoscan.io',
  sonic:    'https://sonicscan.org',
  cronos:   'https://cronoscan.com',
};

function explorerBase(chain: string): string {
  return EVM_EXPLORER[chain.toLowerCase()] ?? 'https://etherscan.io';
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchWhaleData(
  contractAddress: string,
  network: string,
): Promise<{ analysis: Analysis; recentLarge: Transfer[] }> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

  const [analysisRes, txRes] = await Promise.all([
    fetch(`${apiBase}/api/v1/whales/${contractAddress}/analysis?network=${network}`),
    fetch(`${apiBase}/api/v1/whales/${contractAddress}/transactions?network=${network}&hours=24`),
  ]);

  const [analysisJson, txJson] = await Promise.all([
    analysisRes.ok ? analysisRes.json() : null,
    txRes.ok       ? txRes.json()       : null,
  ]);

  const analysis: Analysis = analysisJson?.data ?? {
    last24h: { transferCount: 0, totalVolume: 0, avgTransferSize: 0 },
    trend: 'low' as const,
  };

  // Extract the top-10 largest transfers from recent transactions
  const allTransfers: Array<{
    from?: string; to?: string; value?: number;
    hash?: string; metadata?: { blockTimestamp?: string };
  }> = txJson?.data?.transactions ?? [];

  const recentLarge: Transfer[] = allTransfers
    .filter(t => (t.value ?? 0) > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 10)
    .map(t => ({
      from:      t.from,
      to:        t.to,
      value:     t.value,
      txHash:    t.hash,
      timestamp: t.metadata?.blockTimestamp
        ? new Date(t.metadata.blockTimestamp).getTime()
        : undefined,
    }));

  return { analysis, recentLarge };
}

// ── Single-contract row ───────────────────────────────────────────────────────

function ChainRow({ chain, address }: ContractAddress) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const chainKey = chain.toLowerCase();

  // Only EVM chains have the Alchemy transfer API wired up
  const isSupported = chainKey in EVM_EXPLORER || chainKey === 'base' || chainKey === 'mainnet';

  useEffect(() => {
    if (!isSupported) { setState({ status: 'unsupported' }); return; }
    setState({ status: 'loading' });

    fetchWhaleData(address, chainKey === 'ethereum' ? 'mainnet' : chainKey)
      .then(({ analysis, recentLarge }) => setState({ status: 'ok', analysis, recentLarge }))
      .catch(() => setState({ status: 'error' }));
  }, [address, chainKey, isSupported]);

  const base = explorerBase(chain);

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-3">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>

      {state.status === 'loading' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Fetching whale data…</span>
        </div>
      )}

      {state.status === 'unsupported' && (
        <span className="text-xs text-gray-500">Whale tracking unavailable for this chain</span>
      )}

      {state.status === 'error' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-xs">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Unable to fetch transfer data</span>
        </div>
      )}

      {state.status === 'ok' && (() => {
        const { analysis, recentLarge } = state;
        const { transferCount, totalVolume, avgTransferSize } = analysis.last24h;
        const trend = trendLabel(analysis.trend);

        return (
          <div className="space-y-3">
            {/* 24h summary stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-900/60 rounded-lg p-2 text-center">
                <div className="text-sm font-bold text-white">{transferCount}</div>
                <div className="text-xs text-gray-500 mt-0.5">Transfers 24h</div>
              </div>
              <div className="bg-gray-900/60 rounded-lg p-2 text-center">
                <div className="text-sm font-bold text-white">{fmtAmount(totalVolume)}</div>
                <div className="text-xs text-gray-500 mt-0.5">Volume 24h</div>
              </div>
              <div className="bg-gray-900/60 rounded-lg p-2 text-center">
                <div className="text-sm font-bold text-white">{fmtAmount(avgTransferSize)}</div>
                <div className="text-xs text-gray-500 mt-0.5">Avg Size</div>
              </div>
            </div>

            {/* Activity trend badge */}
            <div className="flex items-center space-x-1.5">
              <Activity className={`h-3.5 w-3.5 flex-shrink-0 ${trend.color}`} />
              <span className={`text-sm ${trend.color}`}>{trend.text}</span>
              {analysis.trend === 'high_activity' && (
                <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">WATCH</span>
              )}
            </div>

            {/* Top transfers list */}
            {recentLarge.length > 0 ? (
              <div className="space-y-1.5">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Top transfers (24h)</span>
                {recentLarge.map((t, i) => {
                  const burn = t.to && isBurnAddress(t.to);
                  const txUrl = t.txHash ? `${base}/tx/${t.txHash}` : null;
                  const fromUrl = t.from ? `${base}/address/${t.from}` : null;
                  const toUrl   = t.to   ? `${base}/address/${t.to}`   : null;

                  return (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-gray-700/50 last:border-0">
                      {/* From → To */}
                      <div className="flex items-center space-x-1 text-xs min-w-0">
                        {t.from ? (
                          <a href={fromUrl!} target="_blank" rel="noopener noreferrer"
                             className="text-gray-400 hover:text-gray-300 font-mono transition-colors truncate">
                            {truncate(t.from)}
                          </a>
                        ) : <span className="text-gray-600">?</span>}

                        <ArrowUpRight className="h-3 w-3 text-gray-600 flex-shrink-0" />

                        {t.to ? (
                          <a href={toUrl!} target="_blank" rel="noopener noreferrer"
                             className={`font-mono transition-colors truncate ${burn ? 'text-red-400 hover:text-red-300' : 'text-gray-400 hover:text-gray-300'}`}>
                            {burn ? '🔥 burn' : truncate(t.to)}
                          </a>
                        ) : <span className="text-gray-600">?</span>}
                      </div>

                      {/* Amount + tx link */}
                      <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                        <span className="text-xs font-medium text-white">{fmtAmount(t.value ?? 0)}</span>
                        {txUrl && (
                          <a href={txUrl} target="_blank" rel="noopener noreferrer"
                             className="text-gray-600 hover:text-gray-400 transition-colors">
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-gray-500 text-xs">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>No large transfers in the last 24 hours</span>
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

export default function WhaleTrackerPanel({ contractAddresses }: Props) {
  const enabled = useFeatureFlag('whaleTracker', false);
  if (!enabled) return null;

  // Only show for EVM contracts that have a matching explorer
  const supported = contractAddresses.filter(({ chain }) =>
    chain.toLowerCase() in EVM_EXPLORER || chain.toLowerCase() === 'base'
  );
  if (supported.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Fish className="h-4 w-4 text-gray-400" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Whale Tracker</h3>
      </div>

      <div className="space-y-3">
        {supported.map(({ chain, address }) => (
          <ChainRow key={`${chain}:${address}`} chain={chain} address={address} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        24h transfer volume &amp; top movements via Alchemy · EVM chains only
      </p>
    </div>
  );
}
