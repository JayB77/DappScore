'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  Plus,
  Calendar,
  Target,
  DollarSign,
  TrendingUp,
  Clock,
  Play,
  Pause,
  MoreVertical,
  ChevronRight,
  Filter,
  Search,
  RefreshCw,
  ArrowUpRight,
  PieChart,
  Settings,
  Trash2,
  Edit3,
  Check
} from 'lucide-react';

const campaigns = [
  {
    id: 1,
    name: 'ARB Accumulation Q1',
    status: 'active',
    investment: 10000,
    currentValue: 12450,
    profit: 2450,
    profitPercent: 24.5,
    target: 5000,
    targetProgress: 49,
    startDate: '2025-01-01',
    endDate: '2025-03-31',
    daysLeft: 12,
    trades: 47,
    chains: ['ARB', 'ETH'],
    strategy: 'DCA + Momentum',
  },
  {
    id: 2,
    name: 'Multi-Chain Growth',
    status: 'active',
    investment: 25000,
    currentValue: 31250,
    profit: 6250,
    profitPercent: 25,
    target: 10000,
    targetProgress: 62.5,
    startDate: '2025-01-15',
    endDate: '2025-04-15',
    daysLeft: 28,
    trades: 123,
    chains: ['ETH', 'SOL', 'BNB', 'MATIC'],
    strategy: 'Grid Trading',
  },
  {
    id: 3,
    name: 'SOL Swing Trade',
    status: 'paused',
    investment: 5000,
    currentValue: 5890,
    profit: 890,
    profitPercent: 17.8,
    target: 2500,
    targetProgress: 35.6,
    startDate: '2024-12-01',
    endDate: '2025-02-28',
    daysLeft: 45,
    trades: 28,
    chains: ['SOL'],
    strategy: 'Swing Trading',
  },
  {
    id: 4,
    name: 'BTC Long Term Hold',
    status: 'completed',
    investment: 50000,
    currentValue: 67500,
    profit: 17500,
    profitPercent: 35,
    target: 15000,
    targetProgress: 100,
    startDate: '2024-06-01',
    endDate: '2024-12-31',
    daysLeft: 0,
    trades: 12,
    chains: ['BTC'],
    strategy: 'HODL + DCA',
  },
];

const stats = [
  { label: 'Total Invested', value: '$90,000', icon: DollarSign, color: '#00ff88' },
  { label: 'Current Value', value: '$117,090', icon: TrendingUp, color: '#00d4ff' },
  { label: 'Total Profit', value: '+$27,090', icon: Trophy, color: '#ffaa00' },
  { label: 'Active Campaigns', value: '3', icon: Target, color: '#ff00ff' },
];

export default function Campaigns() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredCampaigns = filterStatus === 'all'
    ? campaigns
    : campaigns.filter(c => c.status === filterStatus);

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Investment <span className="gradient-text">Campaigns</span>
            </h1>
            <p className="text-gray-400">Manage your automated trading campaigns</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="mt-4 lg:mt-0 btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create Campaign</span>
          </motion.button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-6"
            >
              <stat.icon className="w-8 h-8 mb-4" style={{ color: stat.color }} />
              <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center space-x-2">
            {['all', 'active', 'paused', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filterStatus === status
                    ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search campaigns..."
                className="pl-10 pr-4 py-2 rounded-xl bg-black/30 border border-white/10 focus:border-[#00ff88]/50 focus:outline-none text-white w-64"
              />
            </div>
            <button className="p-2 rounded-xl glass border border-white/10 hover:border-[#00ff88]/30">
              <Filter className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Campaigns List */}
        <div className="space-y-4">
          {filteredCampaigns.map((campaign, index) => (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-6 hover-lift"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                {/* Campaign Info */}
                <div className="flex items-start space-x-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    campaign.status === 'active' ? 'bg-[#00ff88]/20' :
                    campaign.status === 'paused' ? 'bg-[#ffaa00]/20' :
                    'bg-gray-500/20'
                  }`}>
                    <Trophy className={`w-7 h-7 ${
                      campaign.status === 'active' ? 'text-[#00ff88]' :
                      campaign.status === 'paused' ? 'text-[#ffaa00]' :
                      'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="text-xl font-bold text-white">{campaign.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        campaign.status === 'active' ? 'bg-[#00ff88]/20 text-[#00ff88]' :
                        campaign.status === 'paused' ? 'bg-[#ffaa00]/20 text-[#ffaa00]' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">{campaign.strategy}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      {campaign.chains.map((chain) => (
                        <span
                          key={chain}
                          className="px-2 py-1 rounded-lg bg-white/5 text-gray-300 text-xs font-medium"
                        >
                          {chain}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Invested</p>
                    <p className="text-lg font-semibold text-white">${campaign.investment.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Current Value</p>
                    <p className="text-lg font-semibold text-white">${campaign.currentValue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Profit</p>
                    <p className={`text-lg font-semibold ${campaign.profit >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                      +${campaign.profit.toLocaleString()} ({campaign.profitPercent}%)
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Time Left</p>
                    <p className="text-lg font-semibold text-white">
                      {campaign.daysLeft > 0 ? `${campaign.daysLeft} days` : 'Ended'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  {campaign.status !== 'completed' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`p-2 rounded-xl ${
                        campaign.status === 'active'
                          ? 'bg-[#ffaa00]/20 text-[#ffaa00]'
                          : 'bg-[#00ff88]/20 text-[#00ff88]'
                      }`}
                    >
                      {campaign.status === 'active' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white"
                  >
                    <Settings className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-[#ff3366]"
                  >
                    <Trash2 className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Target Progress</span>
                  <span className="text-[#00ff88]">
                    ${campaign.profit.toLocaleString()} / ${campaign.target.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(campaign.targetProgress, 100)}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                    className={`h-full rounded-full ${
                      campaign.targetProgress >= 100
                        ? 'bg-gradient-to-r from-[#00ff88] to-[#00d4ff]'
                        : 'bg-[#00ff88]'
                    }`}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Create Campaign Modal */}
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-card p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Create New Campaign</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Campaign Name */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Campaign Name</label>
                  <input
                    type="text"
                    placeholder="e.g., ARB Accumulation Q1"
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-[#00ff88]/30 focus:border-[#00ff88] focus:outline-none text-white"
                  />
                </div>

                {/* Investment Amount */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Investment Amount (USD)</label>
                  <input
                    type="number"
                    placeholder="10000"
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-[#00ff88]/30 focus:border-[#00ff88] focus:outline-none text-white"
                  />
                </div>

                {/* Profit Target */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Profit Target (USD)</label>
                  <input
                    type="number"
                    placeholder="5000"
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-[#00ff88]/30 focus:border-[#00ff88] focus:outline-none text-white"
                  />
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Start Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 rounded-xl bg-black/50 border border-[#00ff88]/30 focus:border-[#00ff88] focus:outline-none text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">End Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 rounded-xl bg-black/50 border border-[#00ff88]/30 focus:border-[#00ff88] focus:outline-none text-white"
                    />
                  </div>
                </div>

                {/* Chains */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Select Chains</label>
                  <div className="flex flex-wrap gap-2">
                    {['ETH', 'ARB', 'SOL', 'BTC', 'BNB', 'MATIC', 'AVAX', 'OP', 'BASE'].map((chain) => (
                      <button
                        key={chain}
                        className="px-4 py-2 rounded-xl border border-white/20 text-gray-300 hover:border-[#00ff88] hover:text-[#00ff88] transition-all"
                      >
                        {chain}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stop Loss */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Stop Loss (%)</label>
                  <input
                    type="number"
                    placeholder="15"
                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-[#00ff88]/30 focus:border-[#00ff88] focus:outline-none text-white"
                  />
                </div>

                {/* Strategy */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Trading Strategy</label>
                  <select className="w-full px-4 py-3 rounded-xl bg-black/50 border border-[#00ff88]/30 focus:border-[#00ff88] focus:outline-none text-white">
                    <option value="dca">DCA (Dollar Cost Averaging)</option>
                    <option value="grid">Grid Trading</option>
                    <option value="momentum">Momentum Trading</option>
                    <option value="swing">Swing Trading</option>
                    <option value="ai">AI Adaptive</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="flex space-x-4 pt-4">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-semibold"
                  >
                    Create Campaign
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
