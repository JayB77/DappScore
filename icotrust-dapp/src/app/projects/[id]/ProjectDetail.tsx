'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  ThumbsUp,
  ThumbsDown,
  Shield,
  ExternalLink,
  FileText,
  Clock,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  Send,
} from 'lucide-react';

// Mock project data
const mockProject = {
  id: 1,
  name: 'DeFi Protocol X',
  symbol: 'DPX',
  description:
    'Revolutionary decentralized exchange with zero-slippage trades and MEV protection built on Base. Our innovative AMM design eliminates front-running and sandwich attacks while providing deep liquidity for all trading pairs.',
  category: 'DeFi',
  chain: 'Base',
  websiteUrl: 'https://example.com',
  whitepaperUrl: 'https://example.com/whitepaper.pdf',
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
  team: [
    { name: 'John Doe', role: 'CEO & Founder', linkedin: '#' },
    { name: 'Jane Smith', role: 'CTO', linkedin: '#' },
    { name: 'Bob Johnson', role: 'Lead Developer', linkedin: '#' },
  ],
  milestones: [
    { date: 'Q1 2024', event: 'Project Launch', completed: true },
    { date: 'Q2 2024', event: 'Token Sale', completed: true },
    { date: 'Q3 2024', event: 'Mainnet Launch', completed: false },
    { date: 'Q4 2024', event: 'Mobile App', completed: false },
  ],
  socialLinks: {
    twitter: '#',
    telegram: '#',
    discord: '#',
    github: '#',
  },
};

const mockComments = [
  {
    id: 1,
    address: '0x1234...5678',
    content: 'Great project! The team is very responsive and the technology looks solid.',
    timestamp: Date.now() - 86400000 * 2,
    voteType: 'up',
  },
  {
    id: 2,
    address: '0xabcd...efgh',
    content: 'I have some concerns about the tokenomics. 40% for liquidity seems high.',
    timestamp: Date.now() - 86400000,
    voteType: 'down',
  },
  {
    id: 3,
    address: '0x9876...4321',
    content: 'Verified the smart contracts myself. Code looks clean and well-audited.',
    timestamp: Date.now() - 3600000,
    voteType: 'up',
  },
];

export default function ProjectDetail() {
  const params = useParams();
  const { isConnected } = useAccount();
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [comment, setComment] = useState('');
  const [showCommentForm, setShowCommentForm] = useState(false);

  const project = mockProject;
  const trustScore = Math.round((project.upvotes / (project.upvotes + project.downvotes)) * 100);

  const handleVote = (type: 'up' | 'down') => {
    if (!isConnected) return;
    setUserVote(type);
    // Would call contract here
  };

  const handleComment = () => {
    if (!comment.trim()) return;
    // Would call contract here
    setComment('');
    setShowCommentForm(false);
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          {/* Premium Badge */}
          {project.premiumTier !== 'none' && (
            <div className="bg-yellow-500 text-black text-sm font-bold text-center py-1 -mt-6 -mx-6 mb-6 rounded-t-xl">
              GOLD FEATURED PROJECT
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-start md:justify-between">
            <div className="flex items-start space-x-4 mb-4 md:mb-0">
              <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
                <span className="text-3xl font-bold text-yellow-500">
                  {project.symbol.slice(0, 2)}
                </span>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold">{project.name}</h1>
                  {project.verified && (
                    <span title="Verified"><CheckCircle className="h-6 w-6 text-green-500" /></span>
                  )}
                </div>
                <p className="text-gray-400">${project.symbol}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-2 py-1 bg-gray-700 rounded text-xs">{project.category}</span>
                  <span className="px-2 py-1 bg-gray-700 rounded text-xs">{project.chain}</span>
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs flex items-center">
                    <Shield className="h-3 w-3 mr-1" />
                    {project.trustLevel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end space-y-2">
              <a
                href={project.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors flex items-center space-x-2"
              >
                <span>Website</span>
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={project.whitepaperUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-gray-600 rounded-lg hover:border-yellow-500 transition-colors flex items-center space-x-2"
              >
                <FileText className="h-4 w-4" />
                <span>Whitepaper</span>
              </a>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">About</h2>
              <p className="text-gray-300 leading-relaxed">{project.description}</p>
            </div>

            {/* Team */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Team</h2>
              <div className="space-y-4">
                {project.team.map((member) => (
                  <div key={member.name} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-gray-400">{member.role}</div>
                    </div>
                    <a
                      href={member.linkedin}
                      className="text-yellow-500 hover:text-yellow-400"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestones */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Roadmap</h2>
              <div className="space-y-4">
                {project.milestones.map((milestone, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        milestone.completed ? 'bg-green-500' : 'bg-gray-600'
                      }`}
                    >
                      {milestone.completed ? (
                        <CheckCircle className="h-5 w-5 text-white" />
                      ) : (
                        <Clock className="h-5 w-5 text-gray-300" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{milestone.event}</div>
                      <div className="text-sm text-gray-400">{milestone.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Community Feedback
                </h2>
                {isConnected && (
                  <button
                    onClick={() => setShowCommentForm(!showCommentForm)}
                    className="text-yellow-500 hover:text-yellow-400 text-sm"
                  >
                    + Add Comment
                  </button>
                )}
              </div>

              {showCommentForm && (
                <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your thoughts about this project..."
                    className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white resize-none focus:border-yellow-500 focus:outline-none"
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleComment}
                      disabled={!comment.trim()}
                      className="px-4 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 flex items-center space-x-2"
                    >
                      <Send className="h-4 w-4" />
                      <span>Post</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {mockComments.map((c) => (
                  <div key={c.id} className="p-4 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono text-gray-400">{c.address}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            c.voteType === 'up'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {c.voteType === 'up' ? 'Upvoted' : 'Downvoted'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(c.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-300">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Voting Card */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="font-bold mb-4">Community Trust Score</h3>

              {/* Trust Score */}
              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-yellow-500 mb-2">{trustScore}%</div>
                <p className="text-gray-400 text-sm">Based on {project.upvotes + project.downvotes} votes</p>
              </div>

              {/* Vote Counts */}
              <div className="flex justify-center space-x-8 mb-6">
                <div className="text-center">
                  <div className="flex items-center space-x-1 text-green-400">
                    <ThumbsUp className="h-5 w-5" />
                    <span className="text-2xl font-bold">{project.upvotes}</span>
                  </div>
                  <span className="text-xs text-gray-400">Upvotes</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center space-x-1 text-red-400">
                    <ThumbsDown className="h-5 w-5" />
                    <span className="text-2xl font-bold">{project.downvotes}</span>
                  </div>
                  <span className="text-xs text-gray-400">Downvotes</span>
                </div>
              </div>

              {/* Vote Buttons */}
              {isConnected ? (
                <div className="flex space-x-4">
                  <button
                    onClick={() => handleVote('up')}
                    className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors ${
                      userVote === 'up'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-700 hover:bg-green-500/20 text-green-400'
                    }`}
                  >
                    <ThumbsUp className="h-5 w-5" />
                    <span>Trust</span>
                  </button>
                  <button
                    onClick={() => handleVote('down')}
                    className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors ${
                      userVote === 'down'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-700 hover:bg-red-500/20 text-red-400'
                    }`}
                  >
                    <ThumbsDown className="h-5 w-5" />
                    <span>Distrust</span>
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-400 mb-4">Connect wallet to vote</p>
                  <ConnectButton />
                </div>
              )}

              {userVote && (
                <p className="text-center text-sm text-gray-400 mt-4">
                  You will earn 10 $TRUST for voting
                </p>
              )}
            </div>

            {/* Project Details */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="font-bold mb-4">Token Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Supply</span>
                  <span className="font-medium">{project.totalSupply}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Hard Cap</span>
                  <span className="font-medium">{project.hardCap}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Chain</span>
                  <span className="font-medium">{project.chain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Category</span>
                  <span className="font-medium">{project.category}</span>
                </div>
              </div>
            </div>

            {/* Report Button */}
            <button className="w-full py-3 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/10 flex items-center justify-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Report Project</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
