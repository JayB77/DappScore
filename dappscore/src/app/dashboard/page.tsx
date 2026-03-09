'use client';

import { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
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
  Coins,
  Copy,
  ExternalLink,
  ChevronRight,
  Star,
  Flame,
  Eye,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Settings,
  Bell,
  User,
  BarChart3,
  Zap,
  Lock,
  Gift
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useFeatureFlag } from '@/lib/featureFlags';

type TabType = 'overview' | 'votes' | 'nfts' | 'projects' | 'settings';

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const rewardsEnabled = useFeatureFlag('tokenRewards', false);
  const [copied, setCopied] = useState(false);

  // Mock data - will be replaced with real contract calls
  const userStats = {
    reputation: 847,
    level: 'Active',
    nextLevel: 'Trusted',
    nextLevelAt: 1000,
    totalVotes: 156,
    trustVotes: 98,
    distrustVotes: 58,
    accuracy: 87,
    scamsFound: 3,
    tokensEarned: 1250,
    tokensBalance: 3420,
    accountAge: 45,
    rank: 234,
    totalUsers: 5420,
    commentsPosted: 23,
    commentsUpvoted: 89,
    projectsSubmitted: 2,
  };

  const recentVotes = [
    { id: 1, project: 'BaseSwap DEX', vote: 'trust', date: '2 hours ago', result: 'pending', score: 78 },
    { id: 2, project: 'ShadyToken', vote: 'distrust', date: '1 day ago', result: 'correct', score: 12 },
    { id: 3, project: 'LegitDAO', vote: 'trust', date: '3 days ago', result: 'correct', score: 91 },
    { id: 4, project: 'RugPull Finance', vote: 'distrust', date: '5 days ago', result: 'correct', score: 8 },
    { id: 5, project: 'MoonCoin', vote: 'trust', date: '1 week ago', result: 'incorrect', score: 34 },
    { id: 6, project: 'SafeYield', vote: 'trust', date: '1 week ago', result: 'correct', score: 82 },
    { id: 7, project: 'DeFi Protocol X', vote: 'trust', date: '2 weeks ago', result: 'correct', score: 76 },
    { id: 8, project: 'Scammy NFT', vote: 'distrust', date: '2 weeks ago', result: 'correct', score: 5 },
  ];

  const nfts = [
    {
      id: 1,
      name: 'Early Curator',
      description: 'First to discover, first to score',
      tier: 'standard',
      owned: true,
      benefit: '+10% vote weight',
      progress: 100,
      requirement: '50 votes + 60 day account',
      upgradePrice: 10000,
      color: 'purple',
    },
    {
      id: 2,
      name: 'Scam Hunter',
      description: 'Protecting the community from rugs',
      tier: 'none',
      owned: false,
      benefit: '+25% scam detection bonus',
      progress: 100,
      requirement: '3 confirmed scams found',
      upgradePrice: 15000,
      color: 'red',
    },
    {
      id: 3,
      name: 'Top Validator',
      description: 'Accuracy is everything',
      tier: 'none',
      owned: false,
      benefit: '+15% reward multiplier',
      progress: 87,
      requirement: '85%+ accuracy over 100 votes',
      upgradePrice: 25000,
      color: 'blue',
    },
  ];

  const submittedProjects = [
    { id: 1, name: 'My DeFi App', status: 'approved', score: 72, votes: 45, date: '2 weeks ago' },
    { id: 2, name: 'NFT Marketplace', status: 'pending', score: null, votes: 3, date: '2 days ago' },
  ];

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-800 rounded-xl p-12 text-center">
            <Wallet className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
            <p className="text-gray-400 mb-6">
              Connect your wallet to view your dashboard, manage NFTs, and track your voting stats.
            </p>
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold">{shortenAddress(address!)}</h1>
                  <button
                    onClick={copyAddress}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <a
                    href={`https://basescan.org/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="bg-yellow-500/20 text-yellow-500 text-xs font-semibold px-2 py-1 rounded">
                    {userStats.level}
                  </span>
                  <span className="text-gray-400 text-sm">
                    Rank #{userStats.rank} of {userStats.totalUsers.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              {rewardsEnabled && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-500">{userStats.tokensBalance.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">$SCORE Balance</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-2xl font-bold">{userStats.reputation}</div>
                <div className="text-xs text-gray-400">Reputation</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{userStats.accuracy}%</div>
                <div className="text-xs text-gray-400">Accuracy</div>
              </div>
            </div>
          </div>

          {/* Level Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Progress to {userStats.nextLevel}</span>
              <span className="text-yellow-500">{userStats.reputation} / {userStats.nextLevelAt}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"
                style={{ width: `${(userStats.reputation / userStats.nextLevelAt) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-800 rounded-lg p-1 mb-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'votes', label: 'Voting History', icon: Vote },
            { id: 'nfts', label: 'NFT Collection', icon: Award },
            { id: 'projects', label: 'My Projects', icon: Flame },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-yellow-500 text-black'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <Vote className="h-5 w-5 text-blue-500 mb-2" />
                <div className="text-2xl font-bold">{userStats.totalVotes}</div>
                <div className="text-xs text-gray-400">Total Votes</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <ThumbsUp className="h-5 w-5 text-green-500 mb-2" />
                <div className="text-2xl font-bold">{userStats.trustVotes}</div>
                <div className="text-xs text-gray-400">Trust Votes</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <ThumbsDown className="h-5 w-5 text-red-500 mb-2" />
                <div className="text-2xl font-bold">{userStats.distrustVotes}</div>
                <div className="text-xs text-gray-400">Distrust Votes</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <Shield className="h-5 w-5 text-red-500 mb-2" />
                <div className="text-2xl font-bold">{userStats.scamsFound}</div>
                <div className="text-xs text-gray-400">Scams Found</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <MessageSquare className="h-5 w-5 text-purple-500 mb-2" />
                <div className="text-2xl font-bold">{userStats.commentsPosted}</div>
                <div className="text-xs text-gray-400">Comments</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <Clock className="h-5 w-5 text-gray-400 mb-2" />
                <div className="text-2xl font-bold">{userStats.accountAge}d</div>
                <div className="text-xs text-gray-400">Account Age</div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Recent Activity */}
              <div className="lg:col-span-2 bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-yellow-500" />
                  Recent Activity
                </h2>
                <div className="space-y-3">
                  {recentVotes.slice(0, 5).map((vote) => (
                    <div
                      key={vote.id}
                      className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
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
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-400">Score: {vote.score}%</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          vote.result === 'correct'
                            ? 'bg-green-500/10 text-green-400'
                            : vote.result === 'incorrect'
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-gray-600 text-gray-400'
                        }`}>
                          {vote.result === 'pending' ? 'Pending' : vote.result === 'correct' ? '+10 rep' : '-5 rep'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setActiveTab('votes')}
                  className="w-full mt-4 text-center text-yellow-500 hover:text-yellow-400 text-sm flex items-center justify-center"
                >
                  View all votes <ChevronRight className="h-4 w-4 ml-1" />
                </button>
              </div>

              {/* Multipliers & Bonuses */}
              <div className="space-y-6">
                <div className="bg-gray-800 rounded-xl p-6">
                  <h2 className="text-lg font-bold mb-4 flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                    Your Multipliers
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Vote Weight</span>
                        <span className="text-yellow-500 font-bold">2.2x</span>
                      </div>
                      <div className="text-xs text-gray-500">Reputation (2x) + NFT bonus (1.1x)</div>
                    </div>
                    {rewardsEnabled && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Reward Multiplier</span>
                          <span className="text-green-500 font-bold">1.15x</span>
                        </div>
                        <div className="text-xs text-gray-500">Based on accuracy tier</div>
                      </div>
                    )}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Age Multiplier</span>
                        <span className="text-blue-500 font-bold">1.0x</span>
                      </div>
                      <div className="text-xs text-gray-500">45 days (full at 90 days)</div>
                    </div>
                  </div>
                </div>

                {rewardsEnabled ? (
                  <div className="bg-gray-800 rounded-xl p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center">
                      <Coins className="h-5 w-5 mr-2 text-yellow-500" />
                      Earnings
                    </h2>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Earned</span>
                        <span className="font-bold">{userStats.tokensEarned.toLocaleString()} $SCORE</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">From Voting</span>
                        <span className="text-green-400">+890 $SCORE</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">From Comments</span>
                        <span className="text-green-400">+210 $SCORE</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Scam Bonuses</span>
                        <span className="text-green-400">+150 $SCORE</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-xl p-6 text-center">
                    <Gift className="h-8 w-8 text-yellow-500/50 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-300">$SCORE Token Launching Soon</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Your activity is being tracked. Early participants will receive a token allocation at launch.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'votes' && (
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Voting History</h2>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-gray-400">
                  Accuracy: <span className="text-green-500 font-bold">{userStats.accuracy}%</span>
                </span>
                <span className="text-gray-400">
                  Total: <span className="font-bold">{userStats.totalVotes}</span>
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {recentVotes.map((vote) => (
                <div
                  key={vote.id}
                  className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    {vote.vote === 'trust' ? (
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        <ThumbsUp className="h-5 w-5 text-green-500" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                        <ThumbsDown className="h-5 w-5 text-red-500" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{vote.project}</div>
                      <div className="text-sm text-gray-400">
                        Voted <span className={vote.vote === 'trust' ? 'text-green-400' : 'text-red-400'}>{vote.vote}</span> • {vote.date}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm">Project Score</div>
                      <div className={`font-bold ${vote.score >= 70 ? 'text-green-500' : vote.score >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {vote.score}%
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      vote.result === 'correct'
                        ? 'bg-green-500/20 text-green-400'
                        : vote.result === 'incorrect'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-gray-600 text-gray-300'
                    }`}>
                      {vote.result === 'pending' ? 'Pending' : vote.result === 'correct' ? 'Correct' : 'Incorrect'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'nfts' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-2">Achievement NFTs</h2>
              <p className="text-gray-400 text-sm mb-6">
                Earn NFTs through platform activity. Own the Standard version first, then upgrade to Legendary by burning $SCORE tokens.
              </p>
              <div className="grid md:grid-cols-3 gap-6">
                {nfts.map((nft) => (
                  <div
                    key={nft.id}
                    className={`rounded-xl overflow-hidden border-2 ${
                      nft.owned
                        ? nft.tier === 'legendary'
                          ? 'border-yellow-500 bg-gradient-to-b from-yellow-500/20 to-gray-800'
                          : 'border-purple-500 bg-gradient-to-b from-purple-500/20 to-gray-800'
                        : 'border-gray-700 bg-gray-800'
                    }`}
                  >
                    {/* NFT Image Placeholder */}
                    <div className={`h-48 flex items-center justify-center ${
                      nft.color === 'purple' ? 'bg-purple-900/30' :
                      nft.color === 'red' ? 'bg-red-900/30' :
                      'bg-blue-900/30'
                    }`}>
                      <Award className={`h-24 w-24 ${
                        nft.owned ? 'text-white' : 'text-gray-600'
                      } ${!nft.owned && 'opacity-30'}`} />
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold">{nft.name}</h3>
                        {nft.owned && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            nft.tier === 'legendary'
                              ? 'bg-yellow-500 text-black'
                              : 'bg-purple-500 text-white'
                          }`}>
                            {nft.tier === 'legendary' ? 'LEGENDARY' : 'STANDARD'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{nft.description}</p>

                      <div className="bg-gray-700/50 rounded-lg p-3 mb-3">
                        <div className="text-xs text-gray-400 mb-1">Benefit</div>
                        <div className="text-sm text-green-400">{nft.benefit}</div>
                      </div>

                      {!nft.owned && (
                        <>
                          <div className="mb-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">Progress</span>
                              <span>{nft.progress}%</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  nft.color === 'purple' ? 'bg-purple-500' :
                                  nft.color === 'red' ? 'bg-red-500' :
                                  'bg-blue-500'
                                }`}
                                style={{ width: `${nft.progress}%` }}
                              />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{nft.requirement}</div>
                          </div>
                          {nft.progress >= 100 ? (
                            <button className="w-full py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-400 transition-colors">
                              Claim NFT
                            </button>
                          ) : (
                            <button disabled className="w-full py-2 bg-gray-700 text-gray-500 font-semibold rounded-lg cursor-not-allowed flex items-center justify-center">
                              <Lock className="h-4 w-4 mr-2" />
                              Locked
                            </button>
                          )}
                        </>
                      )}

                      {nft.owned && nft.tier === 'standard' && (
                        <button className="w-full py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors flex items-center justify-center">
                          <Zap className="h-4 w-4 mr-2" />
                          Upgrade for {nft.upgradePrice.toLocaleString()} $SCORE
                        </button>
                      )}

                      {nft.owned && nft.tier === 'legendary' && (
                        <div className="text-center text-yellow-500 text-sm font-medium">
                          Max Level Achieved
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Your Submitted Projects</h2>
                <Link
                  href="/submit"
                  className="px-4 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
                >
                  Submit New Project
                </Link>
              </div>

              {submittedProjects.length > 0 ? (
                <div className="space-y-4">
                  {submittedProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center">
                          <Flame className="h-6 w-6 text-orange-500" />
                        </div>
                        <div>
                          <div className="font-medium">{project.name}</div>
                          <div className="text-sm text-gray-400">
                            Submitted {project.date} • {project.votes} votes
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {project.score !== null && (
                          <div className="text-right">
                            <div className="text-sm text-gray-400">Trust Score</div>
                            <div className={`font-bold ${
                              project.score >= 70 ? 'text-green-500' :
                              project.score >= 40 ? 'text-yellow-500' :
                              'text-red-500'
                            }`}>
                              {project.score}%
                            </div>
                          </div>
                        )}
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          project.status === 'approved'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {project.status === 'approved' ? 'Live' : 'Pending Review'}
                        </span>
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-yellow-500 hover:text-yellow-400"
                        >
                          <Eye className="h-5 w-5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Flame className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">You haven&apos;t submitted any projects yet.</p>
                  <Link
                    href="/submit"
                    className="text-yellow-500 hover:text-yellow-400"
                  >
                    Submit your first project →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center">
                <Bell className="h-5 w-5 mr-2 text-blue-500" />
                Notifications
              </h2>
              <div className="space-y-4">
                {[
                  { label: 'Vote results', desc: 'When your votes are confirmed correct/incorrect', enabled: true },
                  { label: 'Reputation changes', desc: 'When you gain or lose reputation', enabled: true },
                  { label: 'NFT eligibility', desc: 'When you qualify for a new NFT', enabled: true },
                  { label: 'Comment replies', desc: 'When someone replies to your comment', enabled: false },
                ].map((setting, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{setting.label}</div>
                      <div className="text-sm text-gray-400">{setting.desc}</div>
                    </div>
                    <button
                      className={`w-12 h-6 rounded-full transition-colors ${
                        setting.enabled ? 'bg-yellow-500' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full transition-transform ${
                          setting.enabled ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center">
                <User className="h-5 w-5 mr-2 text-purple-500" />
                Profile
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Display Name (optional)</label>
                  <input
                    type="text"
                    placeholder="Anonymous Curator"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Bio (optional)</label>
                  <textarea
                    placeholder="Tell others about yourself..."
                    rows={3}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-yellow-500 focus:outline-none resize-none"
                  />
                </div>
                <button className="w-full py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
                  Save Changes
                </button>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 md:col-span-2">
              <h2 className="text-lg font-bold mb-4 flex items-center">
                <Wallet className="h-5 w-5 mr-2 text-green-500" />
                Connected Wallet
              </h2>
              <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-mono">{address}</div>
                    <div className="text-sm text-gray-400">
                      {ethBalance ? `${parseFloat(ethBalance.formatted).toFixed(4)} ETH` : 'Loading...'} on Base
                    </div>
                  </div>
                </div>
                <ConnectButton />
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 md:hidden">
          <div className="flex justify-around">
            <Link href="/projects" className="flex flex-col items-center text-gray-400 hover:text-yellow-500">
              <Vote className="h-6 w-6" />
              <span className="text-xs mt-1">Vote</span>
            </Link>
            <Link href="/submit" className="flex flex-col items-center text-gray-400 hover:text-yellow-500">
              <Flame className="h-6 w-6" />
              <span className="text-xs mt-1">Submit</span>
            </Link>
            {rewardsEnabled && (
              <Link href="/token-sale" className="flex flex-col items-center text-gray-400 hover:text-yellow-500">
                <Coins className="h-6 w-6" />
                <span className="text-xs mt-1">Buy</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
