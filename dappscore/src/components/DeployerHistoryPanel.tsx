'use client';

import { useEffect, useState } from 'react';
import {
  User, Clock, AlertTriangle, ExternalLink, Loader2,
  Box, HelpCircle, CheckCircle, Shield, Globe,
} from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';
import { getChainConfig, getExplorerUrl } from '@/lib/chainAdapters';
import type { DeployerRisk, KnownProject } from './SerialRuggerBanner';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContractAddress { chain: string; address: string }

interface DappScoreMatch {
  id: string;
  name: string;
  contractAddress?: string;
  trustLevel: number;
  status: number;
}

interface DeployedContract {
  address: string;
  txHash: string;
  timestamp: number;   // unix seconds
  dappScore?: DappScoreMatch;
}

interface DeployerInfo {
  deployer: string;
  firstTxTimestamp: number | null;        // unix seconds; null = no txs found
  contractCreationTimestamp: number | null; // unix seconds; when THIS contract was deployed
  deployedContracts: DeployedContract[];  // other contracts from this wallet
}

// ── Cross-chain scan ──────────────────────────────────────────────────────────

/**
 * Major EVM chains scanned for cross-chain deployer history.
 * Chosen for: high scam frequency + reliable free Etherscan-compatible APIs.
 */
const CROSS_CHAIN_TARGETS = [
  // ── Highest scam-frequency chains ──────────────────────────────────────────
  { chain: 'Ethereum',      apiBase: 'https://api.etherscan.io/api',                  explorerBase: 'https://etherscan.io'              },
  { chain: 'BNB Chain',     apiBase: 'https://api.bscscan.com/api',                   explorerBase: 'https://bscscan.com'               },
  { chain: 'Polygon',       apiBase: 'https://api.polygonscan.com/api',               explorerBase: 'https://polygonscan.com'           },
  { chain: 'Arbitrum',      apiBase: 'https://api.arbiscan.io/api',                   explorerBase: 'https://arbiscan.io'               },
  { chain: 'Optimism',      apiBase: 'https://api-optimistic.etherscan.io/api',       explorerBase: 'https://optimistic.etherscan.io'   },
  { chain: 'Base',          apiBase: 'https://api.basescan.org/api',                  explorerBase: 'https://basescan.org'              },
  { chain: 'Blast',         apiBase: 'https://api.blastscan.io/api',                  explorerBase: 'https://blastscan.io'              },
  { chain: 'Avalanche',     apiBase: 'https://api.snowtrace.io/api',                  explorerBase: 'https://snowtrace.io'              },
  { chain: 'Fantom',        apiBase: 'https://api.ftmscan.com/api',                   explorerBase: 'https://ftmscan.com'               },
  { chain: 'Sonic',         apiBase: 'https://api.sonicscan.org/api',                 explorerBase: 'https://sonicscan.org'             },
  { chain: 'Cronos',        apiBase: 'https://api.cronoscan.com/api',                 explorerBase: 'https://cronoscan.com'             },
  { chain: 'Linea',         apiBase: 'https://api.lineascan.build/api',               explorerBase: 'https://lineascan.build'           },
  // ── Popular L2s ────────────────────────────────────────────────────────────
  { chain: 'zkSync Era',    apiBase: 'https://api-era.zksync.network/api',            explorerBase: 'https://era.zksync.network'        },
  { chain: 'Scroll',        apiBase: 'https://api.scrollscan.com/api',                explorerBase: 'https://scrollscan.com'            },
  { chain: 'Mantle',        apiBase: 'https://api.mantlescan.xyz/api',                explorerBase: 'https://mantlescan.xyz'            },
  { chain: 'Mode',          apiBase: 'https://api.modescan.io/api',                   explorerBase: 'https://modescan.io'               },
  { chain: 'Taiko',         apiBase: 'https://api.taikoscan.io/api',                  explorerBase: 'https://taikoscan.io'              },
  { chain: 'Fraxtal',       apiBase: 'https://api.fraxscan.com/api',                  explorerBase: 'https://fraxscan.com'              },
  { chain: 'opBNB',         apiBase: 'https://api-opbnb.bscscan.com/api',             explorerBase: 'https://opbnb.bscscan.com'         },
  { chain: 'Polygon zkEVM', apiBase: 'https://api-zkevm.polygonscan.com/api',         explorerBase: 'https://zkevm.polygonscan.com'     },
  // ── Sidechains / L1 alts ───────────────────────────────────────────────────
  { chain: 'Celo',          apiBase: 'https://api.celoscan.io/api',                   explorerBase: 'https://celoscan.io'               },
  { chain: 'Gnosis',        apiBase: 'https://api.gnosisscan.io/api',                 explorerBase: 'https://gnosisscan.io'             },
  { chain: 'Moonbeam',      apiBase: 'https://api.moonscan.io/api',                   explorerBase: 'https://moonscan.io'               },
  { chain: 'Moonriver',     apiBase: 'https://api-moonriver.moonscan.io/api',         explorerBase: 'https://moonriver.moonscan.io'     },
  { chain: 'Kaia',          apiBase: 'https://api-cypress.klaytnscope.com/api',       explorerBase: 'https://kaiascan.io'               },
  { chain: 'Core',          apiBase: 'https://openapi.coredao.org/api',               explorerBase: 'https://scan.coredao.org'          },
  { chain: 'Kava',          apiBase: 'https://kavascan.com/api',                      explorerBase: 'https://kavascan.com'              },
  { chain: 'SEI',           apiBase: 'https://seitrace.com/api',                      explorerBase: 'https://seitrace.com'              },
  { chain: 'Merlin',        apiBase: 'https://scan.merlinchain.io/api',               explorerBase: 'https://scan.merlinchain.io'       },
  { chain: 'Ronin',         apiBase: 'https://app.roninchain.com/api',                explorerBase: 'https://app.roninchain.com'        },
] as const;

/**
 * Chains using BlockScout v2 REST API (different response format from Etherscan).
 * These are scanned separately and merged with the main results.
 */
const CROSS_CHAIN_BLOCKSCOUT_TARGETS = [
  { chain: 'ZetaChain',     apiBase: 'https://zetachain.blockscout.com/api/v2',          explorerBase: 'https://zetachain.blockscout.com'       },
  { chain: 'Zora',          apiBase: 'https://explorer.zora.energy/api/v2',              explorerBase: 'https://explorer.zora.energy'           },
  { chain: 'Soneium',       apiBase: 'https://soneium.blockscout.com/api/v2',            explorerBase: 'https://soneium.blockscout.com'         },
  { chain: 'Bob',           apiBase: 'https://explorer.gobob.xyz/api/v2',                explorerBase: 'https://explorer.gobob.xyz'             },
  { chain: 'Rootstock',     apiBase: 'https://rootstock.blockscout.com/api/v2',          explorerBase: 'https://rootstock.blockscout.com'       },
  { chain: 'Manta Pacific', apiBase: 'https://pacific-explorer.manta.network/api/v2',    explorerBase: 'https://pacific-explorer.manta.network' },
] as const;

const TOTAL_CHAINS_SCANNED = CROSS_CHAIN_TARGETS.length + CROSS_CHAIN_BLOCKSCOUT_TARGETS.length;

interface CrossChainDeployment {
  address:    string;
  txHash:     string;
  timestamp:  number;
  dappScore?: DappScoreMatch;
}

interface CrossChainResult {
  chain:        string;
  explorerBase: string;
  deployments:  CrossChainDeployment[];
  error:        boolean;
}

type CrossChainState =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'done'; results: CrossChainResult[] };

async function scanChainForDeployer(
  apiBase: string,
  deployerAddress: string,
  excludeAddresses: Set<string>,
): Promise<Omit<CrossChainDeployment, 'dappScore'>[]> {
  const res = await fetch(
    `${apiBase}?module=account&action=txlist&address=${deployerAddress}&sort=desc&page=1&offset=50`,
    { signal: AbortSignal.timeout(8_000) },
  );
  const data = await res.json();
  const txs: Array<{ to: string; contractAddress: string; hash: string; timeStamp: string }> =
    Array.isArray(data?.result) ? data.result : [];

  return txs
    .filter(tx => tx.to === '' && tx.contractAddress && !excludeAddresses.has(tx.contractAddress.toLowerCase()))
    .slice(0, 5)
    .map(tx => ({ address: tx.contractAddress, txHash: tx.hash, timestamp: parseInt(tx.timeStamp, 10) }));
}

/** BlockScout v2 REST API — different response shape from Etherscan. */
async function scanBlockscoutChainForDeployer(
  apiBase: string,
  deployerAddress: string,
  excludeAddresses: Set<string>,
): Promise<Omit<CrossChainDeployment, 'dappScore'>[]> {
  const res = await fetch(
    `${apiBase}/addresses/${deployerAddress}/transactions?filter=to%20%7C%20from`,
    { signal: AbortSignal.timeout(8_000) },
  );
  const data = await res.json();
  const items: Array<{
    to: { hash: string } | null;
    created_contract: { hash: string } | null;
    hash: string;
    timestamp: string; // ISO-8601
  }> = Array.isArray(data?.items) ? data.items : [];

  return items
    .filter(tx =>
      tx.to === null &&
      tx.created_contract?.hash &&
      !excludeAddresses.has(tx.created_contract.hash.toLowerCase()),
    )
    .slice(0, 5)
    .map(tx => ({
      address:   tx.created_contract!.hash,
      txHash:    tx.hash,
      timestamp: Math.floor(new Date(tx.timestamp).getTime() / 1000),
    }));
}

// ── Cross-chain section component ─────────────────────────────────────────────

function CrossChainSection({
  deployerAddress,
  currentChain,
  excludeAddresses,
}: {
  deployerAddress:  string;
  currentChain:     string;
  excludeAddresses: string[];
}) {
  const [state, setState] = useState<CrossChainState>({ status: 'idle' });

  useEffect(() => {
    const excluded  = new Set(excludeAddresses.map(a => a.toLowerCase()));
    const targets   = CROSS_CHAIN_TARGETS.filter(t => t.chain.toLowerCase() !== currentChain.toLowerCase());
    const bsTargets = CROSS_CHAIN_BLOCKSCOUT_TARGETS.filter(t => t.chain.toLowerCase() !== currentChain.toLowerCase());
    const allTargets = [...targets, ...bsTargets];

    setState({ status: 'scanning' });

    Promise.allSettled([
      ...targets.map(target =>
        scanChainForDeployer(target.apiBase, deployerAddress, excluded).then(deployments => ({
          chain: target.chain, explorerBase: target.explorerBase,
          deployments: deployments as CrossChainDeployment[],
          error: false,
        })),
      ),
      ...bsTargets.map(target =>
        scanBlockscoutChainForDeployer(target.apiBase, deployerAddress, excluded).then(deployments => ({
          chain: target.chain, explorerBase: target.explorerBase,
          deployments: deployments as CrossChainDeployment[],
          error: false,
        })),
      ),
    ]).then(async (settled) => {
      const results: CrossChainResult[] = settled.map((r, i) =>
        r.status === 'fulfilled'
          ? r.value
          : { chain: allTargets[i].chain, explorerBase: allTargets[i].explorerBase, deployments: [], error: true },
      );

      const found = results.filter(r => r.deployments.length > 0);

      // Enrich with DappScore DB matches
      const allAddresses = found.flatMap(r => r.deployments.map(d => d.address));
      if (allAddresses.length > 0) {
        try {
          const r = await fetch(`${API_BASE}/v1/projects/by-addresses`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ addresses: allAddresses }),
          });
          if (r.ok) {
            const json = await r.json() as { data: Record<string, DappScoreMatch> };
            for (const result of found) {
              for (const d of result.deployments) {
                const match = json.data[d.address.toLowerCase()];
                if (match) d.dappScore = match;
              }
            }
          }
        } catch { /* non-critical */ }
      }

      setState({ status: 'done', results: found });
    }).catch(() => setState({ status: 'done', results: [] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployerAddress, currentChain]);

  if (state.status === 'idle') return null;

  if (state.status === 'scanning') {
    return (
      <div className="flex items-center space-x-1.5 text-gray-600 text-xs pt-2 border-t border-gray-700/60">
        <Globe className="h-3.5 w-3.5 animate-pulse" />
        <span>Scanning {TOTAL_CHAINS_SCANNED} chains for cross-chain activity…</span>
      </div>
    );
  }

  if (state.results.length === 0) {
    return (
      <div className="flex items-center space-x-1.5 text-gray-700 text-xs pt-2 border-t border-gray-700/60">
        <Globe className="h-3.5 w-3.5" />
        <span>No cross-chain deployments found on {TOTAL_CHAINS_SCANNED} chains</span>
      </div>
    );
  }

  const totalDeployments = state.results.reduce((s, r) => s + r.deployments.length, 0);
  const hasScams = state.results.some(r =>
    r.deployments.some(d => d.dappScore && (d.dappScore.trustLevel >= 4 || d.dappScore.status >= 3)),
  );
  const hasSuspicious = !hasScams && state.results.some(r =>
    r.deployments.some(d => d.dappScore && (d.dappScore.trustLevel >= 3 || d.dappScore.status >= 2)),
  );

  return (
    <div className="pt-2 border-t border-gray-700/60 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Globe className={`h-3.5 w-3.5 ${hasScams ? 'text-red-400' : hasSuspicious ? 'text-orange-400' : 'text-gray-400'}`} />
          <span className={`text-xs font-semibold uppercase tracking-wide ${hasScams ? 'text-red-400' : hasSuspicious ? 'text-orange-400' : 'text-gray-400'}`}>
            Cross-chain — {totalDeployments} deployment{totalDeployments !== 1 ? 's' : ''} on {state.results.length} chain{state.results.length !== 1 ? 's' : ''}
          </span>
        </div>
        {(hasScams || hasSuspicious) && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${hasScams ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
            {hasScams ? 'SERIAL RUGGER' : 'SUSPICIOUS'}
          </span>
        )}
      </div>

      {/* Per-chain breakdown */}
      <div className="space-y-1.5">
        {state.results.map(result => {
          const chainScams = result.deployments.filter(
            d => d.dappScore && (d.dappScore.trustLevel >= 4 || d.dappScore.status >= 3),
          ).length;
          const chainSuspicious = result.deployments.filter(
            d => d.dappScore && (d.dappScore.trustLevel >= 3 || d.dappScore.status >= 2) && !(d.dappScore.trustLevel >= 4 || d.dappScore.status >= 3),
          ).length;

          return (
            <div
              key={result.chain}
              className={`rounded-lg border p-2 space-y-1 ${
                chainScams > 0
                  ? 'border-red-500/30 bg-red-500/5'
                  : chainSuspicious > 0
                    ? 'border-orange-500/30 bg-orange-500/5'
                    : 'border-gray-700/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${chainScams > 0 ? 'text-red-400' : chainSuspicious > 0 ? 'text-orange-400' : 'text-gray-400'}`}>
                  {result.chain}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">
                    {result.deployments.length} contract{result.deployments.length !== 1 ? 's' : ''}
                  </span>
                  {chainScams > 0 && (
                    <span className="px-1 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-semibold">SCAM PATTERN</span>
                  )}
                  {chainSuspicious > 0 && chainScams === 0 && (
                    <span className="px-1 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-semibold">SUSPICIOUS</span>
                  )}
                </div>
              </div>

              <div className="space-y-0.5 pl-1 border-l border-gray-700">
                {result.deployments.map(d => {
                  const daysAgo = Math.floor((Date.now() / 1000 - d.timestamp) / 86_400);
                  const url = `${result.explorerBase}/address/${d.address}`;
                  return (
                    <div key={d.address} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                        >
                          {truncate(d.address)}
                          <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                        </a>
                        {d.dappScore && <TrustBadge match={d.dappScore} />}
                      </div>
                      <span className="text-xs text-gray-600 shrink-0">
                        {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-700">
        Same wallet address · {TOTAL_CHAINS_SCANNED} EVM chains scanned · Solana & TON use different key systems
      </p>
    </div>
  );
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; info: DeployerInfo }
  | { status: 'error' }
  | { status: 'no-creator' }    // creation record not available
  | { status: 'unsupported' };  // non-EVM or no apiBase

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

function walletAgeLabel(firstTxTs: number | null): { label: string; days: number | null } {
  if (firstTxTs === null) return { label: 'Age unknown', days: null };
  const days = Math.floor((Date.now() / 1000 - firstTxTs) / 86_400);
  if (days < 365) return { label: `${days}d old wallet`, days };
  const years = Math.floor(days / 365);
  const rem   = Math.floor((days % 365) / 30);
  const label = rem > 0 ? `${years}yr ${rem}mo wallet` : `${years}yr old wallet`;
  return { label, days };
}

type AgeRisk = 'very-high' | 'high' | 'medium' | 'low';

function contractAgeRisk(creationTs: number | null): {
  label: string;
  risk: AgeRisk | null;
  hours: number | null;
} {
  if (creationTs === null) return { label: 'Age unknown', risk: null, hours: null };
  const hours = (Date.now() / 1000 - creationTs) / 3600;
  if (hours < 24)         return { label: `${Math.floor(hours)}h old`,              risk: 'very-high', hours };
  if (hours < 24 * 7)     return { label: `${Math.floor(hours / 24)}d old`,         risk: 'high',      hours };
  if (hours < 24 * 30)    return { label: `${Math.floor(hours / 24)}d old`,         risk: 'medium',    hours };
  if (hours < 24 * 365)   return { label: `${Math.floor(hours / 24)}d old`,         risk: 'low',       hours };
  const years = Math.floor(hours / (24 * 365));
  return { label: `${years}yr old`, risk: 'low', hours };
}

const AGE_RISK_STYLES: Record<AgeRisk, { text: string; badge: string; label: string }> = {
  'very-high': { text: 'text-red-400',    badge: 'bg-red-500/20 text-red-400',    label: 'VERY HIGH RISK' },
  'high':      { text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-400', label: 'HIGH RISK' },
  'medium':    { text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400', label: 'MEDIUM RISK' },
  'low':       { text: 'text-green-400',  badge: 'bg-green-500/20 text-green-400',   label: 'LOW RISK' },
};

function deploymentCountRisk(n: number): 'ok' | 'warn' {
  // 1–4 other contracts = worth noting; 5+ = pattern deployer
  return n >= 5 ? 'warn' : 'ok';
}

function TrustBadge({ match }: { match: DappScoreMatch }) {
  const isBad = match.trustLevel >= 3 || match.status >= 2;
  if (!isBad) return null;
  const labels: Record<number, string> = { 3: 'Suspicious', 4: 'Suspected Scam', 5: 'Probable Scam' };
  const statusLabels: Record<number, string> = { 2: 'Flagged', 3: 'Suspended', 4: 'Blacklisted' };
  const label = match.status >= 2 ? statusLabels[match.status] : labels[match.trustLevel];
  return (
    <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-semibold shrink-0">
      {label ?? 'Flagged'}
    </span>
  );
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchDeployerInfo(
  apiBase: string,
  contractAddress: string,
): Promise<DeployerInfo> {
  // Step 1: get the contract creator + creation tx hash
  const creationRes = await fetch(
    `${apiBase}?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}`,
  );
  const creationData = await creationRes.json();
  const deployer: string | undefined        = creationData?.result?.[0]?.contractCreator;
  const creationTxHash: string | undefined  = creationData?.result?.[0]?.txHash;
  if (!deployer) throw new Error('no-creator');

  // Step 2: wallet age — earliest transaction
  const firstTxRes = await fetch(
    `${apiBase}?module=account&action=txlist&address=${deployer}&sort=asc&page=1&offset=1`,
  );
  const firstTxData = await firstTxRes.json();
  const firstTx = firstTxData?.result?.[0];
  const firstTxTimestamp = firstTx ? parseInt(firstTx.timeStamp, 10) : null;

  // Step 3: recent txs — find other contract deployments (to == "" means contract creation)
  const recentRes = await fetch(
    `${apiBase}?module=account&action=txlist&address=${deployer}&sort=desc&page=1&offset=100`,
  );
  const recentData = await recentRes.json();
  const txs: Array<{
    to: string;
    contractAddress: string;
    hash: string;
    timeStamp: string;
  }> = Array.isArray(recentData?.result) ? recentData.result : [];

  const deployedContracts: DeployedContract[] = txs
    .filter(
      (tx) =>
        tx.to === '' &&
        tx.contractAddress &&
        tx.contractAddress.toLowerCase() !== contractAddress.toLowerCase(),
    )
    .slice(0, 10)
    .map((tx) => ({
      address: tx.contractAddress,
      txHash: tx.hash,
      timestamp: parseInt(tx.timeStamp, 10),
    }));

  // Resolve the creation timestamp for THIS contract.
  // First check if the creation tx is already in the deployer's recent 100 txs
  // (true for recently deployed contracts — the common rug case).
  // Fall back to block explorer proxy calls for older contracts.
  let contractCreationTimestamp: number | null = null;
  if (creationTxHash) {
    const creationTxInList = txs.find(
      (tx) => tx.hash.toLowerCase() === creationTxHash.toLowerCase(),
    );
    if (creationTxInList) {
      contractCreationTimestamp = parseInt(creationTxInList.timeStamp, 10);
    } else {
      try {
        // eth_getTransactionByHash → get blockNumber (hex)
        const txRes   = await fetch(`${apiBase}?module=proxy&action=eth_getTransactionByHash&txhash=${creationTxHash}`);
        const txData  = await txRes.json();
        const blockHex: string | undefined = txData?.result?.blockNumber;
        if (blockHex) {
          // eth_getBlockByNumber → get timestamp (hex)
          const blkRes  = await fetch(`${apiBase}?module=proxy&action=eth_getBlockByNumber&tag=${blockHex}&boolean=false`);
          const blkData = await blkRes.json();
          const tsHex: string | undefined = blkData?.result?.timestamp;
          if (tsHex) contractCreationTimestamp = parseInt(tsHex, 16);
        }
      } catch {
        // non-critical — contract age just won't display
      }
    }
  }

  // Enrich with DappScore data for deployed contracts
  if (deployedContracts.length > 0) {
    try {
      const res = await fetch(`${API_BASE}/v1/projects/by-addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: deployedContracts.map(c => c.address) }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data: Record<string, DappScoreMatch> };
        for (const c of deployedContracts) {
          const match = json.data[c.address.toLowerCase()];
          if (match) c.dappScore = match;
        }
      }
    } catch {
      // non-critical — badges just won't show
    }
  }

  return { deployer, firstTxTimestamp, contractCreationTimestamp, deployedContracts };
}

// ── Solana deployer via SolScan ───────────────────────────────────────────────

const SOLANA_BPF_LOADERS = new Set([
  'BPFLoaderUpgradeab1e11111111111111111111111',
  'BPFLoader2111111111111111111111111111111111',
]);

interface SolScanTx {
  txHash:    string;
  blockTime: number;
  parsedInstruction?: Array<{ programId: string; type?: string }>;
}

interface SolanaDeployerInfo {
  upgradeAuthority: string | null;
  programDeployments: Array<{ txHash: string; timestamp: number }>;
  oldestSeenTs: number | null;
}

async function fetchSolanaDeployerInfo(programAddress: string): Promise<SolanaDeployerInfo> {
  // Step 1: get upgrade authority from SolScan account endpoint
  const accountRes = await fetch(
    `https://public-api.solscan.io/account/${programAddress}`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) },
  );
  if (!accountRes.ok) throw new Error(`SolScan account ${accountRes.status}`);
  const accountData = await accountRes.json() as {
    data?: { programInfo?: { upgradeAuthority?: string } };
  };
  const upgradeAuthority = accountData?.data?.programInfo?.upgradeAuthority ?? null;

  if (!upgradeAuthority) {
    return { upgradeAuthority: null, programDeployments: [], oldestSeenTs: null };
  }

  // Step 2: get recent transactions for the upgrade authority
  const txRes = await fetch(
    `https://public-api.solscan.io/account/transactions?account=${upgradeAuthority}&limit=50`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) },
  );
  if (!txRes.ok) {
    return { upgradeAuthority, programDeployments: [], oldestSeenTs: null };
  }
  const txs = await txRes.json() as SolScanTx[];
  if (!Array.isArray(txs)) {
    return { upgradeAuthority, programDeployments: [], oldestSeenTs: null };
  }

  // Filter for program deployment transactions
  const programDeployments = txs
    .filter(tx => tx.parsedInstruction?.some(i => SOLANA_BPF_LOADERS.has(i.programId)))
    .slice(0, 10)
    .map(tx => ({ txHash: tx.txHash, timestamp: tx.blockTime }));

  const oldestSeenTs = txs.length > 0
    ? Math.min(...txs.map(tx => tx.blockTime))
    : null;

  return { upgradeAuthority, programDeployments, oldestSeenTs };
}

type SolanaState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; info: SolanaDeployerInfo }
  | { status: 'error' };

function SolanaDeployerRow({ address }: { address: string }) {
  const [state, setState] = useState<SolanaState>({ status: 'idle' });

  useEffect(() => {
    setState({ status: 'loading' });
    fetchSolanaDeployerInfo(address)
      .then(info => setState({ status: 'ok', info }))
      .catch(() => setState({ status: 'error' }));
  }, [address]);

  const solscanBase = 'https://solscan.io';

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-2">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Solana</span>

      {state.status === 'loading' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Fetching upgrade authority…</span>
        </div>
      )}

      {state.status === 'error' && (
        <span className="text-xs text-gray-500">SolScan lookup unavailable</span>
      )}

      {state.status === 'ok' && (() => {
        const { info } = state;

        if (!info.upgradeAuthority) {
          return (
            <div className="flex items-center space-x-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
              <span className="text-sm text-green-400">No upgrade authority — program is immutable</span>
            </div>
          );
        }

        const authorityUrl = `${solscanBase}/account/${info.upgradeAuthority}`;
        const daysOldMin = info.oldestSeenTs
          ? Math.floor((Date.now() / 1000 - info.oldestSeenTs) / 86_400)
          : null;
        const deployCount = info.programDeployments.length;
        const countRisk = deploymentCountRisk(deployCount);

        return (
          <div className="space-y-2">
            {/* Upgrade authority */}
            <div className="flex items-center space-x-1.5">
              <User className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
              <span className="text-xs text-gray-500">Upgrade authority</span>
              <a
                href={authorityUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
              >
                {truncate(info.upgradeAuthority)}
                <ExternalLink className="h-3 w-3 ml-0.5" />
              </a>
            </div>

            {/* Wallet activity age (lower bound) */}
            {daysOldMin !== null && (
              <div className="flex items-center space-x-1.5">
                <Clock className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-300">
                  Active ≥ {daysOldMin}d (based on last 50 txs)
                </span>
              </div>
            )}

            {/* Program deployments by this authority */}
            {deployCount === 0 ? (
              <div className="flex items-center space-x-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                <span className="text-sm text-gray-400">No recent program deployments detected</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                <Box className={`h-3.5 w-3.5 flex-shrink-0 ${countRisk === 'warn' ? 'text-orange-400' : 'text-gray-400'}`} />
                <span className={`text-sm ${countRisk === 'warn' ? 'text-orange-400' : 'text-gray-300'}`}>
                  {deployCount} program deployment{deployCount !== 1 ? 's' : ''} in last 50 txs
                </span>
                {countRisk === 'warn' && (
                  <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">PATTERN</span>
                )}
              </div>
            )}

            {deployCount > 0 && (
              <div className="space-y-1 pl-1 border-l border-gray-700">
                {info.programDeployments.map(d => {
                  const daysAgo = Math.floor((Date.now() / 1000 - d.timestamp) / 86_400);
                  const url = `${solscanBase}/tx/${d.txHash}`;
                  return (
                    <div key={d.txHash} className="flex items-center justify-between gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                      >
                        {truncate(d.txHash, 4)}
                        <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                      </a>
                      <span className="text-xs text-gray-600 shrink-0">
                        {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-gray-600 pt-1">
              Solana upgrade authority · EVM cross-chain scan not applicable (different key system)
            </p>
          </div>
        );
      })()}
    </div>
  );
}

// ── Single contract row ───────────────────────────────────────────────────────

function ContractRow({
  chain,
  address,
  expanded = false,
  onRisk,
}: ContractAddress & { expanded?: boolean; onRisk?: (risk: DeployerRisk) => void }) {
  const [state, setState]     = useState<State>({ status: 'idle' });
  const [deployer, setDeployer] = useState<string | null>(null);

  useEffect(() => {
    const config = getChainConfig(chain);
    if (!config || config.family !== 'evm' || !config.apiBase) {
      setState({ status: 'unsupported' });
      return;
    }
    setState({ status: 'loading' });
    fetchDeployerInfo(config.apiBase, address)
      .then((info) => {
        setState({ status: 'ok', info });
        setDeployer(info.deployer);

        // Surface risk to parent (for top-of-fold banner) once DB matches are resolved
        if (onRisk && info.deployedContracts.length > 0) {
          const matched = info.deployedContracts
            .filter(c => c.dappScore)
            .map(c => c.dappScore as DappScoreMatch);

          const scamCount       = matched.filter(p => p.trustLevel >= 4 || p.status >= 3).length;
          const suspiciousCount = matched.filter(p => (p.trustLevel === 3 || p.status === 2) && !(p.trustLevel >= 4 || p.status >= 3)).length;

          if (scamCount > 0 || suspiciousCount > 0) {
            onRisk({
              deployerAddress:  info.deployer,
              scamCount,
              suspiciousCount,
              knownProjects:    matched as KnownProject[],
            });
          }
        }
      })
      .catch((e: Error) => {
        if (e.message === 'no-creator') setState({ status: 'no-creator' });
        else setState({ status: 'error' });
      });
  }, [address, chain, onRisk]);

  const explorerBase = getExplorerUrl(chain, address)?.replace(`/address/${address}`, '') ?? '';

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-2">
      {/* Chain header */}
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>

      {state.status === 'loading' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Tracing deployer…</span>
        </div>
      )}

      {state.status === 'unsupported' && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-xs">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Chain not supported (EVM only)</span>
        </div>
      )}

      {(state.status === 'no-creator' || state.status === 'error') && (
        <span className="text-xs text-gray-500">Deployer data unavailable</span>
      )}

      {/* Cross-chain scan — starts as soon as the deployer address is known */}
      {deployer && (
        <CrossChainSection
          deployerAddress={deployer}
          currentChain={chain}
          excludeAddresses={[address]}
        />
      )}

      {state.status === 'ok' && (() => {
        const { info } = state;
        const age = walletAgeLabel(info.firstTxTimestamp);
        const otherCount = info.deployedContracts.length;
        const countRisk = deploymentCountRisk(otherCount);
        const deployerUrl = `${explorerBase}/address/${info.deployer}`;

        return (
          <div className="space-y-2">
            {/* Deployer address */}
            <div className="flex items-center space-x-1.5">
              <User className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
              <span className="text-xs text-gray-500">Deployer</span>
              <a
                href={deployerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
              >
                {truncate(info.deployer)}
                <ExternalLink className="h-3 w-3 ml-0.5" />
              </a>
            </div>

            {/* Contract age with risk bucket */}
            {(() => {
              const cAge = contractAgeRisk(info.contractCreationTimestamp);
              if (cAge.risk === null) return null;
              const s = AGE_RISK_STYLES[cAge.risk];
              return (
                <div className="flex items-center space-x-1.5">
                  <Shield className={`h-3.5 w-3.5 flex-shrink-0 ${s.text}`} />
                  <span className={`text-sm ${s.text}`}>Contract {cAge.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${s.badge}`}>
                    {s.label}
                  </span>
                </div>
              );
            })()}

            {/* Wallet age — informational only; new wallets can be a deliberate security choice */}
            <div className="flex items-center space-x-1.5">
              <Clock className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
              <span className="text-sm text-gray-300">{age.label}</span>
            </div>

            {/* Other deployments count */}
            {otherCount === 0 ? (
              <div className="flex items-center space-x-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                <span className="text-sm text-gray-400">No other recent deployments</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                <Box className={`h-3.5 w-3.5 flex-shrink-0 ${countRisk === 'warn' ? 'text-orange-400' : 'text-gray-400'}`} />
                <span className={`text-sm ${countRisk === 'warn' ? 'text-orange-400' : 'text-gray-300'}`}>
                  {otherCount} other contract{otherCount !== 1 ? 's' : ''} deployed
                  {otherCount === 10 && '+'}
                </span>
                {countRisk === 'warn' && (
                  <span className="text-xs px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">PATTERN</span>
                )}
              </div>
            )}

            {/* Other deployment list */}
            {otherCount > 0 && (
              <div className="space-y-1 pl-1 border-l border-gray-700">
                {(expanded ? info.deployedContracts : info.deployedContracts.slice(0, 5)).map((c) => {
                  const daysAgo = Math.floor((Date.now() / 1000 - c.timestamp) / 86_400);
                  const url = `${explorerBase}/address/${c.address}`;
                  return (
                    <div key={c.address} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                        >
                          {truncate(c.address)}
                          <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                        </a>
                        {c.dappScore && <TrustBadge match={c.dappScore} />}
                      </div>
                      <span className="text-xs text-gray-600 shrink-0">
                        {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}
                      </span>
                    </div>
                  );
                })}
                {!expanded && otherCount > 5 && (
                  <span className="text-xs text-gray-500">
                    +{otherCount - 5} more — see Full Analysis
                  </span>
                )}
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
  /** When true, render all deployed contracts instead of top 5. Used by the analysis page. */
  expanded?: boolean;
  /**
   * Called once per deployer address when cross-referencing completes.
   * Used by ProjectDetail to render the top-of-fold SerialRuggerBanner.
   */
  onRisk?: (risk: DeployerRisk) => void;
}

export default function DeployerHistoryPanel({ contractAddresses, expanded = false, onRisk }: Props) {
  const enabled = useFeatureFlag('deployerHistory', false);
  if (!enabled) return null;

  const evmSupported = contractAddresses.filter(({ chain }) => {
    const config = getChainConfig(chain);
    return config?.family === 'evm' && !!config.apiBase;
  });
  const solanaAddresses = contractAddresses.filter(({ chain }) => {
    const config = getChainConfig(chain);
    return config?.family === 'solana';
  });

  if (evmSupported.length === 0 && solanaAddresses.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <User className="h-4 w-4 text-gray-400" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Deployer History</h3>
      </div>

      <div className="space-y-3">
        {evmSupported.map(({ chain, address }) => (
          <ContractRow key={`${chain}:${address}`} chain={chain} address={address} expanded={expanded} onRisk={onRisk} />
        ))}
        {solanaAddresses.map(({ address }) => (
          <SolanaDeployerRow key={`solana:${address}`} address={address} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        {evmSupported.length > 0
          ? `Cross-chain deployer scan: ${TOTAL_CHAINS_SCANNED} EVM chains (Etherscan + BlockScout)`
          : 'Solana upgrade authority via SolScan'}
        {evmSupported.length > 0 && solanaAddresses.length > 0 && ' · Solana: upgrade authority via SolScan'}
        {' '}· TON uses a different cryptographic key system
      </p>
    </div>
  );
}
