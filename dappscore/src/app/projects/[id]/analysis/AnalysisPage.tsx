'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Shield, Droplets, Lock, Users, Code2, Activity, Zap,
  ChevronLeft, ExternalLink, Loader2, AlertTriangle, CheckCircle,
  Clock, TrendingDown, TrendingUp, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

import TokenSecurityPanel   from '@/components/TokenSecurityPanel';
import HoneypotPanel        from '@/components/HoneypotPanel';
import ContractFingerprintPanel from '@/components/ContractFingerprintPanel';
import LiquidityLockPanel   from '@/components/LiquidityLockPanel';
import TokenDistributionPanel from '@/components/TokenDistributionPanel';
import DeployerHistoryPanel from '@/components/DeployerHistoryPanel';
import WhaleTrackerPanel    from '@/components/WhaleTrackerPanel';
import AuditBadgePanel      from '@/components/AuditBadgePanel';

// ── Shared mock project data (same source as ProjectDetail) ───────────────────
// In production this would be fetched by ID from the API / subgraph.
const MOCK_PROJECT = {
  name: 'DeFi Protocol X',
  chain: 'Base',
  contractAddresses: [
    { chain: 'base', address: '0x1234567890abcdef1234567890abcdef12345678' },
  ] as { chain: string; address: string }[],
  audits: [] as { firm: string; date: string; reportUrl: string }[],
  walletScannerChain: 'base',
};

// ── Section nav config ────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'security',  label: 'Security',    icon: Shield    },
  { id: 'liquidity', label: 'Liquidity',   icon: Droplets  },
  { id: 'locks',     label: 'LP Locks',    icon: Lock      },
  { id: 'holders',   label: 'Holders',     icon: Users     },
  { id: 'deployer',  label: 'Deployer',    icon: Code2     },
  { id: 'whales',    label: 'Whales',      icon: Activity  },
  { id: 'events',    label: 'Events',      icon: Zap       },
] as const;

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start space-x-3 mb-6 pb-4 border-b border-gray-800">
      <div className="p-2 rounded-lg bg-gray-800 flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-blue-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// ── All DEX Pairs section (fetches from DexScreener, renders all pairs) ───────

const DEXSCREENER_CHAIN: Record<string, string> = {
  ethereum: 'ethereum', eth: 'ethereum',
  bsc: 'bsc', bnb: 'bsc', 'bnb smart chain': 'bsc',
  polygon: 'polygon', matic: 'polygon',
  arbitrum: 'arbitrum', 'arbitrum one': 'arbitrum',
  optimism: 'optimism', 'op mainnet': 'optimism',
  base: 'base',
  avalanche: 'avalanche', avax: 'avalanche',
  solana: 'solana', sol: 'solana',
};

interface DexPair {
  pairAddress: string;
  dexId: string;
  baseToken: { symbol: string; address: string };
  quoteToken: { symbol: string };
  priceUsd?: string;
  liquidity?: { usd: number };
  volume?: { h24: number };
  priceChange?: { h24: number };
  txns?: { h24: { buys: number; sells: number } };
  pairCreatedAt?: number;
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function AllPairsSection({ contractAddresses }: { contractAddresses: { chain: string; address: string }[] }) {
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const evmContracts = contractAddresses.filter(({ chain }) =>
      DEXSCREENER_CHAIN[chain.toLowerCase()]
    );
    if (evmContracts.length === 0) { setLoading(false); return; }

    Promise.allSettled(
      evmContracts.map(({ address }) =>
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`)
          .then(r => r.json())
          .then(d => (d.pairs ?? []) as DexPair[])
      )
    ).then(results => {
      const allPairs = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      allPairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
      setPairs(allPairs);
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, [contractAddresses]);

  if (loading) return (
    <div className="flex items-center space-x-2 text-gray-500 py-6">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Loading all pairs from DexScreener…</span>
    </div>
  );
  if (error || pairs.length === 0) return (
    <p className="text-sm text-gray-500 py-4">No DEX pairs found for this token.</p>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-4">{pairs.length} pair{pairs.length !== 1 ? 's' : ''} found across all DEXes</p>
      {pairs.map(p => {
        const liq   = p.liquidity?.usd ?? 0;
        const vol   = p.volume?.h24 ?? 0;
        const ch24  = p.priceChange?.h24 ?? 0;
        const isUp  = ch24 >= 0;
        const age   = p.pairCreatedAt
          ? Math.floor((Date.now() - p.pairCreatedAt) / 86_400_000)
          : null;

        return (
          <div key={p.pairAddress} className="bg-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Pair identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white text-sm">
                  {p.baseToken.symbol}/{p.quoteToken.symbol}
                </span>
                <span className="text-xs text-gray-500 uppercase">{p.dexId}</span>
                {age !== null && age < 7 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                    {age === 0 ? 'today' : `${age}d old`}
                  </span>
                )}
              </div>
              <a
                href={`https://dexscreener.com/${p.dexId}/${p.pairAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-600 hover:text-blue-400 font-mono flex items-center gap-1 mt-0.5 transition-colors"
              >
                {p.pairAddress.slice(0, 8)}…{p.pairAddress.slice(-6)}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Liquidity</p>
                <p className={`font-medium ${liq < 10_000 ? 'text-red-400' : liq < 50_000 ? 'text-orange-400' : 'text-green-400'}`}>
                  {fmtUsd(liq)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Vol 24h</p>
                <p className="font-medium text-gray-300">{fmtUsd(vol)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Price</p>
                <p className="font-medium text-gray-300">${parseFloat(p.priceUsd ?? '0').toPrecision(4)}</p>
              </div>
              <div className="flex items-center gap-1">
                {isUp
                  ? <TrendingUp className="h-3.5 w-3.5 text-green-400" />
                  : <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                }
                <span className={`font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                  {ch24 > 0 ? '+' : ''}{ch24.toFixed(2)}%
                </span>
              </div>
              {p.txns?.h24 && (
                <div className="hidden md:block">
                  <p className="text-xs text-gray-500 mb-0.5">Buys/Sells</p>
                  <p className="text-xs">
                    <span className="text-green-400">{p.txns.h24.buys}</span>
                    <span className="text-gray-600"> / </span>
                    <span className="text-red-400">{p.txns.h24.sells}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-600 pt-1">Data via DexScreener · sorted by liquidity</p>
    </div>
  );
}

// ── Contract Events section ───────────────────────────────────────────────────

interface ContractEvent {
  type: string;
  severity: 'info' | 'medium' | 'high' | 'critical';
  contractAddress: string;
  transactionHash: string;
  blockNumber: string;
  description: string;
}

interface EventsResult {
  contractAddress: string;
  events: ContractEvent[];
  riskScore: number;
}

const SEVERITY_COLOR: Record<string, string> = {
  info:     'text-blue-400  bg-blue-500/10  border-blue-500/30',
  medium:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  high:     'text-orange-400 bg-orange-500/10 border-orange-500/30',
  critical: 'text-red-400   bg-red-500/10   border-red-500/30',
};

const EVENT_ICON: Record<string, React.ElementType> = {
  'ownership-transferred': AlertTriangle,
  'ownership-renounced':   CheckCircle,
  'proxy-upgraded':        AlertTriangle,
  'liquidity-added':       ArrowUpRight,
  'liquidity-removed':     ArrowDownRight,
};

function EventsSection({ contractAddresses }: { contractAddresses: { chain: string; address: string }[] }) {
  const [results, setResults] = useState<EventsResult[]>([]);
  const [loading, setLoading] = useState(true);

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  useEffect(() => {
    const evmContracts = contractAddresses.filter(c => c.address.startsWith('0x'));
    if (evmContracts.length === 0) { setLoading(false); return; }

    Promise.allSettled(
      evmContracts.map(({ address }) =>
        fetch(`${BACKEND}/api/scam-detection/events?address=${address}&lookback=50400`)
          .then(r => r.json())
          .then(d => d.success ? (d.data as EventsResult) : null)
      )
    ).then(settled => {
      setResults(settled.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : []));
      setLoading(false);
    });
  }, [contractAddresses, BACKEND]);

  if (loading) return (
    <div className="flex items-center space-x-2 text-gray-500 py-6">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Scanning last 7 days of on-chain events…</span>
    </div>
  );

  const allEvents = results.flatMap(r => r.events);
  const sorted = [...allEvents].sort((a, b) =>
    BigInt(b.blockNumber) > BigInt(a.blockNumber) ? 1 : -1
  );

  if (sorted.length === 0) return (
    <div className="bg-gray-800 rounded-xl p-6 text-center">
      <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
      <p className="text-sm text-gray-400">No significant contract events in the last 7 days</p>
      <p className="text-xs text-gray-600 mt-1">Monitoring: ownership transfers, proxy upgrades, LP additions/removals</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Risk score summary */}
      {results.map(r => r.riskScore > 0 && (
        <div key={r.contractAddress} className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-orange-300">
            Event risk score for {r.contractAddress.slice(0, 8)}…
          </span>
          <span className="text-lg font-bold text-orange-400">{r.riskScore}/100</span>
        </div>
      ))}

      {/* Event timeline */}
      <div className="space-y-2">
        {sorted.map((e, i) => {
          const Icon = EVENT_ICON[e.type] ?? Clock;
          const colors = SEVERITY_COLOR[e.severity] ?? SEVERITY_COLOR.info;
          const explorerTx = `https://basescan.org/tx/${e.transactionHash}`;
          return (
            <div key={`${e.transactionHash}-${i}`} className={`rounded-xl border p-4 ${colors}`}>
              <div className="flex items-start gap-3">
                <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-semibold capitalize">
                      {e.type.replace(/-/g, ' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase border ${colors}`}>
                      {e.severity}
                    </span>
                  </div>
                  <p className="text-xs opacity-80 mt-1">{e.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs opacity-60">
                    <span>Block {e.blockNumber}</span>
                    {e.transactionHash && (
                      <a href={explorerTx} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-0.5 hover:opacity-100 transition-opacity">
                        {e.transactionHash.slice(0, 10)}… <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-600 pt-1">
        Monitoring: OwnershipTransferred · Upgraded (EIP-1967) · Uniswap V2 Mint/Burn · last ~7 days (~50 400 blocks)
      </p>
    </div>
  );
}

// ── Main analysis page ────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const params   = useParams();
  const id       = params.id as string;
  const project  = MOCK_PROJECT; // swap for real fetch when API is ready
  const navRef   = useRef<HTMLDivElement>(null);

  const [activeSection, setActiveSection] = useState<string>('security');

  // Highlight nav pill as sections cross the midpoint of the viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    SECTIONS.forEach(({ id: sId }) => {
      const el = document.getElementById(sId);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Smooth-scroll nav pill into view when active section changes
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const pill = nav.querySelector(`[data-section="${activeSection}"]`) as HTMLElement | null;
    if (pill) pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeSection]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4">

          {/* Top bar */}
          <div className="flex items-center justify-between py-6.5">
            <Link
              href={`/projects/${id}`}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>{project.name}</span>
            </Link>
            <span className="text-sm font-semibold text-white">Deep Analysis</span>
            <span className="text-xs text-gray-500 hidden sm:block">{project.chain}</span>
          </div>

          {/* Section nav pills */}
          <div ref={navRef} className="flex items-center gap-1 pb-2.5 overflow-x-auto scrollbar-none">
            {SECTIONS.map(({ id: sId, label, icon: Icon }) => (
              <a
                key={sId}
                href={`#${sId}`}
                data-section={sId}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  activeSection === sId
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-10 space-y-20">

        {/* ── Security ──────────────────────────────────────────────────── */}
        <section id="security" className="scroll-mt-28">
          <SectionHeader
            icon={Shield}
            title="Security Analysis"
            subtitle="GoPlus security flags, honeypot detection, contract Rug Genome, and audit records"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
              <TokenSecurityPanel contractAddresses={project.contractAddresses} />
              <AuditBadgePanel audits={project.audits} />
            </div>
            <div className="space-y-4">
              <HoneypotPanel contractAddresses={project.contractAddresses} />
              <ContractFingerprintPanel contractAddresses={project.contractAddresses} />
            </div>
          </div>
        </section>

        {/* ── Liquidity ─────────────────────────────────────────────────── */}
        <section id="liquidity" className="scroll-mt-28">
          <SectionHeader
            icon={Droplets}
            title="DEX Liquidity"
            subtitle="All active trading pairs across decentralized exchanges, sorted by liquidity depth"
          />
          <AllPairsSection contractAddresses={project.contractAddresses} />
        </section>

        {/* ── LP Locks ──────────────────────────────────────────────────── */}
        <section id="locks" className="scroll-mt-28">
          <SectionHeader
            icon={Lock}
            title="Liquidity Locks"
            subtitle="Full LP holder list, lock status per platform, and unlock schedule"
          />
          <LiquidityLockPanel
            contractAddresses={project.contractAddresses}
            expanded={true}
          />
        </section>

        {/* ── Holders ───────────────────────────────────────────────────── */}
        <section id="holders" className="scroll-mt-28">
          <SectionHeader
            icon={Users}
            title="Token Holders"
            subtitle="Top holder distribution, concentration risk, and fake-burn wallet detection"
          />
          <TokenDistributionPanel contractAddresses={project.contractAddresses} />
        </section>

        {/* ── Deployer ──────────────────────────────────────────────────── */}
        <section id="deployer" className="scroll-mt-28">
          <SectionHeader
            icon={Code2}
            title="Deployer Wallet"
            subtitle="Full contract deployment history, wallet age, and cross-project risk patterns"
          />
          <DeployerHistoryPanel
            contractAddresses={project.contractAddresses}
            expanded={true}
          />
          {/* Link to full wallet scanner */}
          <div className="mt-4 flex justify-end">
            <Link
              href={`/wallet?address=${project.contractAddresses[0]?.address ?? ''}&chain=${project.walletScannerChain}`}
              className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Open in Wallet Scanner
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* ── Whales ────────────────────────────────────────────────────── */}
        <section id="whales" className="scroll-mt-28">
          <SectionHeader
            icon={Activity}
            title="Whale Activity"
            subtitle="Large transfer tracking, accumulation and distribution patterns (last 24 hours)"
          />
          <WhaleTrackerPanel contractAddresses={project.contractAddresses} />
        </section>

        {/* ── Events ────────────────────────────────────────────────────── */}
        <section id="events" className="scroll-mt-28">
          <SectionHeader
            icon={Zap}
            title="Contract Events"
            subtitle="Ownership transfers, proxy upgrades, and liquidity events from the last 7 days"
          />
          <EventsSection contractAddresses={project.contractAddresses} />
        </section>

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 py-8 mt-8">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between text-xs text-gray-600">
          <Link href={`/projects/${id}`} className="hover:text-gray-400 transition-colors">
            ← Back to {project.name}
          </Link>
          <span>DappScore Deep Analysis · Data sourced from GoPlus, DexScreener, Moralis, and on-chain</span>
        </div>
      </footer>
    </div>
  );
}
