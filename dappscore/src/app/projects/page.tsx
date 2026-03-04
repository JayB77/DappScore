'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Filter, SortAsc, ChevronDown, Layers } from 'lucide-react';
import { ProjectCard, Project, TrustLevel, ProjectStage } from '@/components/ProjectCard';
import { SUPPORTED_CHAINS, CHAIN_BY_NAME } from '@/config/chains';

const allProjects: Project[] = [
  // ── Live projects (no active token sale) ────────────────────────────────────
  {
    id: 1,
    name: 'Uniswap Fork Pro',
    symbol: 'UFP',
    description: 'A battle-tested AMM on Base with concentrated liquidity and single-sided deposits.',
    category: 'DeFi',
    chain: 'Base',
    projectStage: 'mainnet',
    contractAddresses: [{ chain: 'Base', address: '0x1234567890abcdef1234567890abcdef12345678' }],
    trustLevel: 'Trusted',
    upvotes: 412,
    downvotes: 18,
    verified: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 90,
  },
  {
    id: 2,
    name: 'NFT Marketplace Pro',
    symbol: 'NFTP',
    description: 'Open NFT marketplace with AI-based floor price estimation and on-chain royalties.',
    category: 'NFT',
    chain: 'Ethereum',
    projectStage: 'launched',
    contractAddresses: [{ chain: 'Ethereum', address: '0xfedcba0987654321fedcba0987654321fedcba09' }],
    trustLevel: 'Trusted',
    upvotes: 312,
    downvotes: 28,
    verified: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 21,
  },
  {
    id: 3,
    name: 'ZK Privacy Layer',
    symbol: 'ZKPL',
    description: 'Zero-knowledge proof layer for private transactions on any EVM chain.',
    category: 'Privacy',
    chain: 'Arbitrum',
    projectStage: 'mainnet',
    contractAddresses: [{ chain: 'Arbitrum', address: '0x9876543210fedcba9876543210fedcba98765432' }],
    totalSupply: '200,000,000',
    trustLevel: 'Trusted',
    upvotes: 278,
    downvotes: 22,
    verified: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 45,
  },
  {
    id: 4,
    name: 'SolGame Studio',
    symbol: 'SGS',
    description: 'On-chain RPG with true ownership of in-game assets and a player-governed economy.',
    category: 'Gaming',
    chain: 'Solana',
    projectStage: 'mainnet_beta',
    contractAddresses: [{ chain: 'Solana', address: 'SGSgame111111111111111111111111111111111111' }],
    trustLevel: 'Neutral',
    upvotes: 198,
    downvotes: 41,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 30,
  },
  // ── Active token sales ───────────────────────────────────────────────────────
  {
    id: 5,
    name: 'AI Data Network',
    symbol: 'AIDN',
    description: 'Decentralized AI training data marketplace where contributors earn for labelling.',
    category: 'AI',
    chain: 'Arbitrum',
    projectStage: 'mainnet_beta',
    contractAddresses: [{ chain: 'Arbitrum', address: '0xabcdef1234567890abcdef1234567890abcdef12' }],
    totalSupply: '200,000,000',
    hardCap: '$3,500,000',
    saleStartDate: Math.floor(Date.now() / 1000) - 86400 * 3,
    saleEndDate: Math.floor(Date.now() / 1000) + 86400 * 21,
    trustLevel: 'Neutral',
    upvotes: 156,
    downvotes: 45,
    verified: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 14,
  },
  {
    id: 6,
    name: 'Layer2 Bridge',
    symbol: 'L2B',
    description: 'Trustless cross-chain bridge for L2 solutions with 5-minute finality.',
    category: 'Infrastructure',
    chain: 'Optimism',
    projectStage: 'testnet',
    contractAddresses: [{ chain: 'Optimism', address: '0x0123456789abcdef0123456789abcdef01234567' }],
    totalSupply: '80,000,000',
    hardCap: '$4,000,000',
    saleStartDate: Math.floor(Date.now() / 1000) + 86400 * 7,
    saleEndDate: Math.floor(Date.now() / 1000) + 86400 * 37,
    trustLevel: 'NewListing',
    upvotes: 67,
    downvotes: 12,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 3,
  },
  // ── Early stage / concept projects ──────────────────────────────────────────
  {
    id: 7,
    name: 'Meta Social',
    symbol: 'MSOC',
    description: 'Decentralized social media with on-chain identity and censorship-resistant posts.',
    category: 'Social',
    chain: 'Polygon',
    projectStage: 'development',
    trustLevel: 'NewListing',
    upvotes: 34,
    downvotes: 8,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400,
  },
  {
    id: 8,
    name: 'SuiLend',
    symbol: 'SLND',
    description: 'Lending and borrowing protocol on Sui with dynamic interest rates.',
    category: 'Lending',
    chain: 'Sui',
    projectStage: 'testnet',
    contractAddresses: [{ chain: 'Sui', address: '0xSuiLend111111111111111111111' }],
    trustLevel: 'NewListing',
    upvotes: 54,
    downvotes: 9,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 5,
  },
  {
    id: 9,
    name: 'TronDex',
    symbol: 'TRDX',
    description: 'Low-fee decentralised exchange native to the Tron ecosystem.',
    category: 'DEX',
    chain: 'Tron',
    projectStage: 'concept',
    trustLevel: 'NewListing',
    upvotes: 21,
    downvotes: 6,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 2,
  },
  // ── Flagged / suspicious ─────────────────────────────────────────────────────
  {
    id: 10,
    name: 'QuickSwap Clone',
    symbol: 'QSC',
    description: 'Another DEX with promises of high yields. Copy-paste contract with unlocked minting.',
    category: 'DeFi',
    chain: 'BNB Chain',
    projectStage: 'mainnet',
    totalSupply: '1,000,000,000',
    hardCap: '$500,000',
    saleStartDate: Math.floor(Date.now() / 1000) - 86400 * 5,
    saleEndDate: Math.floor(Date.now() / 1000) + 86400 * 10,
    trustLevel: 'Suspicious',
    upvotes: 12,
    downvotes: 89,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 5,
  },
  {
    id: 11,
    name: 'Yield Farm Pro',
    symbol: 'YFP',
    description: '10,000% APY farming. Anonymous team, no audit, proxy contract with upgrade keys.',
    category: 'DeFi',
    chain: 'Avalanche',
    projectStage: 'mainnet',
    totalSupply: '50,000,000',
    trustLevel: 'SuspectedScam',
    upvotes: 5,
    downvotes: 234,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 10,
  },
];

const categories = ['All', 'DeFi', 'Gaming', 'AI', 'NFT', 'Social', 'Infrastructure', 'Privacy', 'DEX', 'Lending'];
const stages: ('All' | ProjectStage)[] = ['All', 'concept', 'development', 'testnet', 'mainnet_beta', 'mainnet', 'launched', 'discontinued'];
const stageLabels: Record<string, string> = {
  All: 'All Stages', concept: 'Concept', development: 'In Development',
  testnet: 'Testnet', mainnet_beta: 'Mainnet Beta', mainnet: 'Mainnet',
  launched: 'Launched', discontinued: 'Discontinued',
};
const trustLevels: ('All' | TrustLevel)[] = ['All', 'Trusted', 'Neutral', 'NewListing', 'Suspicious', 'SuspectedScam'];
const sortOptions = ['Most Trusted', 'Most Votes', 'Newest', 'Sale Ending Soon'];

// ── Chain filter dropdown ──────────────────────────────────────────────────────
function ChainDropdown({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = value === 'All' ? null : CHAIN_BY_NAME.get(value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center space-x-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 hover:border-yellow-500 focus:outline-none focus:border-yellow-500 transition-colors min-w-[120px]"
      >
        <Layers className="h-4 w-4 text-gray-400 flex-shrink-0" />
        {selected ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selected.color }} />
            <span className="text-sm font-medium">{selected.abbr}</span>
          </>
        ) : (
          <span className="text-sm text-gray-300">All Chains</span>
        )}
        <ChevronDown className={`h-4 w-4 text-gray-400 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-44 max-h-72 overflow-y-auto">
          <button
            onClick={() => { onChange('All'); setOpen(false); }}
            className={`w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${value === 'All' ? 'text-yellow-400' : 'text-gray-300'}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-gray-500 flex-shrink-0" />
            <span>All Chains</span>
          </button>
          {SUPPORTED_CHAINS.filter(c => c.name !== 'Other').map((chain) => (
            <button
              key={chain.name}
              onClick={() => { onChange(chain.name); setOpen(false); }}
              className={`w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${value === chain.name ? 'text-yellow-400' : 'text-gray-300'}`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: chain.color }} />
              <span className="font-medium">{chain.abbr}</span>
              <span className="text-gray-500 text-xs ml-auto truncate">{chain.name}</span>
            </button>
          ))}
          <button
            onClick={() => { onChange('Other'); setOpen(false); }}
            className={`w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-700 transition-colors border-t border-gray-700 ${value === 'Other' ? 'text-yellow-400' : 'text-gray-300'}`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-gray-500 flex-shrink-0" />
            <span>Other</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [chainFilter, setChainFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState<'All' | ProjectStage>('All');
  const [trustFilter, setTrustFilter] = useState<'All' | TrustLevel>('All');
  const [sortBy, setSortBy] = useState('Most Trusted');

  const filteredProjects = allProjects
    .filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.symbol.toLowerCase().includes(q) ||
        p.contractAddresses?.some((c) => c.address.toLowerCase().includes(q));
      const matchesCategory = category === 'All' || p.category === category;
      const matchesChain    = chainFilter === 'All' || p.chain === chainFilter;
      const matchesStage    = stageFilter === 'All' || p.projectStage === stageFilter;
      const matchesTrust    = trustFilter === 'All' || p.trustLevel === trustFilter;
      return matchesSearch && matchesCategory && matchesChain && matchesStage && matchesTrust;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'Most Trusted':
          return b.upvotes / (b.upvotes + b.downvotes) - a.upvotes / (a.upvotes + a.downvotes);
        case 'Most Votes':
          return (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes);
        case 'Newest':
          return b.createdAt - a.createdAt;
        case 'Sale Ending Soon': {
          // Projects without a sale float to the bottom
          const aEnd = a.saleEndDate ?? Infinity;
          const bEnd = b.saleEndDate ?? Infinity;
          return aEnd - bEnd;
        }
        default:
          return 0;
      }
    });

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8">Browse Projects</h1>

        {/* Filters */}
        <div className="bg-gray-800 rounded-xl p-4 mb-8">
          <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
            {/* Search */}
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, symbol, or contract..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:border-yellow-500 focus:outline-none"
              />
            </div>

            {/* Chain Filter */}
            <ChainDropdown value={chainFilter} onChange={setChainFilter} />

            {/* Stage Filter */}
            <div className="flex items-center space-x-2">
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as 'All' | ProjectStage)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:border-yellow-500 focus:outline-none text-sm"
              >
                {stages.map((s) => (
                  <option key={s} value={s}>{stageLabels[s]}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:border-yellow-500 focus:outline-none text-sm"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
                ))}
              </select>
            </div>

            {/* Trust Filter */}
            <select
              value={trustFilter}
              onChange={(e) => setTrustFilter(e.target.value as 'All' | TrustLevel)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:border-yellow-500 focus:outline-none text-sm"
            >
              {trustLevels.map((level) => (
                <option key={level} value={level}>{level === 'All' ? 'All Trust Levels' : level}</option>
              ))}
            </select>

            {/* Sort */}
            <div className="flex items-center space-x-2">
              <SortAsc className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:border-yellow-500 focus:outline-none text-sm"
              >
                {sortOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 text-gray-400 text-sm">
          Showing {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
          {chainFilter !== 'All' && (
            <span className="ml-2">
              on <span className="font-medium" style={{ color: CHAIN_BY_NAME.get(chainFilter)?.color }}>{chainFilter}</span>
            </span>
          )}
        </div>

        {filteredProjects.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400">No projects found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
