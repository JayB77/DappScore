'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, XCircle, ShieldAlert, ExternalLink } from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';

// ── Chain ID map ──────────────────────────────────────────────────────────────
// honeypot.is uses numeric EVM chain IDs

const HONEYPOT_CHAIN_IDS: Record<string, number> = {
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
  mode: 34443,
  taiko: 167000,
  fraxtal: 252,
  avalanche: 43114,   avax: 43114,
  fantom: 250,        ftm: 250,
  sonic: 146,
  cronos: 25,         cro: 25,
  gnosis: 100,        xdai: 100,
  celo: 42220,
  moonbeam: 1284,     glmr: 1284,
  moonriver: 1285,    movr: 1285,
  kava: 2222,
  aurora: 1313161554,
  core: 1116,         'core dao': 1116,
  kaia: 8217,         klaytn: 8217,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface HoneypotData {
  simulationSuccess: boolean;
  honeypotResult: {
    isHoneypot: boolean;
    honeypotReason: string | null;
  };
  simulationResult?: {
    buyTax: number;
    sellTax: number;
    transferTax: number;
  };
  holderAnalysis?: {
    holders: string;
    failed: string;
    highestTax: number;
  };
  contractCode?: {
    openSource: boolean;
    isProxy: boolean;
  };
  pair?: {
    liquidity: string;
    liquidityToken?: { symbol: string };
  };
  flags?: string[];
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: HoneypotData }
  | { status: 'error'; message: string }
  | { status: 'unsupported' };

interface ContractAddress {
  chain: string;
  address: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function taxColor(pct: number): string {
  if (pct > 20) return 'text-red-400';
  if (pct > 10) return 'text-orange-400';
  if (pct > 5)  return 'text-yellow-400';
  return 'text-green-400';
}

function taxBadge(pct: number): string | null {
  if (pct > 20) return 'RED FLAG';
  if (pct > 10) return 'HIGH';
  return null;
}

async function fetchHoneypot(address: string, chainId: number): Promise<HoneypotData> {
  const res = await fetch(
    `https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=${chainId}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`honeypot.is error ${res.status}`);
  return res.json() as Promise<HoneypotData>;
}

// ── Single contract row ───────────────────────────────────────────────────────

function ContractRow({ chain, address }: ContractAddress) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const chainId = HONEYPOT_CHAIN_IDS[chain.toLowerCase()];

  useEffect(() => {
    if (!chainId) { setState({ status: 'unsupported' }); return; }
    setState({ status: 'loading' });
    fetchHoneypot(address, chainId)
      .then((data) => setState({ status: 'ok', data }))
      .catch((e: Error) => setState({ status: 'error', message: e.message }));
  }, [address, chainId]);

  const explorerBase = chainId === 1 ? 'https://etherscan.io' : undefined; // fallback
  const honeypotUrl = `https://honeypot.is/ethereum?address=${address}`;

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-2">
      {/* Chain header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>
        <a
          href={honeypotUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span className="font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* State */}
      {state.status === 'loading' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Simulating buy & sell…</span>
        </div>
      )}

      {state.status === 'unsupported' && (
        <span className="text-xs text-gray-500">Chain not supported by honeypot.is</span>
      )}

      {state.status === 'error' && (
        <span className="text-xs text-gray-500">Unable to simulate</span>
      )}

      {state.status === 'ok' && (() => {
        const { data } = state;
        const isHoneypot = data.honeypotResult.isHoneypot;
        const simFailed  = !data.simulationSuccess;
        const buy  = data.simulationResult?.buyTax  ?? 0;
        const sell = data.simulationResult?.sellTax ?? 0;

        return (
          <div className="space-y-2">
            {/* Primary verdict */}
            {isHoneypot ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                  <span className="text-sm font-bold text-red-400">HONEYPOT DETECTED</span>
                </div>
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-bold">DO NOT BUY</span>
              </div>
            ) : simFailed ? (
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0" />
                <span className="text-sm text-orange-400">Simulation failed — proceed with caution</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-green-400">Not a honeypot</span>
              </div>
            )}

            {/* Honeypot reason */}
            {isHoneypot && data.honeypotResult.honeypotReason && (
              <p className="text-xs text-red-300 bg-red-500/10 rounded px-2 py-1">
                {data.honeypotResult.honeypotReason}
              </p>
            )}

            {/* Tax breakdown */}
            {data.simulationResult && !simFailed && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Buy Tax</div>
                  <div className="flex items-center space-x-1.5">
                    <span className={`text-sm font-medium ${taxColor(buy)}`}>{buy.toFixed(1)}%</span>
                    {taxBadge(buy) && (
                      <span className="text-xs px-1 py-0.5 bg-red-500/20 text-red-400 rounded">{taxBadge(buy)}</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Sell Tax</div>
                  <div className="flex items-center space-x-1.5">
                    <span className={`text-sm font-medium ${taxColor(sell)}`}>{sell.toFixed(1)}%</span>
                    {taxBadge(sell) && (
                      <span className="text-xs px-1 py-0.5 bg-red-500/20 text-red-400 rounded">{taxBadge(sell)}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Flags */}
            {data.flags && data.flags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {data.flags.map((flag) => (
                  <span key={flag} className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">
                    {flag}
                  </span>
                ))}
              </div>
            )}

            {/* Holder failure rate */}
            {data.holderAnalysis && parseInt(data.holderAnalysis.failed) > 0 && (
              <div className="text-xs text-orange-400 flex items-center space-x-1">
                <AlertTriangle className="h-3 w-3" />
                <span>
                  {data.holderAnalysis.failed} of {data.holderAnalysis.holders} holders failed to sell
                </span>
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

export default function HoneypotPanel({ contractAddresses }: Props) {
  const enabled = useFeatureFlag('honeypotDetector', false);
  if (!enabled) return null;

  const supported = contractAddresses.filter(
    ({ chain }) => !!HONEYPOT_CHAIN_IDS[chain.toLowerCase()],
  );
  if (supported.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <ShieldAlert className="h-4 w-4 text-gray-400" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Honeypot Check</h3>
      </div>

      <div className="space-y-3">
        {supported.map(({ chain, address }) => (
          <ContractRow key={`${chain}:${address}`} chain={chain} address={address} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Buy & sell simulation via honeypot.is · Not financial advice
      </p>
    </div>
  );
}
