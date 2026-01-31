'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  Settings,
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Send,
  ArrowLeftRight
} from 'lucide-react';

const portfolio = [
  { token: 'BTC', name: 'Bitcoin', balance: '0.42', value: 40929, price: 97450, change24h: 2.4, chain: 'Bitcoin', color: '#f7931a' },
  { token: 'ETH', name: 'Ethereum', balance: '4.25', value: 14662.5, price: 3450, change24h: 3.1, chain: 'Ethereum', color: '#627eea' },
  { token: 'ARB', name: 'Arbitrum', balance: '12,500', value: 15500, price: 1.24, change24h: 8.7, chain: 'Arbitrum', color: '#28a0f0' },
  { token: 'SOL', name: 'Solana', balance: '125', value: 24375, price: 195, change24h: -1.2, chain: 'Solana', color: '#9945ff' },
  { token: 'BNB', name: 'BNB', balance: '28', value: 17360, price: 620, change24h: -2.8, chain: 'BNB Chain', color: '#f3ba2f' },
  { token: 'MATIC', name: 'Polygon', balance: '5,000', value: 4600, price: 0.92, change24h: 4.5, chain: 'Polygon', color: '#8247e5' },
  { token: 'AVAX', name: 'Avalanche', balance: '85', value: 3485, price: 41, change24h: 1.8, chain: 'Avalanche', color: '#e84142' },
  { token: 'OP', name: 'Optimism', balance: '1,200', value: 2880, price: 2.4, change24h: 5.2, chain: 'Optimism', color: '#ff0420' },
];

const transactions = [
  { type: 'receive', token: 'ETH', amount: '0.5', from: '0x1234...5678', time: '2 hours ago', status: 'completed' },
  { type: 'send', token: 'ARB', amount: '500', to: '0xabcd...efgh', time: '5 hours ago', status: 'completed' },
  { type: 'swap', tokenIn: 'USDC', tokenOut: 'ETH', amountIn: '1,500', amountOut: '0.43', time: '1 day ago', status: 'completed' },
  { type: 'receive', token: 'SOL', amount: '25', from: '0x9876...5432', time: '2 days ago', status: 'completed' },
  { type: 'send', token: 'BTC', amount: '0.05', to: '0xijkl...mnop', time: '3 days ago', status: 'pending' },
];

export default function Portfolio() {
  const [hideBalances, setHideBalances] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');

  const totalValue = portfolio.reduce((sum, item) => sum + item.value, 0);
  const totalChange = 5.8; // Mock change

  const copyAddress = () => {
    navigator.clipboard.writeText('0x1234567890abcdef1234567890abcdef12345678');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Your <span className="gradient-text">Portfolio</span>
            </h1>
            <p className="text-gray-400">Track your assets across all chains</p>
          </div>

          <div className="flex items-center space-x-3 mt-4 lg:mt-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setHideBalances(!hideBalances)}
              className="p-3 rounded-xl glass border border-white/10 hover:border-[#00ff88]/30"
            >
              {hideBalances ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="p-3 rounded-xl glass border border-white/10 hover:border-[#00ff88]/30"
            >
              <RefreshCw className="w-5 h-5 text-gray-400" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="p-3 rounded-xl glass border border-white/10 hover:border-[#00ff88]/30"
            >
              <Download className="w-5 h-5 text-gray-400" />
            </motion.button>
          </div>
        </div>

        {/* Wallet Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 mb-8 relative overflow-hidden"
        >
          {/* Background Gradient */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#00ff88]/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[#00d4ff]/20 to-transparent rounded-full blur-3xl" />

          <div className="relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <p className="text-gray-400 mb-2">Total Portfolio Value</p>
                <div className="flex items-baseline space-x-4">
                  <h2 className="text-5xl font-bold text-white">
                    {hideBalances ? '••••••' : `$${totalValue.toLocaleString()}`}
                  </h2>
                  <span className={`flex items-center space-x-1 text-lg ${totalChange >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                    {totalChange >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    <span>{hideBalances ? '••' : `${totalChange}%`}</span>
                  </span>
                </div>

                {/* Wallet Address */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={copyAddress}
                  className="mt-4 flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#00ff88]/30"
                >
                  <Wallet className="w-4 h-4 text-[#00ff88]" />
                  <span className="text-gray-300 font-mono text-sm">0x1234...5678</span>
                  {copied ? <Check className="w-4 h-4 text-[#00ff88]" /> : <Copy className="w-4 h-4 text-gray-500" />}
                </motion.button>
              </div>

              {/* Quick Actions */}
              <div className="flex space-x-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center px-6 py-4 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/30 hover:bg-[#00ff88]/20"
                >
                  <Plus className="w-6 h-6 text-[#00ff88] mb-1" />
                  <span className="text-sm text-[#00ff88]">Deposit</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center px-6 py-4 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 hover:bg-[#00d4ff]/20"
                >
                  <Send className="w-6 h-6 text-[#00d4ff] mb-1" />
                  <span className="text-sm text-[#00d4ff]">Send</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center px-6 py-4 rounded-xl bg-[#ff00ff]/10 border border-[#ff00ff]/30 hover:bg-[#ff00ff]/20"
                >
                  <ArrowLeftRight className="w-6 h-6 text-[#ff00ff] mb-1" />
                  <span className="text-sm text-[#ff00ff]">Swap</span>
                </motion.button>
              </div>
            </div>

            {/* Chart Placeholder */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Portfolio Performance</h3>
                <div className="flex space-x-2">
                  {['24h', '7d', '30d', 'All'].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setSelectedTimeframe(tf)}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        selectedTimeframe === tf
                          ? 'bg-[#00ff88]/20 text-[#00ff88]'
                          : 'text-gray-500 hover:text-white'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-48 bg-black/20 rounded-xl p-4 relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 800 150" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="portfolioGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#00ff88" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 120 Q100 100 200 80 T400 60 T600 40 T800 20"
                    fill="none"
                    stroke="#00ff88"
                    strokeWidth="3"
                  />
                  <path
                    d="M0 120 Q100 100 200 80 T400 60 T600 40 T800 20 L800 150 L0 150 Z"
                    fill="url(#portfolioGradient)"
                  />
                </svg>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Assets List */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Assets</h3>
                <button className="text-gray-400 hover:text-white text-sm flex items-center space-x-1">
                  <Settings className="w-4 h-4" />
                  <span>Manage</span>
                </button>
              </div>

              <div className="space-y-2">
                {portfolio.map((asset, index) => (
                  <motion.div
                    key={asset.token}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: asset.color }}
                      >
                        {asset.token.slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-semibold text-white">{asset.name}</p>
                          <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{asset.chain}</span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {hideBalances ? '••••' : asset.balance} {asset.token}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-white">
                        {hideBalances ? '••••••' : `$${asset.value.toLocaleString()}`}
                      </p>
                      <div className={`flex items-center justify-end space-x-1 ${
                        asset.change24h >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'
                      }`}>
                        {asset.change24h >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        <span className="text-sm">{asset.change24h}%</span>
                      </div>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-2">
                      <button className="p-2 rounded-lg hover:bg-white/10">
                        <Send className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-white/10">
                        <ArrowLeftRight className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-white/10">
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Allocation Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Allocation</h3>

              {/* Simple Pie Chart Representation */}
              <div className="relative w-48 h-48 mx-auto mb-6">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {portfolio.slice(0, 5).map((asset, index) => {
                    const percentage = (asset.value / totalValue) * 100;
                    const offset = portfolio.slice(0, index).reduce((sum, a) => sum + (a.value / totalValue) * 100, 0);
                    return (
                      <circle
                        key={asset.token}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={asset.color}
                        strokeWidth="12"
                        strokeDasharray={`${percentage * 2.51} 251`}
                        strokeDashoffset={`${-offset * 2.51}`}
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">8</p>
                    <p className="text-xs text-gray-400">Assets</p>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-2">
                {portfolio.slice(0, 5).map((asset) => (
                  <div key={asset.token} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: asset.color }} />
                      <span className="text-gray-400 text-sm">{asset.token}</span>
                    </div>
                    <span className="text-white text-sm">
                      {((asset.value / totalValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent Transactions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                <button className="text-[#00ff88] text-sm hover:underline">View All</button>
              </div>

              <div className="space-y-3">
                {transactions.map((tx, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-black/20">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        tx.type === 'receive' ? 'bg-[#00ff88]/20' :
                        tx.type === 'send' ? 'bg-[#ff3366]/20' :
                        'bg-[#00d4ff]/20'
                      }`}>
                        {tx.type === 'receive' ? (
                          <ArrowDownRight className="w-4 h-4 text-[#00ff88]" />
                        ) : tx.type === 'send' ? (
                          <ArrowUpRight className="w-4 h-4 text-[#ff3366]" />
                        ) : (
                          <ArrowLeftRight className="w-4 h-4 text-[#00d4ff]" />
                        )}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium capitalize">{tx.type}</p>
                        <p className="text-gray-500 text-xs">{tx.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        tx.type === 'receive' ? 'text-[#00ff88]' :
                        tx.type === 'send' ? 'text-[#ff3366]' :
                        'text-white'
                      }`}>
                        {tx.type === 'swap'
                          ? `${tx.amountIn} → ${tx.amountOut}`
                          : `${tx.type === 'receive' ? '+' : '-'}${tx.amount} ${tx.token}`
                        }
                      </p>
                      <p className={`text-xs ${
                        tx.status === 'completed' ? 'text-gray-500' : 'text-[#ffaa00]'
                      }`}>
                        {tx.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
