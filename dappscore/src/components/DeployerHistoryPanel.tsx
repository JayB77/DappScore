'use client';

import { useEffect, useState } from 'react';
import {
  User, Clock, AlertTriangle, ExternalLink, Loader2,
  Box, HelpCircle, CheckCircle,
} from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';
import { getChainConfig, getExplorerUrl } from '@/lib/chainAdapters';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContractAddress { chain: string; address: string }

interface DeployedContract {
  address: string;
  txHash: string;
  timestamp: number;   // unix seconds
}

interface DeployerInfo {
  deployer: string;
  firstTxTimestamp: number | null;   // unix seconds; null = no txs found
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

function deploymentCountRisk(n: number): 'ok' | 'warn' {
  // 1–4 other contracts = worth noting; 5+ = pattern deployer
  return n >= 5 ? 'warn' : 'ok';
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchDeployerInfo(
  apiBase: string,
  contractAddress: string,
): Promise<DeployerInfo> {
  // Step 1: get the contract creator
  const creationRes = await fetch(
    `${apiBase}?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}`,
  );
  const creationData = await creationRes.json();
  const deployer: string | undefined = creationData?.result?.[0]?.contractCreator;
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

  return { deployer, firstTxTimestamp, deployedContracts };
}

// ── Single contract row ───────────────────────────────────────────────────────

function ContractRow({ chain, address }: ContractAddress) {
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
                {info.deployedContracts.slice(0, 5).map((c) => {
                  const daysAgo = Math.floor((Date.now() / 1000 - c.timestamp) / 86_400);
                  const url = `${explorerBase}/address/${c.address}`;
                  return (
                    <div key={c.address} className="flex items-center justify-between">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                      >
                        {truncate(c.address)}
                        <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                      </a>
                      <span className="text-xs text-gray-600">
                        {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}
                      </span>
                    </div>
                  );
                })}
                {otherCount > 5 && (
                  <a
                    href={deployerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                  >
                    +{otherCount - 5} more — view on explorer
                  </a>
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
}

export default function DeployerHistoryPanel({ contractAddresses }: Props) {
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
          <ContractRow key={`${chain}:${address}`} chain={chain} address={address} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Wallet age &amp; deployment history via block explorer APIs · EVM chains only
      </p>
    </div>
  );
}
