'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Wallet,
  Vote,
  Trophy,
  TrendingUp,
  Shield,
  Target,
  Award,
  Clock,
  CheckCircle,
  XCircle,
  Coins
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { isConnected, address } = useAccount();

  // Mock data - will be replaced with real contract calls
  const userStats = {
    reputation: 847,
    level: 'Active',
    totalVotes: 156,
    accuracy: 87,
    scamsFound: 3,
    tokensEarned: 1250,
    accountAge: 45, // days
  };

  const recentVotes = [
    { project: 'BaseSwap DEX', vote: 'trust', date: '2 hours ago', result: 'pending' },
    { project: 'ShadyToken', vote: 'distrust', date: '1 day ago', result: 'correct' },
    { project: 'LegitDAO', vote: 'trust', date: '3 days ago', result: 'correct' },
    { project: 'RugPull Finance', vote: 'distrust', date: '5 days ago', result: 'correct' },
    { project: 'MoonCoin', vote: 'trust', date: '1 week ago', result: 'incorrect' },
  ];

  const nfts = [
    { name: 'Early Curator', tier: 'standard', owned: true },
    { name: 'Scam Hunter', tier: 'none', owned: false },
    { name: 'Top Validator', tier: 'none', owned: false },
  ];

  if (!isConnected) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <Wallet className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
            <p className="text-gray-400 mb-6">
              Connect your wallet to view your dashboard, stats, and voting history.
            </p>
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Dashboard</h1>
          <p className="text-gray-400">
            Track your voting activity, reputation, and rewards.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                {userStats.level}
              </span>
            </div>
            <div className="text-2xl font-bold">{userStats.reputation}</div>
            <div className="text-sm text-gray-400">Reputation</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <Vote className="h-5 w-5 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{userStats.totalVotes}</div>
            <div className="text-sm text-gray-400">Total Votes</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <Target className="h-5 w-5 text-green-500 mb-2" />
            <div className="text-2xl font-bold">{userStats.accuracy}%</div>
            <div className="text-sm text-gray-400">Accuracy</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <Coins className="h-5 w-5 text-yellow-500 mb-2" />
            <div className="text-2xl font-bold">{userStats.tokensEarned.toLocaleString()}</div>
            <div className="text-sm text-gray-400">$SCORE Earned</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Voting History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Votes */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Vote className="h-5 w-5 mr-2 text-blue-500" />
                Recent Votes
              </h2>
              <div className="space-y-3">
                {recentVotes.map((vote, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {vote.vote === 'trust' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-medium">{vote.project}</div>
                        <div className="text-xs text-gray-400">{vote.date}</div>
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      vote.result === 'correct'
                        ? 'bg-green-500/10 text-green-400'
                        : vote.result === 'incorrect'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-gray-600 text-gray-400'
                    }`}>
                      {vote.result === 'pending' ? 'Pending' : vote.result === 'correct' ? '+10 rep' : '-5 rep'}
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/projects"
                className="block text-center text-yellow-500 hover:text-yellow-400 mt-4 text-sm"
              >
                Vote on more projects →
              </Link>
            </div>

            {/* Scam Detection */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-red-500" />
                Scam Detection
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-500">{userStats.scamsFound}</div>
                  <div className="text-sm text-gray-400">Scams Identified</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-500">+{userStats.scamsFound * 100}</div>
                  <div className="text-sm text-gray-400">Bonus Rep Earned</div>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-4">
                Earn +100 reputation for each scam you correctly identify before it&apos;s flagged.
              </p>
            </div>
          </div>

          {/* Right Column - NFTs & Info */}
          <div className="space-y-6">
            {/* Achievement NFTs */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Award className="h-5 w-5 mr-2 text-purple-500" />
                Achievement NFTs
              </h2>
              <div className="space-y-3">
                {nfts.map((nft, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      nft.owned
                        ? 'border-purple-500/50 bg-purple-500/10'
                        : 'border-gray-700 bg-gray-700/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{nft.name}</div>
                      {nft.owned ? (
                        <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded">
                          OWNED
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">
                          Not earned
                        </span>
                      )}
                    </div>
                    {nft.owned && (
                      <div className="text-xs text-purple-400 mt-1">
                        Standard Edition • +10% vote weight
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Earn NFTs through voting activity. Upgrade to Legendary by burning $SCORE.
              </p>
            </div>

            {/* Account Info */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-gray-400" />
                Account Info
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Account Age</span>
                  <span className="font-medium">{userStats.accountAge} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Age Multiplier</span>
                  <span className="font-medium text-green-400">
                    {userStats.accountAge >= 90 ? '1.25x' : userStats.accountAge >= 30 ? '1x' : '0.75x'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Vote Weight</span>
                  <span className="font-medium text-yellow-500">2.2x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Reward Multiplier</span>
                  <span className="font-medium text-green-400">1.15x</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Wallet Address</div>
                <div className="font-mono text-sm truncate">{address}</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  href="/projects"
                  className="block w-full py-3 bg-yellow-500 text-black font-semibold rounded-lg text-center hover:bg-yellow-400 transition-colors"
                >
                  Vote on Projects
                </Link>
                <Link
                  href="/submit"
                  className="block w-full py-3 border border-gray-600 text-gray-300 font-semibold rounded-lg text-center hover:border-yellow-500 hover:text-yellow-500 transition-colors"
                >
                  Submit a Project
                </Link>
                <Link
                  href="/token-sale"
                  className="block w-full py-3 border border-gray-600 text-gray-300 font-semibold rounded-lg text-center hover:border-yellow-500 hover:text-yellow-500 transition-colors"
                >
                  Buy $SCORE
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
