'use client';

import Link from 'next/link';
import { Shield, TrendingUp, Users, Coins, ArrowRight, ThumbsUp, ThumbsDown } from 'lucide-react';
import { ProjectCard, Project } from '@/components/ProjectCard';
import { FeaturedBanner } from '@/components/FeaturedBanner';

// Mock data - will be replaced with contract calls
const mockProjects: Project[] = [
  {
    id: 1,
    name: 'DeFi Protocol X',
    symbol: 'DPX',
    description: 'Revolutionary decentralized exchange with zero-slippage trades and MEV protection built on Base.',
    category: 'DeFi',
    chain: 'Base',
    totalSupply: '100,000,000',
    hardCap: '$2,000,000',
    startDate: Math.floor(Date.now() / 1000) - 86400,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 14,
    trustLevel: 'Trusted',
    premiumTier: 'gold',
    upvotes: 245,
    downvotes: 12,
    verified: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 7,
  },
  {
    id: 2,
    name: 'GameFi World',
    symbol: 'GFW',
    description: 'Play-to-earn gaming platform with NFT integration and cross-game asset portability.',
    category: 'Gaming',
    chain: 'Base',
    totalSupply: '500,000,000',
    hardCap: '$5,000,000',
    startDate: Math.floor(Date.now() / 1000) + 86400 * 2,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 30,
    trustLevel: 'NewListing',
    premiumTier: 'silver',
    upvotes: 89,
    downvotes: 23,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 2,
  },
  {
    id: 3,
    name: 'AI Data Network',
    symbol: 'AIDN',
    description: 'Decentralized AI training data marketplace powered by blockchain verification.',
    category: 'AI',
    chain: 'Base',
    totalSupply: '200,000,000',
    hardCap: '$3,500,000',
    startDate: Math.floor(Date.now() / 1000) - 86400 * 3,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 21,
    trustLevel: 'Neutral',
    premiumTier: 'none',
    upvotes: 156,
    downvotes: 45,
    verified: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 14,
  },
  {
    id: 4,
    name: 'QuickSwap Clone',
    symbol: 'QSC',
    description: 'Another DEX with promises of high yields and referral rewards.',
    category: 'DeFi',
    chain: 'Base',
    totalSupply: '1,000,000,000',
    hardCap: '$500,000',
    startDate: Math.floor(Date.now() / 1000) - 86400 * 5,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 10,
    trustLevel: 'Suspicious',
    premiumTier: 'none',
    upvotes: 12,
    downvotes: 89,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 5,
  },
  {
    id: 5,
    name: 'Meta Social',
    symbol: 'MSOC',
    description: 'Decentralized social media platform with creator monetization and zero censorship.',
    category: 'Social',
    chain: 'Base',
    totalSupply: '300,000,000',
    hardCap: '$1,500,000',
    startDate: Math.floor(Date.now() / 1000) + 86400 * 5,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 35,
    trustLevel: 'NewListing',
    premiumTier: 'bronze',
    upvotes: 34,
    downvotes: 8,
    verified: false,
    createdAt: Math.floor(Date.now() / 1000) - 86400,
  },
  {
    id: 6,
    name: 'NFT Marketplace Pro',
    symbol: 'NFTP',
    description: 'Premium NFT marketplace with AI-powered pricing and fraud detection.',
    category: 'NFT',
    chain: 'Base',
    totalSupply: '150,000,000',
    hardCap: '$2,500,000',
    startDate: Math.floor(Date.now() / 1000) - 86400 * 2,
    endDate: Math.floor(Date.now() / 1000) + 86400 * 18,
    trustLevel: 'Trusted',
    premiumTier: 'none',
    upvotes: 312,
    downvotes: 28,
    verified: true,
    createdAt: Math.floor(Date.now() / 1000) - 86400 * 21,
  },
];

const featuredProject = {
  id: 1,
  name: 'DeFi Protocol X',
  symbol: 'DPX',
  description: 'Revolutionary decentralized exchange with zero-slippage trades',
  endDate: Math.floor(Date.now() / 1000) + 86400 * 14,
  premiumTier: 'platinum',
};

const stats = [
  { label: 'Projects Listed', value: '1,234', icon: Shield },
  { label: 'Community Votes', value: '45.6K', icon: TrendingUp },
  { label: 'Active Users', value: '12.3K', icon: Users },
  { label: '$TRUST Distributed', value: '2.1M', icon: Coins },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/20 via-gray-900 to-gray-950" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="text-white">Trust the </span>
              <span className="text-yellow-500">Community</span>
            </h1>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Community-driven crypto project vetting platform. Vote on projects,
              expose scams, and earn $TRUST tokens for contributing.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/projects"
                className="px-8 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors flex items-center space-x-2"
              >
                <span>Browse Projects</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/token-sale"
                className="px-8 py-3 border border-yellow-500 text-yellow-500 font-semibold rounded-lg hover:bg-yellow-500/10 transition-colors"
              >
                Join Token Sale
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-gray-800/50 rounded-lg p-4 text-center">
                <stat.icon className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            How <span className="text-yellow-500">ICOTrust</span> Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-yellow-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">1. Connect Wallet</h3>
              <p className="text-gray-400">
                Connect your wallet to participate in voting and earn rewards.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="flex space-x-1">
                  <ThumbsUp className="h-6 w-6 text-green-500" />
                  <ThumbsDown className="h-6 w-6 text-red-500" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">2. Vote & Comment</h3>
              <p className="text-gray-400">
                Research projects and vote based on legitimacy. Leave comments to help others.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Coins className="h-8 w-8 text-yellow-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">3. Earn $TRUST</h3>
              <p className="text-gray-400">
                Earn $TRUST tokens for every vote. Stake to boost your rewards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured & Projects */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FeaturedBanner project={featuredProject} />

          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">
              <span className="text-yellow-500">Live</span> Token Sales
            </h2>
            <Link
              href="/projects"
              className="text-yellow-500 hover:text-yellow-400 flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-yellow-900/30 to-yellow-600/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Have a Project to List?</h2>
          <p className="text-gray-400 mb-8">
            Get your project in front of thousands of crypto investors. Premium listings
            get featured placement and higher visibility.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/submit"
              className="px-8 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
            >
              Submit Your Project
            </Link>
            <Link
              href="/premium"
              className="px-8 py-3 border border-yellow-500 text-yellow-500 font-semibold rounded-lg hover:bg-yellow-500/10 transition-colors"
            >
              View Premium Plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
