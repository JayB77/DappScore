'use client';

import { useEffect, useState } from 'react';
import { Users, AlertTriangle, CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';

// ── Unified chain config ───────────────────────────────────────────────────────
// One entry per chain name alias → how to fetch holders + explorer URLs.

type FetcherType = 'moralis' | 'solana' | 'tron' | 'ton' | 'near';

interface ChainPanelConfig {
  fetcherType: FetcherType;
  moralisId?: string;           // only for 'moralis'
  tokenUrl:   (a: string) => string;
  addressUrl: (a: string) => string;
}

const CHAIN_CONFIG: Record<string, ChainPanelConfig> = {
  // ── EVM via Moralis ───────────────────────────────────────────────────────
  ethereum:              { fetcherType: 'moralis', moralisId: 'eth',        tokenUrl: a => `https://etherscan.io/token/${a}#balances`,             addressUrl: a => `https://etherscan.io/address/${a}` },
  eth:                   { fetcherType: 'moralis', moralisId: 'eth',        tokenUrl: a => `https://etherscan.io/token/${a}#balances`,             addressUrl: a => `https://etherscan.io/address/${a}` },
  base:                  { fetcherType: 'moralis', moralisId: 'base',       tokenUrl: a => `https://basescan.org/token/${a}#balances`,             addressUrl: a => `https://basescan.org/address/${a}` },
  polygon:               { fetcherType: 'moralis', moralisId: 'polygon',    tokenUrl: a => `https://polygonscan.com/token/${a}#balances`,          addressUrl: a => `https://polygonscan.com/address/${a}` },
  matic:                 { fetcherType: 'moralis', moralisId: 'polygon',    tokenUrl: a => `https://polygonscan.com/token/${a}#balances`,          addressUrl: a => `https://polygonscan.com/address/${a}` },
  'polygon zkevm':       { fetcherType: 'moralis', moralisId: 'polygon-zkevm', tokenUrl: a => `https://zkevm.polygonscan.com/token/${a}#balances`, addressUrl: a => `https://zkevm.polygonscan.com/address/${a}` },
  bsc:                   { fetcherType: 'moralis', moralisId: 'bsc',        tokenUrl: a => `https://bscscan.com/token/${a}#balances`,              addressUrl: a => `https://bscscan.com/address/${a}` },
  bnb:                   { fetcherType: 'moralis', moralisId: 'bsc',        tokenUrl: a => `https://bscscan.com/token/${a}#balances`,              addressUrl: a => `https://bscscan.com/address/${a}` },
  binance:               { fetcherType: 'moralis', moralisId: 'bsc',        tokenUrl: a => `https://bscscan.com/token/${a}#balances`,              addressUrl: a => `https://bscscan.com/address/${a}` },
  'bnb smart chain':     { fetcherType: 'moralis', moralisId: 'bsc',        tokenUrl: a => `https://bscscan.com/token/${a}#balances`,              addressUrl: a => `https://bscscan.com/address/${a}` },
  'binance smart chain': { fetcherType: 'moralis', moralisId: 'bsc',        tokenUrl: a => `https://bscscan.com/token/${a}#balances`,              addressUrl: a => `https://bscscan.com/address/${a}` },
  arbitrum:              { fetcherType: 'moralis', moralisId: 'arbitrum',   tokenUrl: a => `https://arbiscan.io/token/${a}#balances`,              addressUrl: a => `https://arbiscan.io/address/${a}` },
  'arbitrum one':        { fetcherType: 'moralis', moralisId: 'arbitrum',   tokenUrl: a => `https://arbiscan.io/token/${a}#balances`,              addressUrl: a => `https://arbiscan.io/address/${a}` },
  optimism:              { fetcherType: 'moralis', moralisId: 'optimism',   tokenUrl: a => `https://optimistic.etherscan.io/token/${a}#balances`, addressUrl: a => `https://optimistic.etherscan.io/address/${a}` },
  'op mainnet':          { fetcherType: 'moralis', moralisId: 'optimism',   tokenUrl: a => `https://optimistic.etherscan.io/token/${a}#balances`, addressUrl: a => `https://optimistic.etherscan.io/address/${a}` },
  avalanche:             { fetcherType: 'moralis', moralisId: 'avalanche',  tokenUrl: a => `https://snowtrace.io/token/${a}#balances`,             addressUrl: a => `https://snowtrace.io/address/${a}` },
  avax:                  { fetcherType: 'moralis', moralisId: 'avalanche',  tokenUrl: a => `https://snowtrace.io/token/${a}#balances`,             addressUrl: a => `https://snowtrace.io/address/${a}` },
  fantom:                { fetcherType: 'moralis', moralisId: 'fantom',     tokenUrl: a => `https://ftmscan.com/token/${a}#balances`,              addressUrl: a => `https://ftmscan.com/address/${a}` },
  ftm:                   { fetcherType: 'moralis', moralisId: 'fantom',     tokenUrl: a => `https://ftmscan.com/token/${a}#balances`,              addressUrl: a => `https://ftmscan.com/address/${a}` },
  linea:                 { fetcherType: 'moralis', moralisId: 'linea',      tokenUrl: a => `https://lineascan.build/token/${a}#balances`,          addressUrl: a => `https://lineascan.build/address/${a}` },
  blast:                 { fetcherType: 'moralis', moralisId: 'blast',      tokenUrl: a => `https://blastscan.io/token/${a}#balances`,             addressUrl: a => `https://blastscan.io/address/${a}` },
  zksync:                { fetcherType: 'moralis', moralisId: 'zksync-era', tokenUrl: a => `https://explorer.zksync.io/address/${a}`,              addressUrl: a => `https://explorer.zksync.io/address/${a}` },
  'zksync era':          { fetcherType: 'moralis', moralisId: 'zksync-era', tokenUrl: a => `https://explorer.zksync.io/address/${a}`,              addressUrl: a => `https://explorer.zksync.io/address/${a}` },
  scroll:                { fetcherType: 'moralis', moralisId: 'scroll',     tokenUrl: a => `https://scrollscan.com/token/${a}#balances`,           addressUrl: a => `https://scrollscan.com/address/${a}` },
  mantle:                { fetcherType: 'moralis', moralisId: 'mantle',     tokenUrl: a => `https://mantlescan.xyz/token/${a}#balances`,           addressUrl: a => `https://mantlescan.xyz/address/${a}` },
  celo:                  { fetcherType: 'moralis', moralisId: 'celo',       tokenUrl: a => `https://celoscan.io/token/${a}#balances`,              addressUrl: a => `https://celoscan.io/address/${a}` },
  gnosis:                { fetcherType: 'moralis', moralisId: 'gnosis',     tokenUrl: a => `https://gnosisscan.io/token/${a}#balances`,            addressUrl: a => `https://gnosisscan.io/address/${a}` },
  xdai:                  { fetcherType: 'moralis', moralisId: 'gnosis',     tokenUrl: a => `https://gnosisscan.io/token/${a}#balances`,            addressUrl: a => `https://gnosisscan.io/address/${a}` },
  moonbeam:              { fetcherType: 'moralis', moralisId: 'moonbeam',   tokenUrl: a => `https://moonscan.io/token/${a}#balances`,              addressUrl: a => `https://moonscan.io/address/${a}` },
  cronos:                { fetcherType: 'moralis', moralisId: 'cronos',     tokenUrl: a => `https://cronoscan.com/token/${a}#balances`,            addressUrl: a => `https://cronoscan.com/address/${a}` },

  // ── Solana (SPL tokens) — Moralis Solana Gateway, same key as EVM ────────
  solana: { fetcherType: 'solana', tokenUrl: a => `https://solscan.io/token/${a}`,          addressUrl: a => `https://solscan.io/account/${a}` },
  sol:    { fetcherType: 'solana', tokenUrl: a => `https://solscan.io/token/${a}`,          addressUrl: a => `https://solscan.io/account/${a}` },

  // ── Tron (TRC-20) — TronScan public API, no key ───────────────────────────
  tron: { fetcherType: 'tron', tokenUrl: a => `https://tronscan.org/#/token20/${a}`,        addressUrl: a => `https://tronscan.org/#/address/${a}` },
  trx:  { fetcherType: 'tron', tokenUrl: a => `https://tronscan.org/#/token20/${a}`,        addressUrl: a => `https://tronscan.org/#/address/${a}` },

  // ── TON (Jettons) — TonCenter v3 public API, no key ──────────────────────
  ton: { fetcherType: 'ton', tokenUrl: a => `https://tonscan.org/jetton/${a}`,              addressUrl: a => `https://tonscan.org/address/${a}` },

  // ── NEAR (FT tokens) — FastNEAR top holders + NearBlocks supply, no key ──
  near: { fetcherType: 'near', tokenUrl: a => `https://nearblocks.io/token/${a}#holders`,   addressUrl: a => `https://nearblocks.io/address/${a}` },
};

// ── Known burn / system addresses ─────────────────────────────────────────────
const KNOWN: Record<string, string> = {
  // EVM
  '0x0000000000000000000000000000000000000000': 'Burn Address',
  '0x000000000000000000000000000000000000dead': 'Burn Address',
  '0xdead000000000000000042069420694206942069': 'Burn Address',
  // Solana
  '1nc1nerator11111111111111111111111111111124': 'Incinerator',
  'So11111111111111111111111111111111111111112': 'Wrapped SOL Mint',
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
  const top5  = holders.slice(0, 5).reduce((s, h) => s + h.share, 0);
  const top10 = holders.reduce((s, h) => s + h.share, 0);

  if (top1  > 50) return { label: `Top holder owns ${top1.toFixed(1)}% of supply`,    color: 'text-red-400',    flag: 'CRITICAL'  };
  if (top3  > 60) return { label: `Top 3 wallets hold ${top3.toFixed(1)}% of supply`, color: 'text-red-400',    flag: 'HIGH RISK' };
  if (top5  > 50) return { label: `Top 5 wallets hold ${top5.toFixed(1)}% of supply`, color: 'text-red-400',    flag: 'HIGH RISK' };
  if (top10 > 80) return { label: `Top 10 hold ${top10.toFixed(1)}% — elevated`,       color: 'text-orange-400', flag: 'ELEVATED'  };
  if (top10 > 50) return { label: `Top 10 hold ${top10.toFixed(1)}% — moderate`,       color: 'text-yellow-400' };
  return                 { label: 'Well distributed',                                   color: 'text-green-400'  };
}

/**
 * Detect fake burn wallets: addresses that look like a burn address
 * (many leading zeros or contain 'dead') but are NOT in the known provably-
 * unspendable set. Tokens sent here may still be recoverable by the team.
 */
function detectFakeBurns(holders: Holder[]): Holder[] {
  return holders.filter(h => {
    if (h.share < 1) return false;                          // too small to matter
    if (KNOWN[h.address.toLowerCase()] === 'Burn Address') return false; // legit burn
    if (KNOWN[h.address])                                   return false; // any other known label
    const addr = h.address.toLowerCase();
    return (
      /^0x0{15,}/.test(addr) ||                             // ≥15 leading zeros
      (addr.includes('dead') && addr.length === 42)         // contains 'dead'
    );
  });
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
  if (!addr) return '—';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

// EVM: Moralis ERC-20 owners endpoint
async function fetchEvmHolders(
  moralisId: string,
  address: string,
  apiKey: string,
): Promise<{ holders: Holder[]; meta: TokenMeta }> {
  const res = await fetch(
    `https://deep-index.moralis.io/api/v2.2/erc20/${address}/owners?chain=${moralisId}&limit=10&order=DESC`,
    { headers: { 'X-API-Key': apiKey } },
  );
  if (!res.ok) throw new Error(`Moralis ${res.status}`);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holders = (data.result ?? []).map((h: any) => ({
    address: h.owner_address as string,
    share:   parseFloat(h.percentage_relative_to_total_supply ?? '0'),
  }));
  return { holders, meta: { holdersCount: data.total ?? 0 } };
}

// Solana: Moralis Solana Gateway — same NEXT_PUBLIC_MORALIS_API_KEY as EVM.
// Returns real wallet addresses directly (no ATA decoding needed).
async function fetchSolanaHolders(
  mint: string,
  apiKey: string,
): Promise<{ holders: Holder[]; meta: TokenMeta }> {
  const res = await fetch(
    `https://solana-gateway.moralis.io/token/mainnet/${mint}/top-holders?limit=10`,
    { headers: { 'X-API-Key': apiKey } },
  );
  if (!res.ok) throw new Error(`Moralis Solana ${res.status}`);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holders = (data.result ?? []).map((h: any) => ({
    address: h.owner_address as string,
    share:   parseFloat(h.percentage_relative_to_total_supply ?? '0'),
  }));
  return { holders, meta: { holdersCount: data.total ?? 0 } };
}

// NEAR: FastNEAR top-holders (free, no key) + NearBlocks for total supply.
// FastNEAR returns raw balance strings; we use BigInt division for precision.
async function fetchNearHolders(contractId: string): Promise<{ holders: Holder[]; meta: TokenMeta }> {
  const [topRes, metaRes] = await Promise.all([
    fetch(`https://api.fastnear.com/v1/ft/${contractId}/top`),
    fetch(`https://api.nearblocks.io/v1/fts/${contractId}`),
  ]);
  if (!topRes.ok) throw new Error(`FastNEAR ${topRes.status}`);

  const topData  = await topRes.json();
  const metaData = metaRes.ok ? await metaRes.json() : null;

  const totalSupply = BigInt(metaData?.contracts?.[0]?.total_supply ?? '0');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holders: Holder[] = (topData.accounts ?? []).slice(0, 10).map((a: any) => {
    const balance = BigInt(a.balance ?? '0');
    const share   = totalSupply > BigInt(0) ? Number((balance * BigInt(10000)) / totalSupply) / 100 : 0;
    return { address: a.account_id as string, share };
  });

  return { holders, meta: { holdersCount: topData.total_count ?? 0 } };
}

// Tron: TronScan public API — CORS-enabled, no key required
async function fetchTronHolders(contractAddress: string): Promise<{ holders: Holder[]; meta: TokenMeta }> {
  const res = await fetch(
    `https://apilist.tronscanapi.com/api/token_trc20/holders?contractAddress=${contractAddress}&limit=10&start=0`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`TronScan ${res.status}`);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holders: Holder[] = (data.trc20_tokens ?? []).map((h: any) => ({
    address: h.address as string,
    share:   parseFloat(h.percentage ?? '0'),
  }));
  return { holders, meta: { holdersCount: data.total ?? 0 } };
}

// TON: TonCenter v3 public API — CORS-enabled, no key required.
// Wallets are returned as raw addresses; percentage is computed from total supply.
async function fetchTonHolders(jettonAddress: string): Promise<{ holders: Holder[]; meta: TokenMeta }> {
  const enc = encodeURIComponent(jettonAddress);

  // Fetch jetton master info (for total supply) and top wallets in parallel
  const [masterRes, walletsRes] = await Promise.all([
    fetch(`https://toncenter.com/api/v3/jetton/masters?address=${enc}&limit=1`),
    fetch(`https://toncenter.com/api/v3/jetton/wallets?jetton_address=${enc}&limit=10&sort=balance&direction=desc`),
  ]);
  if (!masterRes.ok || !walletsRes.ok) throw new Error('TonCenter error');

  const [masterData, walletsData] = await Promise.all([masterRes.json(), walletsRes.json()]);

  const totalSupply = BigInt(masterData.jetton_masters?.[0]?.total_supply ?? '0');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holders: Holder[] = (walletsData.jetton_wallets ?? []).map((w: any) => {
    const balance = BigInt(w.balance ?? '0');
    const share   = totalSupply > BigInt(0) ? Number((balance * BigInt(10000)) / totalSupply) / 100 : 0;
    return { address: (w.owner ?? w.address) as string, share };
  });

  return { holders, meta: { holdersCount: walletsData.total ?? 0 } };
}

// ── Single contract row ───────────────────────────────────────────────────────

function ContractRow({ chain, address }: ContractAddress) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const config = CHAIN_CONFIG[chain.toLowerCase().trim()];

  useEffect(() => {
    if (!config) { setState({ status: 'unsupported' }); return; }

    setState({ status: 'loading' });
    let promise: Promise<{ holders: Holder[]; meta: TokenMeta }>;

    switch (config.fetcherType) {
      case 'moralis': {
        const apiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
        if (!apiKey) { setState({ status: 'no-key' }); return; }
        promise = fetchEvmHolders(config.moralisId!, address, apiKey);
        break;
      }
      case 'solana': {
        const apiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
        if (!apiKey) { setState({ status: 'no-key' }); return; }
        promise = fetchSolanaHolders(address, apiKey);
        break;
      }
      case 'tron':   promise = fetchTronHolders(address);   break;
      case 'ton':    promise = fetchTonHolders(address);    break;
      case 'near':   promise = fetchNearHolders(address);   break;
    }

    promise
      .then(({ holders, meta }) => setState({ status: 'ok', holders, meta }))
      .catch(() => setState({ status: 'error' }));
  }, [chain, address, config]);

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>
        {config ? (
          <a
            href={config.tokenUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span className="font-mono">{shortAddr(address)}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="font-mono text-xs text-gray-600">{shortAddr(address)}</span>
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
        const risk      = concentrationRisk(holders);
        const fakeBurns = detectFakeBurns(holders);
        const maxShare  = holders[0]?.share ?? 1;

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

            {/* Fake burn wallets */}
            {fakeBurns.length > 0 && (
              <div className="rounded border border-orange-500/30 bg-orange-500/10 px-2 py-1.5 space-y-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-orange-400">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span>Unverified burn-like address{fakeBurns.length > 1 ? 'es' : ''}</span>
                </div>
                {fakeBurns.map(h => (
                  <p key={h.address} className="text-xs text-orange-300/80 pl-4">
                    {shortAddr(h.address)} holds {h.share.toFixed(1)}% — resembles a burn address
                    but may not be provably unspendable
                  </p>
                ))}
              </div>
            )}

            {/* Top holders list */}
            <div className="space-y-2">
              {holders.map((h, i) => {
                const known = KNOWN[h.address.toLowerCase()] ?? KNOWN[h.address];
                return (
                  <div key={`${h.address}-${i}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <span className="text-xs text-gray-600 w-4 flex-shrink-0">{i + 1}</span>
                        {known ? (
                          <span className="text-xs text-green-400">{known}</span>
                        ) : (
                          <a
                            href={config.addressUrl(h.address)}
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
        Top holders · EVM + Solana via Moralis · Tron/TON/NEAR via public APIs · Burn addresses shown in green
      </p>
    </div>
  );
}
