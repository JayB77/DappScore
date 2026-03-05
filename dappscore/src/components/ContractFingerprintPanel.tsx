'use client';

import { useEffect, useState } from 'react';
import {
  Code2, CheckCircle, XCircle, Loader2, ExternalLink, Layers,
  AlertTriangle, HelpCircle,
} from 'lucide-react';
import {
  fetchContractInfo,
  getChainConfig,
  getExplorerUrl,
  hasApiSupport,
  type ContractInfo,
} from '@/lib/chainAdapters';

// ── Types ────────────────────────────────────────────────────────────────────

interface ContractAddress {
  chain: string;
  address: string;
}

type ContractState =
  | { state: 'loading' }
  | { state: 'ok'; info: ContractInfo }
  | { state: 'error' }
  | { state: 'unsupported' }
  | { state: 'no-api' };   // chain known but no programmatic lookup

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

/** Per-chain label for "verified" concept */
function verifiedLabel(info: ContractInfo): string {
  if (info.chainFamily === 'solana') return 'Anchor IDL published';
  if (info.chainFamily === 'tron')   return 'ABI published';
  return 'Source verified';
}

/** Per-chain label for "unverified" */
function unverifiedLabel(info: ContractInfo): string {
  if (info.chainFamily === 'solana') return 'No IDL — closed source';
  if (info.chainFamily === 'tron')   return 'No ABI published';
  return 'Unverified source';
}

/** Per-chain label for upgradeable */
function upgradeableLabel(info: ContractInfo): string {
  if (info.chainFamily === 'solana') return 'Upgradeable program';
  return 'Upgradeable proxy';
}

/** Per-chain label for deployer / creator */
function creatorLabel(info: ContractInfo): string {
  if (info.chainFamily === 'solana') return 'Upgrade authority';
  return 'Deployed by';
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  contractAddresses: ContractAddress[];
}

export default function ContractFingerprintPanel({ contractAddresses }: Props) {
  const [states, setStates] = useState<Record<string, ContractState>>({});

  useEffect(() => {
    for (const { chain, address } of contractAddresses) {
      if (!chain || !address) continue;
      const key = `${chain}:${address}`;
      const config = getChainConfig(chain);

      if (!config) {
        setStates((prev) => ({ ...prev, [key]: { state: 'unsupported' } }));
        continue;
      }

      if (!hasApiSupport(chain)) {
        setStates((prev) => ({ ...prev, [key]: { state: 'no-api' } }));
        continue;
      }

      setStates((prev) => ({ ...prev, [key]: { state: 'loading' } }));
      fetchContractInfo(chain, address)
        .then((info) => setStates((prev) => ({ ...prev, [key]: { state: 'ok', info } })))
        .catch(() => setStates((prev) => ({ ...prev, [key]: { state: 'error' } })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valid = contractAddresses.filter((c) => c.chain && c.address);
  if (valid.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-gray-400">Contract Signals</h3>

      <div className="space-y-3">
        {valid.map(({ chain, address }) => {
          const key = `${chain}:${address}`;
          const s = states[key];
          const explorerUrl = getExplorerUrl(chain, address);

          return (
            <div key={key} className="border border-gray-700 rounded-lg p-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{chain}</span>
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
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

              {/* State */}
              {!s || s.state === 'loading' ? (
                <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Analyzing...</span>
                </div>
              ) : s.state === 'unsupported' ? (
                <div className="flex items-center space-x-1.5 text-gray-500 text-xs">
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>Chain not yet supported</span>
                </div>
              ) : s.state === 'no-api' ? (
                <div className="flex items-center space-x-1.5 text-gray-500 text-xs">
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>No explorer API — view on chain</span>
                </div>
              ) : s.state === 'error' ? (
                <div className="flex items-center space-x-1.5 text-gray-500 text-sm">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Unable to analyze</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {/* Contract / program name */}
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
                      <span className="text-sm text-green-400">{verifiedLabel(s.info)}</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                      <span className="text-sm text-red-400">{unverifiedLabel(s.info)}</span>
                      <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">RED FLAG</span>
                    </div>
                  )}

                  {/* Upgradeable */}
                  {s.info.isProxy && (
                    <div className="flex items-center space-x-1.5">
                      <Layers className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
                      <span className="text-sm text-yellow-400">{upgradeableLabel(s.info)}</span>
                    </div>
                  )}

                  {/* Creator / upgrade authority */}
                  {s.info.creator && (
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs text-gray-500">{creatorLabel(s.info)}</span>
                      {explorerUrl ? (
                        <a
                          href={getExplorerUrl(chain, s.info.creator) ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                        >
                          {truncate(s.info.creator)}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 font-mono">{truncate(s.info.creator)}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Contract data via block explorer APIs · Solana via public RPC + SolScan
      </p>
    </div>
  );
}
