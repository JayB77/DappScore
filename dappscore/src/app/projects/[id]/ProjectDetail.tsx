'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import ExternalSignalsPanel from '@/components/ExternalSignalsPanel';
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
  Image,
  X,
  Crown,
  ChevronUp,
  ChevronDown,
  Edit3,
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
  ownerAddress: '0x1234567890abcdef1234567890abcdef12345678', // Project owner wallet
  websiteUrl: 'https://example.com',
  whitepaperUrl: 'https://example.com/whitepaper.pdf',
  totalSupply: '100,000,000',
  hardCap: '$2,000,000',
  startDate: Math.floor(Date.now() / 1000) - 86400,
  endDate: Math.floor(Date.now() / 1000) + 86400 * 14,
  trustLevel: 'Trusted',
  isPremium: true,
  premiumExpiresAt: Math.floor(Date.now() / 1000) + 86400 * 5, // 5 days left
  upvotes: 245,
  downvotes: 12,
  verified: true,
  createdAt: Math.floor(Date.now() / 1000) - 86400 * 7,
  team: [
    { name: 'John Doe', role: 'CEO & Founder', linkedin: '#', bio: 'Serial entrepreneur with 10+ years in fintech' },
    { name: 'Jane Smith', role: 'CTO', linkedin: '#', bio: 'Former Google engineer, blockchain expert' },
    { name: 'Bob Johnson', role: 'Lead Developer', linkedin: '#', bio: 'Full-stack developer, Solidity specialist' },
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

interface Comment {
  id: number;
  address: string;
  content: string;
  imageUrl?: string;
  timestamp: number;
  voteType: 'up' | 'down';
  upvotes: number;
  downvotes: number;
  userReputation: number; // User's reputation score
}

const mockComments: Comment[] = [
  {
    id: 1,
    address: '0x1234...5678',
    content: 'Great project! The team is very responsive and the technology looks solid. I\'ve been following their development for months.',
    timestamp: Date.now() - 86400000 * 2,
    voteType: 'up',
    upvotes: 45,
    downvotes: 3,
    userReputation: 850,
  },
  {
    id: 2,
    address: '0xabcd...efgh',
    content: 'I have some concerns about the tokenomics. 40% for liquidity seems high. Here\'s proof from their old whitepaper:',
    imageUrl: 'https://placehold.co/600x400/1f2937/ffffff?text=Evidence+Screenshot',
    timestamp: Date.now() - 86400000,
    voteType: 'down',
    upvotes: 12,
    downvotes: 28,
    userReputation: 120,
  },
  {
    id: 3,
    address: '0x9876...4321',
    content: 'Verified the smart contracts myself. Code looks clean and well-audited. The audit report from CertiK checks out.',
    timestamp: Date.now() - 3600000,
    voteType: 'up',
    upvotes: 89,
    downvotes: 2,
    userReputation: 1250,
  },
];

export default function ProjectDetail() {
  const params = useParams();
  const { isConnected, address } = useAccount();
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [comment, setComment] = useState('');
  const [commentImage, setCommentImage] = useState<string>('');
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentVotes, setCommentVotes] = useState<Record<number, 'up' | 'down' | null>>({});

  const project = mockProject;
  const trustScore = Math.round((project.upvotes / (project.upvotes + project.downvotes)) * 100);
  const isOwner = address?.toLowerCase() === project.ownerAddress?.toLowerCase();

  const handleVote = (type: 'up' | 'down') => {
    if (!isConnected) return;
    setUserVote(type);
    // Would call contract here
  };

  const handleComment = () => {
    if (!comment.trim()) return;
    // Would call contract here
    setComment('');
    setCommentImage('');
    setShowCommentForm(false);
  };

  const handleCommentVote = (commentId: number, type: 'up' | 'down') => {
    if (!isConnected) return;
    setCommentVotes(prev => ({
      ...prev,
      [commentId]: prev[commentId] === type ? null : type
    }));
    // Would call contract here
  };

  const getReputationBadge = (reputation: number) => {
    if (reputation >= 1000) return { label: 'Trusted', color: 'text-green-400 bg-green-500/20' };
    if (reputation >= 500) return { label: 'Active', color: 'text-blue-400 bg-blue-500/20' };
    if (reputation >= 100) return { label: 'Member', color: 'text-gray-400 bg-gray-500/20' };
    return { label: 'New', color: 'text-gray-500 bg-gray-600/20' };
  };

  const getVoteWeight = (reputation: number) => {
    // Higher reputation = more vote weight
    if (reputation >= 1000) return '3x';
    if (reputation >= 500) return '2x';
    return '1x';
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          {/* Premium Badge */}
          {project.isPremium && (
            <div className="bg-yellow-500 text-black text-sm font-bold text-center py-1 -mt-6 -mx-6 mb-6 rounded-t-xl flex items-center justify-center space-x-2">
              <Crown className="h-4 w-4" />
              <span>FEATURED PROJECT</span>
              <span className="text-yellow-800">• {Math.ceil((project.premiumExpiresAt - Date.now() / 1000) / 86400)} days left</span>
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
              {isOwner && (
                <Link
                  href={`/projects/${project.id}/edit`}
                  className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-400 transition-colors flex items-center space-x-2"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Edit Project</span>
                </Link>
              )}
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
                  <div key={member.name} className="flex items-start justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-sm text-yellow-500">{member.role}</div>
                      <div className="text-sm text-gray-400 mt-1">{member.bio}</div>
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

            {/* Comments with voting and image support */}
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

              {/* Comment Form */}
              {showCommentForm && (
                <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your thoughts about this project. Be specific and provide evidence where possible..."
                    className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white resize-none focus:border-yellow-500 focus:outline-none"
                    rows={3}
                  />

                  {/* Image URL input */}
                  <div className="mt-3">
                    <label className="text-sm text-gray-400 mb-1 block">Add evidence image (optional)</label>
                    <div className="flex space-x-2">
                      <input
                        type="url"
                        value={commentImage}
                        onChange={(e) => setCommentImage(e.target.value)}
                        placeholder="https://example.com/screenshot.png"
                        className="flex-1 bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
                      />
                      <button className="px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg hover:border-yellow-500 transition-colors">
                        <Image className="h-5 w-5" />
                      </button>
                    </div>
                    {commentImage && (
                      <div className="mt-2 relative inline-block">
                        <img src={commentImage} alt="Preview" className="h-20 rounded border border-gray-500" />
                        <button
                          onClick={() => setCommentImage('')}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-3">
                    <p className="text-xs text-gray-400">
                      Your vote weight: {getVoteWeight(850)} based on reputation
                    </p>
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

              {/* Comments List */}
              <div className="space-y-4">
                {mockComments.map((c) => {
                  const repBadge = getReputationBadge(c.userReputation);
                  const currentVote = commentVotes[c.id];

                  return (
                    <div key={c.id} className="p-4 bg-gray-700/50 rounded-lg">
                      <div className="flex items-start space-x-3">
                        {/* Vote buttons for comment */}
                        <div className="flex flex-col items-center space-y-1">
                          <button
                            onClick={() => handleCommentVote(c.id, 'up')}
                            className={`p-1 rounded transition-colors ${
                              currentVote === 'up'
                                ? 'text-green-400 bg-green-500/20'
                                : 'text-gray-500 hover:text-green-400'
                            }`}
                          >
                            <ChevronUp className="h-5 w-5" />
                          </button>
                          <span className={`text-sm font-medium ${
                            c.upvotes - c.downvotes > 0 ? 'text-green-400' :
                            c.upvotes - c.downvotes < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {c.upvotes - c.downvotes}
                          </span>
                          <button
                            onClick={() => handleCommentVote(c.id, 'down')}
                            className={`p-1 rounded transition-colors ${
                              currentVote === 'down'
                                ? 'text-red-400 bg-red-500/20'
                                : 'text-gray-500 hover:text-red-400'
                            }`}
                          >
                            <ChevronDown className="h-5 w-5" />
                          </button>
                        </div>

                        {/* Comment content */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-mono text-gray-400">{c.address}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${repBadge.color}`}>
                                {repBadge.label}
                              </span>
                              <span className="text-xs text-gray-500">
                                {getVoteWeight(c.userReputation)} weight
                              </span>
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

                          {/* Image attachment */}
                          {c.imageUrl && (
                            <div className="mt-3">
                              <a href={c.imageUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={c.imageUrl}
                                  alt="Evidence"
                                  className="max-h-64 rounded-lg border border-gray-600 hover:border-yellow-500 transition-colors"
                                />
                              </a>
                              <p className="text-xs text-gray-500 mt-1 flex items-center">
                                <Image className="h-3 w-3 mr-1" />
                                Click to view full size
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reputation Info */}
              <div className="mt-6 p-4 bg-gray-700/30 rounded-lg">
                <h4 className="text-sm font-medium mb-2">How reputation works</h4>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Earn reputation by making quality comments that get upvoted</li>
                  <li>• Higher reputation = more weight on your project votes (1x → 2x → 3x)</li>
                  <li>• Downvoted comments reduce your reputation</li>
                  <li>• Attach images as evidence to strengthen your feedback</li>
                </ul>
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
                  You will earn 10 $SCORE for voting
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

            {/* External Signals */}
            <ExternalSignalsPanel
              websiteUrl={project.websiteUrl}
              githubUrl={project.socialLinks.github !== '#' ? project.socialLinks.github : undefined}
            />

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
