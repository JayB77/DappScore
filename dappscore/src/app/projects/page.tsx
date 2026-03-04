'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Filter, SortAsc, ChevronDown, Layers } from 'lucide-react';
import { ProjectCard, Project, TrustLevel } from '@/components/ProjectCard';
import { SUPPORTED_CHAINS, CHAIN_BY_NAME } from '@/config/chains';

// Mock data spanning multiple chains
const allProjects: Project[] = [
  {
    id: 1,
    name: 'DeFi Protocol X',
    symbol: 'DPX',
    description: 'Revolutionary decentralized exchange with zero-slippage trades and MEV protection.',
    category: 'DeFi',
    chain: 'Base',
    contractAddresses: [{ chain: 'Base', address: '0x1234567890abcdef1234567890abcdef12345678' }],
    totalSupply: '100,000,000',
    hardCap: '$2,000,000',
    startDate: Math.floor(Date.now() / 1000) - 86400,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 14,
    trustLevel: 'Trusted',
    isPremium: false,
    upvotes: 245,
    downvotes: 12,
    verified: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 7,
  },
  {
    id: 2,
    name: 'GameFi World',
    symbol: 'GFW',
    description: 'Play-to-earn gaming platform with NFT integration.',
    category: 'Gaming',
    chain: 'Solana',
    contractAddresses: [{ chain: 'Solana', address: 'GfwWorld1111111111111111111111111111111111' }],
    totalSupply: '500,000,000',
    hardCap: '$5,000,000',
    startDate: Math.floor(Date.now() / 1000) + 86400 * 2,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 30,
    trustLevel: 'NewListing',
    isPremium: false,
    upvotes: 89,
    downvotes: 23,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 2,
  },
  {
    id: 3,
    name: 'AI Data Network',
    symbol: 'AIDN',
    description: 'Decentralized AI training data marketplace.',
    category: 'AI',
    chain: 'Arbitrum',
    contractAddresses: [{ chain: 'Arbitrum', address: '0x9876543210fedcba9876543210fedcba98765432' }],
    totalSupply: '200,000,000',
    hardCap: '$3,500,000',
    startDate: Math.floor(Date.now() / 1000) - 86400 * 3,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 21,
    trustLevel: 'Neutral',
    isPremium: false,
    upvotes: 156,
    downvotes: 45,
    verified: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 14,
  },
  {
    id: 4,
    name: 'QuickSwap Clone',
    symbol: 'QSC',
    description: 'Another DEX with promises of high yields.',
    category: 'DeFi',
    chain: 'BNB Chain',
    totalSupply: '1,000,000,000',
    hardCap: '$500,000',
    startDate: Math.floor(Date.now() / 1000) - 86400 * 5,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 10,
    trustLevel: 'Suspicious',
    isPremium: false,
    upvotes: 12,
    downvotes: 89,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 5,
  },
  {
    id: 5,
    name: 'Meta Social',
    symbol: 'MSOC',
    description: 'Decentralized social media platform.',
    category: 'Social',
    chain: 'Polygon',
    totalSupply: '300,000,000',
    hardCap: '$1,500,000',
    startDate: Math.floor(Date.now() / 1000) + 86400 * 5,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 35,
    trustLevel: 'NewListing',
    isPremium: false,
    upvotes: 34,
    downvotes: 8,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400,
  },
  {
    id: 6,
    name: 'NFT Marketplace Pro',
    symbol: 'NFTP',
    description: 'Premium NFT marketplace with AI pricing.',
    category: 'NFT',
    chain: 'Ethereum',
    contractAddresses: [{ chain: 'Ethereum', address: '0xfedcba0987654321fedcba0987654321fedcba09' }],
    totalSupply: '150,000,000',
    hardCap: '$2,500,000',
    startDate: Math.floor(Date.now() / 1000) - 86400 * 2,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 18,
    trustLevel: 'Trusted',
    isPremium: false,
    upvotes: 312,
    downvotes: 28,
    verified: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 21,
  },
  {
    id: 7,
    name: 'Yield Farm Pro',
    symbol: 'YFP',
    description: 'High APY farming with auto-compounding.',
    category: 'DeFi',
    chain: 'Avalanche',
    totalSupply: '50,000,000',
    hardCap: '$1,000,000',
    startDate: Math.floor(Date.now() / 1000) - 86400 * 10,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 5,
    trustLevel: 'SuspectedScam',
    isPremium: false,
    upvotes: 5,
    downvotes: 234,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 10,
  },
  {
    id: 8,
    name: 'Layer2 Bridge',
    symbol: 'L2B',
    description: 'Cross-chain bridge for L2 solutions.',
    category: 'Infrastructure',
    chain: 'Optimism',
    contractAddresses: [{ chain: 'Optimism', address: '0x0123456789abcdef0123456789abcdef01234567' }],
    totalSupply: '80,000,000',
    hardCap: '$4,000,000',
    startDate: Math.floor(Date.now() / 1000) + 86400 * 7,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 37,
    trustLevel: 'NewListing',
    isPremium: false,
    upvotes: 67,
    downvotes: 12,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 3,
  },
];

const categories = ['All', 'DeFi', 'Gaming', 'AI', 'NFT', 'Social', 'Infrastructure'];
const trustLevels: ('All' | TrustLevel)[] = ['All', 'Trusted', 'Neutral', 'NewListing', 'Suspicious', 'SuspectedScam'];
const sortOptions = ['Most Trusted', 'Most Votes', 'Newest', 'Ending Soon'];

// ── Chain filter dropdown ──────────────────────────────────────────────────────
function ChainDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (chain: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
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
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: selected.color }}
            />
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
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: chain.color }}
              />
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
  const [trustFilter, setTrustFilter] = useState<'All' | TrustLevel>('All');
  const [sortBy, setSortBy] = useState('Most Trusted');

  const filteredProjects = allProjects
    .filter((p) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !searchLower ||
        p.name.toLowerCase().includes(searchLower) ||
        p.symbol.toLowerCase().includes(searchLower) ||
        p.contractAddresses?.some((c) => c.address.toLowerCase().includes(searchLower));
      const matchesCategory = category === 'All' || p.category === category;
      const matchesChain = chainFilter === 'All' || p.chain === chainFilter;
      const matchesTrust = trustFilter === 'All' || p.trustLevel === trustFilter;
      return matchesSearch && matchesCategory && matchesChain && matchesTrust;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'Most Trusted':
          return b.upvotes / (b.upvotes + b.downvotes) - a.upvotes / (a.upvotes + a.downvotes);
        case 'Most Votes':
          return b.upvotes + b.downvotes - (a.upvotes + a.downvotes);
        case 'Newest':
          return b.createdAt - a.createdAt;
        case 'Ending Soon':
          return a.endDate - b.endDate;
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
                <option key={level} value={level}>
                  {level === 'All' ? 'All Trust Levels' : level}
                </option>
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
              on{' '}
              <span
                className="font-medium"
                style={{ color: CHAIN_BY_NAME.get(chainFilter)?.color }}
              >
                {chainFilter}
              </span>
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
