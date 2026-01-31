'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Zap,
  Bot,
  TrendingUp,
  TrendingDown,
  Wallet,
  Settings,
  Bell,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  PieChart,
  BarChart3,
  Target,
  Play,
  Pause,
  Power,
  Sliders,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  Clock,
  DollarSign,
  Layers
} from 'lucide-react';

// Mock data for trades
const recentTrades = [
  { id: 1, type: 'BUY', token: 'ARB', amount: '2,500', price: '$1.24', profit: '+$125', time: '2m ago', chain: 'Arbitrum', status: 'completed' },
  { id: 2, type: 'SELL', token: 'ETH', amount: '0.8', price: '$3,450', profit: '+$87', time: '5m ago', chain: 'Ethereum', status: 'completed' },
  { id: 3, type: 'BUY', token: 'SOL', amount: '45', price: '$195', profit: '-$23', time: '12m ago', chain: 'Solana', status: 'completed' },
  { id: 4, type: 'SELL', token: 'BNB', amount: '3.2', price: '$620', profit: '+$156', time: '18m ago', chain: 'BNB Chain', status: 'completed' },
  { id: 5, type: 'BUY', token: 'MATIC', amount: '1,200', price: '$0.92', profit: '+$44', time: '25m ago', chain: 'Polygon', status: 'pending' },
];

const portfolio = [
  { token: 'ETH', balance: '4.25', value: '$14,662', change: '+5.2%', color: '#627eea' },
  { token: 'ARB', balance: '12,500', value: '$15,500', change: '+12.4%', color: '#28a0f0' },
  { token: 'SOL', balance: '125', value: '$24,375', change: '+8.7%', color: '#9945ff' },
  { token: 'BTC', balance: '0.42', value: '$39,480', change: '+2.1%', color: '#f7931a' },
  { token: 'BNB', balance: '28', value: '$17,360', change: '-1.2%', color: '#f3ba2f' },
];

const activeBots = [
  { name: 'ARB Momentum', status: 'running', profit: '+$2,450', trades: 47, winRate: '78%', chain: 'Arbitrum' },
  { name: 'ETH Grid Bot', status: 'running', profit: '+$1,890', trades: 123, winRate: '65%', chain: 'Ethereum' },
  { name: 'SOL Swing', status: 'paused', profit: '+$890', trades: 28, winRate: '71%', chain: 'Solana' },
];

const chainStats = [
  { name: 'Arbitrum', color: '#28a0f0', volume: '$45,230', trades: 156 },
  { name: 'Ethereum', color: '#627eea', volume: '$32,100', trades: 89 },
  { name: 'Solana', color: '#9945ff', volume: '$28,900', trades: 234 },
  { name: 'BNB Chain', color: '#f3ba2f', volume: '$18,400', trades: 67 },
];

export default function Dashboard() {
  const [selectedChain, setSelectedChain] = useState('all');
  const [botRunning, setBotRunning] = useState(true);
  const [copied, setCopied] = useState(false);

  const totalValue = '$111,377';
  const totalProfit = '+$8,245';
  const profitPercent = '+7.9%';

  const copyAddress = () => {
    navigator.clipboard.writeText('0x1234...5678');
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
              AI Trading <span className="gradient-text">Dashboard</span>
            </h1>
            <p className="text-gray-400">Your multi-chain trading command center</p>
          </div>

          <div className="flex items-center space-x-4 mt-4 lg:mt-0">
            {/* Wallet */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={copyAddress}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl glass border border-[#00ff88]/20 hover:border-[#00ff88]/50"
            >
              <Wallet className="w-5 h-5 text-[#00ff88]" />
              <span className="text-white font-mono">0x1234...5678</span>
              {copied ? (
                <Check className="w-4 h-4 text-[#00ff88]" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </motion.button>

            {/* Notifications */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="relative p-3 rounded-xl glass border border-white/10 hover:border-[#00ff88]/30"
            >
              <Bell className="w-5 h-5 text-gray-400" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#00ff88] rounded-full" />
            </motion.button>

            {/* Settings */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="p-3 rounded-xl glass border border-white/10 hover:border-[#00ff88]/30"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </motion.button>
          </div>
        </div>

        {/* Main Bot Control */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-4 mb-4 lg:mb-0">
              <div className={`w-16 h-16 rounded-2xl ${botRunning ? 'bg-[#00ff88]/20' : 'bg-gray-500/20'} flex items-center justify-center`}>
                <Bot className={`w-8 h-8 ${botRunning ? 'text-[#00ff88]' : 'text-gray-500'}`} />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-white">VoltSwap AI Engine</h2>
                  <span className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold ${
                    botRunning ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${botRunning ? 'bg-[#00ff88] animate-pulse' : 'bg-gray-500'}`} />
                    <span>{botRunning ? 'Running' : 'Paused'}</span>
                  </span>
                </div>
                <p className="text-gray-400">Analyzing 12 chains • 47 active positions • 3 bots running</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setBotRunning(!botRunning)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  botRunning
                    ? 'bg-[#ff3366]/20 text-[#ff3366] border border-[#ff3366]/30 hover:bg-[#ff3366]/30'
                    : 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/30 hover:bg-[#00ff88]/30'
                }`}
              >
                {botRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                <span>{botRunning ? 'Pause Bot' : 'Start Bot'}</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-semibold"
              >
                <Sliders className="w-5 h-5" />
                <span>Configure</span>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-[#00ff88]" />
              <span className="text-[#00ff88] text-sm font-semibold">{profitPercent}</span>
            </div>
            <p className="text-gray-400 text-sm mb-1">Total Portfolio</p>
            <p className="text-2xl font-bold text-white">{totalValue}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-[#00d4ff]" />
              <span className="text-[#00ff88] text-sm font-semibold">+24.5%</span>
            </div>
            <p className="text-gray-400 text-sm mb-1">Total Profit</p>
            <p className="text-2xl font-bold text-[#00ff88]">{totalProfit}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 text-[#ff00ff]" />
              <span className="text-gray-400 text-sm">Today</span>
            </div>
            <p className="text-gray-400 text-sm mb-1">Trades Executed</p>
            <p className="text-2xl font-bold text-white">156</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <Target className="w-8 h-8 text-[#ffaa00]" />
              <span className="text-[#00ff88] text-sm font-semibold">High</span>
            </div>
            <p className="text-gray-400 text-sm mb-1">Win Rate</p>
            <p className="text-2xl font-bold text-white">73.5%</p>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Chart & Trades */}
          <div className="lg:col-span-2 space-y-8">
            {/* Performance Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Performance Overview</h3>
                <div className="flex items-center space-x-2">
                  {['24h', '7d', '30d', 'All'].map((period) => (
                    <button
                      key={period}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        period === '7d'
                          ? 'bg-[#00ff88]/20 text-[#00ff88]'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Placeholder */}
              <div className="h-64 bg-black/30 rounded-xl p-4 relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="dashboardGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#00ff88" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 160 Q100 140 200 120 T400 80 T600 100 T800 40"
                    fill="none"
                    stroke="#00ff88"
                    strokeWidth="3"
                  />
                  <path
                    d="M0 160 Q100 140 200 120 T400 80 T600 100 T800 40 L800 200 L0 200 Z"
                    fill="url(#dashboardGradient)"
                  />
                </svg>

                {/* Chart Stats Overlay */}
                <div className="absolute top-4 left-4">
                  <p className="text-3xl font-bold text-white">{totalValue}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <ArrowUpRight className="w-4 h-4 text-[#00ff88]" />
                    <span className="text-[#00ff88] font-semibold">{profitPercent}</span>
                    <span className="text-gray-400 text-sm">vs last week</span>
                  </div>
                </div>
              </div>

              {/* Chain Performance */}
              <div className="grid grid-cols-4 gap-4 mt-6">
                {chainStats.map((chain) => (
                  <div key={chain.name} className="text-center">
                    <div
                      className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: chain.color }}
                    >
                      {chain.name.slice(0, 3).toUpperCase()}
                    </div>
                    <p className="text-white font-semibold text-sm">{chain.volume}</p>
                    <p className="text-gray-500 text-xs">{chain.trades} trades</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent Trades */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Recent Trades</h3>
                <button className="flex items-center space-x-1 text-[#00ff88] hover:underline text-sm">
                  <span>View All</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {recentTrades.map((trade, index) => (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-center justify-between p-4 bg-black/20 rounded-xl hover:bg-black/30 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        trade.type === 'BUY'
                          ? 'bg-[#00ff88]/20 text-[#00ff88]'
                          : 'bg-[#ff3366]/20 text-[#ff3366]'
                      }`}>
                        {trade.type}
                      </span>
                      <div>
                        <p className="text-white font-semibold">{trade.token}</p>
                        <p className="text-gray-500 text-xs">{trade.chain}</p>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-white">{trade.amount}</p>
                      <p className="text-gray-500 text-xs">{trade.price}</p>
                    </div>

                    <div className="text-right">
                      <p className={trade.profit.startsWith('+') ? 'text-[#00ff88]' : 'text-[#ff3366]'}>
                        {trade.profit}
                      </p>
                      <p className="text-gray-500 text-xs">{trade.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column - Portfolio & Bots */}
          <div className="space-y-8">
            {/* Portfolio */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Portfolio</h3>
                <button className="text-gray-400 hover:text-white">
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {portfolio.map((item, index) => (
                  <motion.div
                    key={item.token}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: item.color }}
                      >
                        {item.token}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{item.token}</p>
                        <p className="text-gray-500 text-xs">{item.balance}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">{item.value}</p>
                      <p className={item.change.startsWith('+') ? 'text-[#00ff88] text-xs' : 'text-[#ff3366] text-xs'}>
                        {item.change}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <Link href="/portfolio">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className="w-full mt-4 py-3 rounded-xl border border-[#00ff88]/30 text-[#00ff88] font-semibold hover:bg-[#00ff88]/10 transition-all"
                >
                  View Full Portfolio
                </motion.button>
              </Link>
            </motion.div>

            {/* Active Bots */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Active Bots</h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  className="px-3 py-1 rounded-lg bg-[#00ff88]/20 text-[#00ff88] text-sm font-semibold"
                >
                  + New Bot
                </motion.button>
              </div>

              <div className="space-y-4">
                {activeBots.map((bot, index) => (
                  <motion.div
                    key={bot.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="p-4 bg-black/20 rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Bot className={`w-5 h-5 ${bot.status === 'running' ? 'text-[#00ff88]' : 'text-gray-500'}`} />
                        <span className="text-white font-semibold">{bot.name}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        bot.status === 'running'
                          ? 'bg-[#00ff88]/20 text-[#00ff88]'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {bot.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[#00ff88] font-semibold">{bot.profit}</p>
                        <p className="text-gray-500 text-xs">Profit</p>
                      </div>
                      <div>
                        <p className="text-white font-semibold">{bot.trades}</p>
                        <p className="text-gray-500 text-xs">Trades</p>
                      </div>
                      <div>
                        <p className="text-white font-semibold">{bot.winRate}</p>
                        <p className="text-gray-500 text-xs">Win Rate</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* AI Insights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-card p-6"
            >
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#ff00ff]" />
                <h3 className="text-lg font-semibold text-white">AI Insights</h3>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#00ff88]/10 border border-[#00ff88]/20">
                  <div className="flex items-start space-x-2">
                    <TrendingUp className="w-4 h-4 text-[#00ff88] mt-1" />
                    <p className="text-sm text-gray-300">
                      <span className="text-[#00ff88] font-semibold">ARB</span> showing strong momentum. Consider increasing position by 15%.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#ffaa00]/10 border border-[#ffaa00]/20">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-[#ffaa00] mt-1" />
                    <p className="text-sm text-gray-300">
                      Market volatility high. Tightening stop-losses on <span className="text-[#ffaa00] font-semibold">SOL</span> positions.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/20">
                  <div className="flex items-start space-x-2">
                    <Clock className="w-4 h-4 text-[#00d4ff] mt-1" />
                    <p className="text-sm text-gray-300">
                      Best trading window: <span className="text-[#00d4ff] font-semibold">14:00-16:00 UTC</span> based on your history.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
