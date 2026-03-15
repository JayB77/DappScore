'use client';

import { useEffect, useState } from 'react';
import {
  User, Clock, AlertTriangle, ExternalLink, Loader2,
  Box, HelpCircle, CheckCircle, Shield,
} from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';
import { getChainConfig, getExplorerUrl } from '@/lib/chainAdapters';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContractAddress { chain: string; address: string }

interface DappScoreMatch {
  id: string;
  name: string;
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

// ── Single contract row ───────────────────────────────────────────────────────

function ContractRow({ chain, address, expanded = false }: ContractAddress & { expanded?: boolean }) {
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    const config = getChainConfig(chain);
    if (!config || config.family !== 'evm' || !config.apiBase) {
      setState({ status: 'unsupported' });
      return;
    }
    setState({ status: 'loading' });
    fetchDeployerInfo(config.apiBase, address)
      .then((info) => setState({ status: 'ok', info }))
      .catch((e: Error) => {
        if (e.message === 'no-creator') setState({ status: 'no-creator' });
        else setState({ status: 'error' });
      });
  }, [address, chain]);

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
}

export default function DeployerHistoryPanel({ contractAddresses, expanded = false }: Props) {
  const enabled = useFeatureFlag('deployerHistory', false);
  if (!enabled) return null;

  // Only show for EVM contracts with apiBase
  const supported = contractAddresses.filter(({ chain }) => {
    const config = getChainConfig(chain);
    return config?.family === 'evm' && !!config.apiBase;
  });
  if (supported.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <User className="h-4 w-4 text-gray-400" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Deployer History</h3>
      </div>

      <div className="space-y-3">
        {supported.map(({ chain, address }) => (
          <ContractRow key={`${chain}:${address}`} chain={chain} address={address} expanded={expanded} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Contract age, wallet age &amp; deployment history via block explorer APIs · EVM chains only
      </p>
    </div>
  );
}
