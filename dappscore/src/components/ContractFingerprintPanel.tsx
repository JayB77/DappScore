'use client';

import { useEffect, useState } from 'react';
import {
  Code2, CheckCircle, XCircle, Loader2, ExternalLink, Layers,
  AlertTriangle, HelpCircle, Dna, ShieldAlert,
} from 'lucide-react';
import {
  fetchContractInfo,
  getChainConfig,
  getExplorerUrl,
  hasApiSupport,
  type ContractInfo,
} from '@/lib/chainAdapters';
import type { LoadState } from '@/lib/useProjectSignals';

// ── Rug Genome types ─────────────────────────────────────────────────────────

interface SimilarScam {
  name: string;
  similarity: number;
  wasScam: boolean;
}

interface ContractFingerprint {
  bytecodeHash: string;
  selectorCount: number;
  proxyType: string;
  obfuscationScore: number;
  similarScams: SimilarScam[];
  genomeSummary: string;
}

type GenomeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: ContractFingerprint }
  | { status: 'error' };

// ── Rug genome sub-component ─────────────────────────────────────────────────

function RugGenomeSection({ chain, address }: { chain: string; address: string }) {
  const [genome, setGenome] = useState<GenomeState>({ status: 'idle' });

  useEffect(() => {
    // Only run for EVM chains (chains with 0x addresses)
    if (!address.startsWith('0x')) { setGenome({ status: 'idle' }); return; }
    setGenome({ status: 'loading' });

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
    fetch(`${backendUrl}/api/scam-detection/fingerprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractAddress: address, network: 'mainnet' }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.success) setGenome({ status: 'ok', data: json.data });
        else setGenome({ status: 'error' });
      })
      .catch(() => setGenome({ status: 'error' }));
  }, [chain, address]);

  if (genome.status === 'idle') return null;
  if (genome.status === 'loading') return (
    <div className="flex items-center space-x-1.5 text-gray-500 text-xs pt-2 border-t border-gray-700 mt-2">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Analysing rug genome…</span>
    </div>
  );
  if (genome.status === 'error') return null; // silent fail

  const { data } = genome;
  const topScam = data.similarScams.find(s => s.wasScam);
  const pct = topScam ? Math.round(topScam.similarity * 100) : 0;

  const obfColor =
    data.obfuscationScore > 60 ? 'text-red-400' :
    data.obfuscationScore > 30 ? 'text-orange-400' :
    'text-gray-400';

  return (
    <div className="pt-2 mt-2 border-t border-gray-700 space-y-2">
      {/* Genome summary */}
      <div className="flex items-start space-x-1.5">
        <Dna className="h-3.5 w-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
        <span className="text-xs text-gray-300">{data.genomeSummary}</span>
      </div>

      {/* Top rug match bar */}
      {topScam && pct > 50 && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 truncate max-w-[65%]">{topScam.name}</span>
            <span className={pct >= 80 ? 'text-red-400 font-semibold' : 'text-orange-400'}>
              {pct}% match
            </span>
          </div>
          <div className="bg-gray-700 rounded-full h-1 overflow-hidden">
            <div
              className={`h-full rounded-full ${pct >= 80 ? 'bg-red-500' : 'bg-orange-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Obfuscation score */}
      {data.obfuscationScore > 0 && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 text-gray-500">
            <ShieldAlert className="h-3 w-3" />
            <span>Code obfuscation</span>
          </div>
          <span className={`font-medium ${obfColor}`}>{data.obfuscationScore}/100</span>
        </div>
      )}

      {/* Function count */}
      {data.selectorCount > 0 && (
        <p className="text-xs text-gray-600">
          {data.selectorCount} function selector{data.selectorCount !== 1 ? 's' : ''} detected
          {data.proxyType !== 'none' ? ` · ${data.proxyType} proxy` : ''}
        </p>
      )}
    </div>
  );
}

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
  /** If provided, skip internal fetching and use pre-fetched data from useProjectSignals */
  preloaded?: Record<string, LoadState<ContractInfo>>;
}

export default function ContractFingerprintPanel({ contractAddresses, preloaded }: Props) {
  const [selfFetched, setSelfFetched] = useState<Record<string, ContractState>>({});

  // Only self-fetch when no preloaded data is provided
  useEffect(() => {
    if (preloaded) return;
    for (const { chain, address } of contractAddresses) {
      if (!chain || !address) continue;
      const key = `${chain}:${address}`;
      const config = getChainConfig(chain);

      if (!config) {
        setSelfFetched((prev) => ({ ...prev, [key]: { state: 'unsupported' } }));
        continue;
      }

      if (!hasApiSupport(chain)) {
        setSelfFetched((prev) => ({ ...prev, [key]: { state: 'no-api' } }));
        continue;
      }

      setSelfFetched((prev) => ({ ...prev, [key]: { state: 'loading' } }));
      fetchContractInfo(chain, address)
        .then((info) => setSelfFetched((prev) => ({ ...prev, [key]: { state: 'ok', info } })))
        .catch(() => setSelfFetched((prev) => ({ ...prev, [key]: { state: 'error' } })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Map preloaded LoadState → ContractState shape the UI expects
  function resolveState(chain: string, address: string): ContractState | undefined {
    const key = `${chain}:${address}`;
    if (!preloaded) return selfFetched[key];
    const ls = preloaded[key];
    if (!ls) {
      // might be unsupported or no-api
      const config = getChainConfig(chain);
      if (!config) return { state: 'unsupported' };
      if (!hasApiSupport(chain)) return { state: 'no-api' };
      return undefined;
    }
    if (ls.state === 'loading') return { state: 'loading' };
    if (ls.state === 'error')   return { state: 'error' };
    if (ls.state === 'ok')      return { state: 'ok', info: ls.data };
    return undefined;
  }

  const valid = contractAddresses.filter((c) => c.chain && c.address);
  if (valid.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-gray-400">Contract Signals</h3>

      <div className="space-y-3">
        {valid.map(({ chain, address }) => {
          const key = `${chain}:${address}`;
          const explorerUrl = getExplorerUrl(chain, address);
          const s = resolveState(chain, address);

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

                  {/* Rug Genome — similarity + obfuscation score */}
                  <RugGenomeSection chain={chain} address={address} />
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
