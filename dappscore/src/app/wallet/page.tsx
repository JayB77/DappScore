'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import {
  Search, Wallet, AlertTriangle, CheckCircle, Shield,
  ExternalLink, Loader2, Clock, Box, ChevronDown,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

// Chains that have Etherscan-compatible APIs (subset used for display)
const SUPPORTED_CHAINS = [
  'ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc',
  'avalanche', 'blast', 'linea', 'scroll', 'zksync', 'mantle',
  'fantom', 'celo', 'gnosis', 'cronos', 'sonic', 'mode', 'taiko',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface DappScoreMatch {
  id: string;
  name: string;
  trustLevel: number;
  trustLabel: string;
  status: number;
  statusLabel: string;
  isFlagged: boolean;
}

interface EnrichedContract {
  address: string;
  txHash: string;
  timestamp: number;
  daysAgo: number;
  dappScore: DappScoreMatch | null;
}

interface RiskyInteraction {
  contractAddress: string;
  txHash: string;
  timestamp: number;
  daysAgo: number;
  dappScore: DappScoreMatch;
}

interface ScanResult {
  wallet: string;
  chain: string;
  walletAgeDays: number | null;
  deployedContracts: EnrichedContract[];
  riskyInteractions: RiskyInteraction[];
  riskSummary: {
    level: 'none' | 'low' | 'medium' | 'high' | 'critical';
    deployedFlaggedProjects: number;
    interactedWithFlaggedProjects: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  none:     { label: 'Clean',    bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  icon: CheckCircle },
  low:      { label: 'Low Risk', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: AlertTriangle },
  medium:   { label: 'Medium',   bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', icon: AlertTriangle },
  high:     { label: 'High',     bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400',    icon: AlertTriangle },
  critical: { label: 'Critical', bg: 'bg-red-500/15',    border: 'border-red-500/50',    text: 'text-red-400',    icon: AlertTriangle },
};

function truncate(addr: string, chars = 6) {
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

function walletAgeLabel(days: number | null) {
  if (days === null) return 'Age unknown';
  if (days < 365) return `${days} days old`;
  const years = Math.floor(days / 365);
  const rem = Math.floor((days % 365) / 30);
  return rem > 0 ? `${years}yr ${rem}mo old` : `${years}yr old`;
}

function TrustBadge({ match }: { match: DappScoreMatch }) {
  if (!match.isFlagged) {
    return <span className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded">Listed</span>;
  }
  const label = match.status >= 2 ? match.statusLabel : match.trustLabel;
  return (
    <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-semibold">{label}</span>
  );
}

function explorerUrl(chain: string, type: 'address' | 'tx', value: string) {
  const bases: Record<string, string> = {
    ethereum: 'https://etherscan.io', base: 'https://basescan.org',
    arbitrum: 'https://arbiscan.io', optimism: 'https://optimistic.etherscan.io',
    polygon: 'https://polygonscan.com', bsc: 'https://bscscan.com',
    avalanche: 'https://snowtrace.io', blast: 'https://blastscan.io',
    linea: 'https://lineascan.build', scroll: 'https://scrollscan.com',
    zksync: 'https://era.zksync.network', mantle: 'https://mantlescan.xyz',
    fantom: 'https://ftmscan.com', celo: 'https://celoscan.io',
    gnosis: 'https://gnosisscan.io', cronos: 'https://cronoscan.com',
    sonic: 'https://sonicscan.org', mode: 'https://modescan.io',
    taiko: 'https://taikoscan.io',
  };
  const base = bases[chain] ?? `https://etherscan.io`;
  return type === 'tx' ? `${base}/tx/${value}` : `${base}/address/${value}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { address: connectedAddress } = useAccount();

  const [inputAddress, setInputAddress] = useState('');
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function handleScan(addrOverride?: string) {
    const addr = (addrOverride ?? inputAddress).trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      setError('Enter a valid 0x EVM wallet address.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/v1/wallet/${selectedChain}/${addr}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setResult(data as ScanResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function useMyWallet() {
    if (!connectedAddress) return;
    setInputAddress(connectedAddress);
    handleScan(connectedAddress);
  }

  const risk = result ? RISK_CONFIG[result.riskSummary.level] : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-yellow-500" />
          Wallet Scanner
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Check any EVM wallet for deployed scam contracts and interactions with flagged projects.
        </p>
      </div>

      {/* Search form */}
      <div className="bg-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputAddress}
            onChange={e => setInputAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
            placeholder="0x wallet address…"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-sm font-mono focus:border-yellow-500 focus:outline-none placeholder-gray-500"
          />
          <div className="relative">
            <select
              value={selectedChain}
              onChange={e => setSelectedChain(e.target.value)}
              className="appearance-none bg-gray-700 border border-gray-600 rounded-lg pl-3 pr-8 py-2.5 text-sm focus:border-yellow-500 focus:outline-none capitalize"
            >
              {SUPPORTED_CHAINS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => handleScan()}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors text-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Scan
          </button>
        </div>

        {connectedAddress && (
          <button
            onClick={useMyWallet}
            className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors"
          >
            Use my connected wallet ({truncate(connectedAddress)})
          </button>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && risk && (
        <div className="space-y-5">

          {/* Risk summary banner */}
          <div className={`${risk.bg} border ${risk.border} rounded-xl p-5`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <risk.icon className={`h-6 w-6 ${risk.text}`} />
                <div>
                  <p className={`font-bold text-lg ${risk.text}`}>{risk.label}</p>
                  <p className="text-sm text-gray-400 font-mono">{truncate(result.wallet, 8)}</p>
                </div>
              </div>
              <div className="text-right text-sm text-gray-400 space-y-0.5">
                <div className="flex items-center gap-1.5 justify-end">
                  <Clock className="h-3.5 w-3.5" />
                  {walletAgeLabel(result.walletAgeDays)}
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <Box className="h-3.5 w-3.5" />
                  {result.deployedContracts.length} contract{result.deployedContracts.length !== 1 ? 's' : ''} deployed
                </div>
              </div>
            </div>

            {/* Summary stats */}
            {(result.riskSummary.deployedFlaggedProjects > 0 || result.riskSummary.interactedWithFlaggedProjects > 0) && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {result.riskSummary.deployedFlaggedProjects > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
                    <p className="text-2xl font-bold text-red-400">{result.riskSummary.deployedFlaggedProjects}</p>
                    <p className="text-xs text-gray-400">flagged contract{result.riskSummary.deployedFlaggedProjects !== 1 ? 's' : ''} deployed</p>
                  </div>
                )}
                {result.riskSummary.interactedWithFlaggedProjects > 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 text-center">
                    <p className="text-2xl font-bold text-orange-400">{result.riskSummary.interactedWithFlaggedProjects}</p>
                    <p className="text-xs text-gray-400">flagged project{result.riskSummary.interactedWithFlaggedProjects !== 1 ? 's' : ''} interacted with</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Deployed contracts */}
          {result.deployedContracts.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-5">
              <h2 className="font-bold text-sm uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                <Box className="h-4 w-4" />
                Deployed Contracts ({result.deployedContracts.length})
              </h2>
              <div className="space-y-2">
                {result.deployedContracts.map(c => (
                  <div key={c.address} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-700 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <a
                        href={explorerUrl(result.chain, 'address', c.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 transition-colors"
                      >
                        {truncate(c.address)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      {c.dappScore ? (
                        <TrustBadge match={c.dappScore} />
                      ) : (
                        <span className="text-xs text-gray-600">Not listed</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">
                      {c.dappScore?.name && (
                        <span className="text-gray-400 mr-2">{c.dappScore.name}</span>
                      )}
                      {c.daysAgo === 0 ? 'today' : `${c.daysAgo}d ago`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risky interactions */}
          {result.riskyInteractions.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-5">
              <h2 className="font-bold text-sm uppercase tracking-wider text-red-400 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Flagged Project Interactions ({result.riskyInteractions.length})
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                This wallet sent transactions to the following projects that are flagged on DappScore.
              </p>
              <div className="space-y-2">
                {result.riskyInteractions.map(r => (
                  <div key={r.contractAddress} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-700 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <a
                        href={explorerUrl(result.chain, 'address', r.contractAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 transition-colors"
                      >
                        {truncate(r.contractAddress)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <TrustBadge match={r.dappScore} />
                      <span className="text-sm text-gray-300">{r.dappScore.name}</span>
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">{r.daysAgo === 0 ? 'today' : `${r.daysAgo}d ago`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clean bill of health */}
          {result.riskSummary.level === 'none' && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-5 flex items-center gap-3">
              <Shield className="h-5 w-5 text-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-green-400">No known risks found</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  None of the contracts deployed or interacted with by this wallet match flagged projects in the DappScore database.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
