'use client';

import { useEffect, useState } from 'react';
import { Code2, CheckCircle, XCircle, Loader2, ExternalLink, Layers } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface ContractAddress {
  chain: string;
  address: string;
}

interface ContractInfo {
  verified: boolean;
  contractName: string;
  isProxy: boolean;
  creator?: string;
}

type ContractState =
  | { state: 'loading' }
  | { state: 'ok'; info: ContractInfo }
  | { state: 'error' }
  | { state: 'unsupported' };

// ── Chain maps ───────────────────────────────────────────────────────────────

const CHAIN_API: Record<string, string> = {
  ethereum:        'https://api.etherscan.io/api',
  eth:             'https://api.etherscan.io/api',
  base:            'https://api.basescan.org/api',
  polygon:         'https://api.polygonscan.com/api',
  matic:           'https://api.polygonscan.com/api',
  bsc:             'https://api.bscscan.com/api',
  'bnb smart chain': 'https://api.bscscan.com/api',
  arbitrum:        'https://api.arbiscan.io/api',
  optimism:        'https://api-optimistic.etherscan.io/api',
  avalanche:       'https://api.snowtrace.io/api',
  avax:            'https://api.snowtrace.io/api',
};

const CHAIN_EXPLORER: Record<string, string> = {
  ethereum:        'https://etherscan.io',
  eth:             'https://etherscan.io',
  base:            'https://basescan.org',
  polygon:         'https://polygonscan.com',
  matic:           'https://polygonscan.com',
  bsc:             'https://bscscan.com',
  'bnb smart chain': 'https://bscscan.com',
  arbitrum:        'https://arbiscan.io',
  optimism:        'https://optimistic.etherscan.io',
  avalanche:       'https://snowtrace.io',
  avax:            'https://snowtrace.io',
};

function getApiBase(chain: string): string | null {
  return CHAIN_API[chain.toLowerCase()] ?? null;
}

function getExplorerBase(chain: string): string | null {
  return CHAIN_EXPLORER[chain.toLowerCase()] ?? null;
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Fetcher (browser-side; all these APIs support CORS) ──────────────────────

async function fetchContractInfo(chain: string, address: string): Promise<ContractInfo> {
  const apiBase = getApiBase(chain);
  if (!apiBase) throw new Error('unsupported');

  const [sourceRes, creationRes] = await Promise.all([
    fetch(`${apiBase}?module=contract&action=getsourcecode&address=${address}`),
    fetch(`${apiBase}?module=contract&action=getcontractcreation&contractaddresses=${address}`),
  ]);

  const [sourceData, creationData] = await Promise.all([
    sourceRes.json(),
    creationRes.json(),
  ]);

  const source = sourceData?.result?.[0];
  const creation = creationData?.result?.[0];

  const verified = source && source.ABI !== 'Contract source code not verified' && source.ABI !== '';
  const contractName = source?.ContractName ?? '';
  const isProxy = source?.IsProxy === '1';

  return {
    verified: !!verified,
    contractName,
    isProxy,
    creator: creation?.contractCreator,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  contractAddresses: ContractAddress[];
}

export default function ContractFingerprintPanel({ contractAddresses }: Props) {
  const [states, setStates] = useState<Record<string, ContractState>>({});

  const supported = contractAddresses.filter(
    (c) => c.address && c.chain && getApiBase(c.chain),
  );

  const unsupported = contractAddresses.filter(
    (c) => c.address && c.chain && !getApiBase(c.chain),
  );

  useEffect(() => {
    for (const { chain, address } of supported) {
      const key = `${chain}:${address}`;
      setStates((prev) => ({ ...prev, [key]: { state: 'loading' } }));
      fetchContractInfo(chain, address)
        .then((info) => setStates((prev) => ({ ...prev, [key]: { state: 'ok', info } })))
        .catch(() => setStates((prev) => ({ ...prev, [key]: { state: 'error' } })));
    }
    for (const { chain, address } of unsupported) {
      const key = `${chain}:${address}`;
      setStates((prev) => ({ ...prev, [key]: { state: 'unsupported' } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (contractAddresses.length === 0) return null;

  const all = [...supported, ...unsupported];

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-gray-400">Contract Signals</h3>

      <div className="space-y-3">
        {all.map(({ chain, address }) => {
          const key = `${chain}:${address}`;
          const s = states[key];
          const explorerBase = getExplorerBase(chain);

          return (
            <div key={key} className="border border-gray-700 rounded-lg p-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>
                {explorerBase ? (
                  <a
                    href={`${explorerBase}/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <span className="font-mono">{truncate(address)}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="font-mono text-xs text-gray-500">{truncate(address)}</span>
                )}
              </div>

              {/* Body */}
              {!s || s.state === 'loading' ? (
                <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Analyzing...</span>
                </div>
              ) : s.state === 'unsupported' ? (
                <span className="text-gray-500 text-xs">Explorer not yet supported for this chain</span>
              ) : s.state === 'error' ? (
                <span className="text-gray-500 text-sm">Unable to analyze</span>
              ) : (
                <div className="space-y-1.5">
                  {/* Contract name */}
                  {s.info.contractName && (
                    <div className="flex items-center space-x-1.5">
                      <Code2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-300">{s.info.contractName}</span>
                    </div>
                  )}

                  {/* Verified */}
                  {s.info.verified ? (
                    <div className="flex items-center space-x-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                      <span className="text-sm text-green-400">Source verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                      <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                      <span className="text-sm text-red-400">Unverified source</span>
                      <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">RED FLAG</span>
                    </div>
                  )}

                  {/* Proxy */}
                  {s.info.isProxy && (
                    <div className="flex items-center space-x-1.5">
                      <Layers className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
                      <span className="text-sm text-yellow-400">Upgradeable proxy</span>
                    </div>
                  )}

                  {/* Deployer */}
                  {s.info.creator && explorerBase && (
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-gray-500">Deployed by</span>
                      <a
                        href={`${explorerBase}/address/${s.info.creator}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                      >
                        {truncate(s.info.creator)}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600 mt-4">Contract data via block explorer APIs</p>
    </div>
  );
}
