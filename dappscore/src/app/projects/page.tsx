'use client';

import { useState } from 'react';
import { Search, Filter, SortAsc } from 'lucide-react';
import { ProjectCard, Project, TrustLevel } from '@/components/ProjectCard';

// Mock data - Premium projects appear first, then sorted by community score
const allProjects: Project[] = [
  {
    id: 1,
    name: 'DeFi Protocol X',
    symbol: 'DPX',
    description: 'Revolutionary decentralized exchange with zero-slippage trades and MEV protection.',
    category: 'DeFi',
    chain: 'Base',
    totalSupply: '100,000,000',
    hardCap: '$2,000,000',
    startDate: Math.floor(Date.now() / 1000) - 86400,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 14,
    trustLevel: 'Trusted',
    isPremium: true,
    premiumExpiresAt: Math.floor(Date.now() / 1000) + 86400 * 5,
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
    chain: 'Base',
    totalSupply: '500,000,000',
    hardCap: '$5,000,000',
    startDate: Math.floor(Date.now() / 1000) + 86400 * 2,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 30,
    trustLevel: 'NewListing',
    isPremium: true,
    premiumExpiresAt: Math.floor(Date.now() / 1000) + 86400 * 3,
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
    chain: 'Base',
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
    chain: 'Base',
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
    chain: 'Base',
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
    chain: 'Base',
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
    chain: 'Base',
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
    chain: 'Base',
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

export default function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [trustFilter, setTrustFilter] = useState<'All' | TrustLevel>('All');
  const [sortBy, setSortBy] = useState('Most Trusted');

  const filteredProjects = allProjects
    .filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.symbol.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'All' || p.category === category;
      const matchesTrust = trustFilter === 'All' || p.trustLevel === trustFilter;
      return matchesSearch && matchesCategory && matchesTrust;
    })
    .sort((a, b) => {
      // Premium projects always appear first
      if (a.isPremium && !b.isPremium) return -1;
      if (!a.isPremium && b.isPremium) return 1;

      // Then sort by selected criteria
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
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:border-yellow-500 focus:outline-none"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:border-yellow-500 focus:outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Trust Filter */}
            <select
              value={trustFilter}
              onChange={(e) => setTrustFilter(e.target.value as 'All' | TrustLevel)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:border-yellow-500 focus:outline-none"
            >
              {trustLevels.map((level) => (
                <option key={level} value={level}>
                  {level === 'All' ? 'All Trust Levels' : level}
                </option>
              ))}
            </select>

            {/* Sort */}
            <div className="flex items-center space-x-2">
              <SortAsc className="h-5 w-5 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:border-yellow-500 focus:outline-none"
              >
                {sortOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mb-4 text-gray-400">
          Showing {filteredProjects.length} projects
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
