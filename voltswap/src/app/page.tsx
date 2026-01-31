'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  Bot,
  TrendingUp,
  Shield,
  Cpu,
  Globe,
  ArrowRight,
  Play,
  ChevronRight,
  BarChart3,
  Wallet,
  Target,
  Sparkles,
  Trophy,
  Clock,
  DollarSign,
  PieChart,
  Send,
  Chrome,
  Smartphone,
  MessageSquare,
  Check,
  Star,
  Coins,
  Rocket,
  Lock,
  Users,
  Layers,
  RefreshCw
} from 'lucide-react';

// Chain icons/logos data
const chains = [
  { name: 'Ethereum', symbol: 'ETH', color: '#627eea', class: 'chain-eth' },
  { name: 'Arbitrum', symbol: 'ARB', color: '#28a0f0', class: 'chain-arb', featured: true },
  { name: 'Solana', symbol: 'SOL', color: '#9945ff', class: 'chain-sol' },
  { name: 'Bitcoin', symbol: 'BTC', color: '#f7931a', class: 'chain-btc' },
  { name: 'BNB Chain', symbol: 'BNB', color: '#f3ba2f', class: 'chain-bnb' },
  { name: 'Polygon', symbol: 'MATIC', color: '#8247e5', class: 'chain-matic' },
  { name: 'Avalanche', symbol: 'AVAX', color: '#e84142', class: 'chain-avax' },
  { name: 'TON', symbol: 'TON', color: '#0098ea', class: 'chain-ton' },
  { name: 'Base', symbol: 'BASE', color: '#0052ff', class: 'chain-base' },
  { name: 'Optimism', symbol: 'OP', color: '#ff0420', class: 'chain-op' },
];

const features = [
  {
    icon: Bot,
    title: 'AI Trading Engine',
    description: 'Advanced neural networks analyze market patterns 24/7 to execute optimal trades automatically.',
    gradient: 'from-[#00ff88] to-[#00d4ff]',
  },
  {
    icon: Globe,
    title: 'Multi-Chain Support',
    description: 'Trade across Ethereum, Arbitrum, Solana, Bitcoin, and 10+ major blockchains seamlessly.',
    gradient: 'from-[#00d4ff] to-[#ff00ff]',
  },
  {
    icon: Target,
    title: 'Campaign Manager',
    description: 'Set up automated investment campaigns with custom start/end dates, profit targets, and limits.',
    gradient: 'from-[#ff00ff] to-[#ffaa00]',
  },
  {
    icon: BarChart3,
    title: 'AI Betting Odds',
    description: 'Get AI-powered predictions on any crypto based on historical data and market sentiment.',
    gradient: 'from-[#ffaa00] to-[#00ff88]',
  },
  {
    icon: Shield,
    title: 'Military-Grade Security',
    description: 'Your funds never leave your wallet. Non-custodial with encrypted API connections.',
    gradient: 'from-[#00ff88] to-[#ff00ff]',
  },
  {
    icon: Cpu,
    title: 'DEX Integration',
    description: 'Connect to all major DEXs including Uniswap, SushiSwap, Jupiter, Raydium, and more.',
    gradient: 'from-[#00d4ff] to-[#00ff88]',
  },
];

const stats = [
  { value: '$2.4B+', label: 'Trading Volume', icon: TrendingUp },
  { value: '150K+', label: 'Active Traders', icon: Users },
  { value: '99.9%', label: 'Uptime', icon: Clock },
  { value: '12+', label: 'Supported Chains', icon: Layers },
];

const platforms = [
  {
    icon: Globe,
    name: 'Web App',
    description: 'Full-featured trading dashboard accessible from any browser.',
    status: 'Live',
    color: '#00ff88',
  },
  {
    icon: Send,
    name: 'Telegram Bot',
    description: 'Trade directly from Telegram with TON blockchain integration.',
    status: 'Live',
    color: '#0088cc',
  },
  {
    icon: Chrome,
    name: 'Chrome Extension',
    description: 'Quick access to your trades and portfolio from any webpage.',
    status: 'Beta',
    color: '#4285f4',
  },
  {
    icon: Smartphone,
    name: 'Mobile App',
    description: 'Native iOS and Android apps for trading on the go.',
    status: 'Coming Soon',
    color: '#ff00ff',
  },
];

const tokenomics = [
  { name: 'Community & Rewards', percentage: 40, color: '#00ff88' },
  { name: 'Liquidity Pool', percentage: 25, color: '#00d4ff' },
  { name: 'Development', percentage: 15, color: '#ff00ff' },
  { name: 'Marketing', percentage: 10, color: '#ffaa00' },
  { name: 'Team (Vested)', percentage: 10, color: '#ff3366' },
];

const tokenUtility = [
  { icon: Sparkles, title: 'Premium Features', description: 'Unlock advanced AI models and priority execution' },
  { icon: Trophy, title: 'Staking Rewards', description: 'Stake $VOLT for boosted trading rewards' },
  { icon: DollarSign, title: 'Fee Discounts', description: 'Hold $VOLT for reduced platform fees' },
  { icon: Users, title: 'Governance', description: 'Vote on platform upgrades and new features' },
];

export default function Home() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  return (
    <div ref={containerRef} className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Gradient Orbs */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-[#00ff88]/20 blur-[120px]"
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, delay: 2 }}
            className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-[#00d4ff]/20 blur-[120px]"
          />
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 10, repeat: Infinity, delay: 4 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#ff00ff]/10 blur-[100px]"
          />
        </div>

        {/* Floating Chain Icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {chains.slice(0, 6).map((chain, index) => (
            <motion.div
              key={chain.symbol}
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0.3, 0.6, 0.3],
                y: [0, -30, 0],
                x: [0, index % 2 === 0 ? 20 : -20, 0],
              }}
              transition={{
                duration: 5 + index,
                repeat: Infinity,
                delay: index * 0.5,
              }}
              className="absolute"
              style={{
                top: `${20 + (index * 15)}%`,
                left: index % 2 === 0 ? `${5 + (index * 3)}%` : undefined,
                right: index % 2 !== 0 ? `${5 + (index * 3)}%` : undefined,
              }}
            >
              <div
                className={`w-14 h-14 rounded-xl ${chain.class} flex items-center justify-center text-white font-bold shadow-lg`}
              >
                {chain.symbol.slice(0, 3)}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-full glass mb-8"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff88] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00ff88]"></span>
            </span>
            <span className="text-gray-300">Powered by Advanced AI</span>
            <Sparkles className="w-4 h-4 text-[#00ff88]" />
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="hero-title text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight"
          >
            <span className="text-white">Trade Smarter with</span>
            <br />
            <span className="gradient-text">AI-Powered</span>
            <span className="text-white"> Multi-Chain</span>
            <br />
            <span className="text-[#00ff88] text-glow">Intelligence</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl sm:text-2xl text-gray-400 max-w-3xl mx-auto mb-10"
          >
            The ultimate AI trading bot that works across{' '}
            <span className="text-[#00ff88]">ERC-20</span>,{' '}
            <span className="text-[#9945ff]">Solana</span>,{' '}
            <span className="text-[#f7931a]">Bitcoin</span>, and{' '}
            <span className="text-[#28a0f0]">Arbitrum</span>. Automated campaigns, betting odds, and more.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Link href="/dashboard">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary text-lg px-8 py-4 flex items-center space-x-3"
              >
                <Rocket className="w-6 h-6" />
                <span>Launch App</span>
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-secondary text-lg px-8 py-4 flex items-center space-x-3"
            >
              <Play className="w-6 h-6" />
              <span>Watch Demo</span>
            </motion.button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="glass-card p-6 hover-lift"
              >
                <stat.icon className="w-8 h-8 text-[#00ff88] mx-auto mb-3" />
                <div className="stats-value">{stat.value}</div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 rounded-full border-2 border-[#00ff88]/50 flex items-start justify-center p-2">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-3 rounded-full bg-[#00ff88]"
            />
          </div>
        </motion.div>
      </section>

      {/* Chains Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Trade Across <span className="gradient-text">12+ Blockchains</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Seamlessly execute trades across all major chains with one unified interface.
            </p>
          </motion.div>

          {/* Chain Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {chains.map((chain, index) => (
              <motion.div
                key={chain.symbol}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className={`glass-card p-6 text-center cursor-pointer ${
                  chain.featured ? 'ring-2 ring-[#28a0f0] ring-offset-2 ring-offset-black' : ''
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-xl ${chain.class} mx-auto mb-3 flex items-center justify-center text-white font-bold text-lg shadow-lg`}
                >
                  {chain.symbol.slice(0, 3)}
                </div>
                <h3 className="font-semibold text-white">{chain.name}</h3>
                <p className="text-sm text-gray-400">{chain.symbol}</p>
                {chain.featured && (
                  <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-[#28a0f0]/20 text-[#28a0f0]">
                    Featured
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Supercharge Your <span className="gradient-text">Trading</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Everything you need to trade like a pro, powered by cutting-edge artificial intelligence.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-8 hover-lift group"
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} p-0.5 mb-6`}>
                  <div className="w-full h-full rounded-2xl bg-black/80 flex items-center justify-center">
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#00ff88] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Trading Dashboard Preview */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                AI That Trades <span className="gradient-text">For You</span>
              </h2>
              <p className="text-gray-400 text-lg mb-8">
                Our advanced neural networks analyze millions of data points in real-time to identify the best trading opportunities across all supported chains.
              </p>
              <div className="space-y-4">
                {[
                  'Real-time market analysis & pattern recognition',
                  'Automated entry and exit strategies',
                  'Risk management with stop-loss & take-profit',
                  'Portfolio rebalancing across chains',
                  'Sentiment analysis from social media',
                ].map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center space-x-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#00ff88]/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-[#00ff88]" />
                    </div>
                    <span className="text-gray-300">{item}</span>
                  </motion.div>
                ))}
              </div>
              <Link href="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-8 btn-primary flex items-center space-x-2"
                >
                  <span>Try AI Trading</span>
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
            </motion.div>

            {/* Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="glass-card p-6">
                {/* Mock Dashboard */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">AI Trading Dashboard</h3>
                    <span className="flex items-center space-x-2 text-[#00ff88]">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff88] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff88]"></span>
                      </span>
                      <span className="text-sm">Live</span>
                    </span>
                  </div>

                  {/* Mini Chart */}
                  <div className="h-40 bg-black/30 rounded-xl p-4 relative overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 80 Q50 60 100 70 T200 40 T300 55 T400 30"
                        fill="none"
                        stroke="#00ff88"
                        strokeWidth="2"
                      />
                      <path
                        d="M0 80 Q50 60 100 70 T200 40 T300 55 T400 30 L400 100 L0 100 Z"
                        fill="url(#chartGradient)"
                      />
                    </svg>
                    <div className="absolute top-4 right-4 text-right">
                      <p className="text-2xl font-bold text-[#00ff88]">+24.5%</p>
                      <p className="text-sm text-gray-400">24h Performance</p>
                    </div>
                  </div>

                  {/* Active Trades */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/30 rounded-xl p-4">
                      <p className="text-gray-400 text-sm mb-1">Active Trades</p>
                      <p className="text-2xl font-bold text-white">12</p>
                    </div>
                    <div className="bg-black/30 rounded-xl p-4">
                      <p className="text-gray-400 text-sm mb-1">Total Profit</p>
                      <p className="text-2xl font-bold text-[#00ff88]">$4,328</p>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="space-y-2">
                    {[
                      { action: 'BUY', token: 'ARB', amount: '1,500', time: '2m ago' },
                      { action: 'SELL', token: 'ETH', amount: '0.5', time: '5m ago' },
                      { action: 'BUY', token: 'SOL', amount: '25', time: '12m ago' },
                    ].map((trade, i) => (
                      <div key={i} className="flex items-center justify-between bg-black/20 rounded-lg p-3">
                        <div className="flex items-center space-x-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            trade.action === 'BUY' ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-[#ff3366]/20 text-[#ff3366]'
                          }`}>
                            {trade.action}
                          </span>
                          <span className="text-white font-medium">{trade.token}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-white">{trade.amount}</p>
                          <p className="text-xs text-gray-500">{trade.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#00ff88]/20 rounded-full blur-xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-[#00d4ff]/20 rounded-full blur-xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Campaign Manager Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Campaign Card Preview */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                    <Trophy className="w-5 h-5 text-[#ffaa00]" />
                    <span>Investment Campaign</span>
                  </h3>
                  <span className="px-3 py-1 rounded-full bg-[#00ff88]/20 text-[#00ff88] text-sm">Active</span>
                </div>

                {/* Campaign Details */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/30 rounded-xl p-4">
                      <p className="text-gray-400 text-sm mb-1">Initial Investment</p>
                      <p className="text-xl font-bold text-white">$10,000</p>
                    </div>
                    <div className="bg-black/30 rounded-xl p-4">
                      <p className="text-gray-400 text-sm mb-1">Current Value</p>
                      <p className="text-xl font-bold text-[#00ff88]">$12,450</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Profit Target</span>
                      <span className="text-[#00ff88]">$2,450 / $5,000</span>
                    </div>
                    <div className="h-3 bg-black/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: '49%' }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="h-full bg-gradient-to-r from-[#00ff88] to-[#00d4ff] rounded-full"
                      />
                    </div>
                  </div>

                  {/* Campaign Settings */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-black/20 rounded-lg p-3 text-center">
                      <Clock className="w-5 h-5 text-[#00d4ff] mx-auto mb-1" />
                      <p className="text-xs text-gray-400">Ends in</p>
                      <p className="text-sm font-semibold text-white">12 days</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 text-center">
                      <Target className="w-5 h-5 text-[#ff00ff] mx-auto mb-1" />
                      <p className="text-xs text-gray-400">Stop Loss</p>
                      <p className="text-sm font-semibold text-white">-15%</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 text-center">
                      <RefreshCw className="w-5 h-5 text-[#ffaa00] mx-auto mb-1" />
                      <p className="text-xs text-gray-400">Trades</p>
                      <p className="text-sm font-semibold text-white">47</p>
                    </div>
                  </div>

                  {/* Chain Allocation */}
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Chain Allocation</p>
                    <div className="flex space-x-2">
                      {[
                        { chain: 'ARB', percent: 40, color: '#28a0f0' },
                        { chain: 'ETH', percent: 30, color: '#627eea' },
                        { chain: 'SOL', percent: 20, color: '#9945ff' },
                        { chain: 'BNB', percent: 10, color: '#f3ba2f' },
                      ].map((item) => (
                        <div key={item.chain} className="flex-1">
                          <div
                            className="h-2 rounded-full"
                            style={{ backgroundColor: item.color, width: `${item.percent}%` }}
                          />
                          <p className="text-xs text-gray-500 mt-1">{item.chain}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2"
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Smart <span className="gradient-text">Campaign Manager</span>
              </h2>
              <p className="text-gray-400 text-lg mb-8">
                Set up automated investment campaigns with custom parameters. Define your entry/exit rules, profit targets, and let the AI handle the rest.
              </p>
              <div className="space-y-4">
                {[
                  'Set start and end dates for your campaigns',
                  'Define profit targets and stop-loss limits',
                  'Track money in/out with detailed reports',
                  'Multi-chain allocation strategies',
                  'Auto-reinvest profits option',
                ].map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center space-x-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#ffaa00]/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-[#ffaa00]" />
                    </div>
                    <span className="text-gray-300">{item}</span>
                  </motion.div>
                ))}
              </div>
              <Link href="/campaigns">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="mt-8 btn-primary flex items-center space-x-2"
                >
                  <span>Create Campaign</span>
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* AI Betting Odds Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#ff00ff]/5 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              AI <span className="gradient-text">Betting Odds</span> Predictor
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Get AI-powered price predictions based on historical data, market sentiment, and advanced pattern analysis.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Betting Interface */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5 text-[#ff00ff]" />
                  <span>AI Prediction Chat</span>
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Confidence:</span>
                  <span className="text-[#00ff88] font-semibold">87%</span>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-end">
                  <div className="bg-[#00ff88]/10 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                    <p className="text-white">What are the odds for ETH reaching $5000 in 30 days?</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                    <p className="text-gray-300 mb-2">Based on my analysis of historical data and current market trends:</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Bullish scenario (&gt;$5000):</span>
                        <span className="text-[#00ff88] font-semibold">34%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Neutral ($4000-$5000):</span>
                        <span className="text-[#00d4ff] font-semibold">45%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Bearish (&lt;$4000):</span>
                        <span className="text-[#ff3366] font-semibold">21%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Bet Buttons */}
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-3">Quick Position Size (of wallet balance after gas)</p>
                <div className="grid grid-cols-4 gap-3">
                  {[25, 50, 75, 100].map((percent) => (
                    <motion.button
                      key={percent}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="bet-btn py-3 rounded-xl bg-gradient-to-r from-[#00ff88]/20 to-[#00d4ff]/20 border border-[#00ff88]/30 text-white font-semibold hover:border-[#00ff88] transition-all"
                    >
                      {percent}%
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="flex space-x-3">
                <input
                  type="text"
                  placeholder="Ask about any crypto..."
                  className="flex-1 px-4 py-3 rounded-xl bg-black/50 border border-[#00ff88]/30 focus:border-[#00ff88] focus:outline-none text-white"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff00ff] to-[#00d4ff] text-white font-semibold"
                >
                  Predict
                </motion.button>
              </div>
            </motion.div>

            {/* Prediction Cards */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              {[
                { token: 'BTC', prediction: 'Bullish', confidence: 78, target: '$105,000', timeframe: '7 days', color: '#f7931a' },
                { token: 'ARB', prediction: 'Very Bullish', confidence: 92, target: '$2.50', timeframe: '14 days', color: '#28a0f0' },
                { token: 'SOL', prediction: 'Neutral', confidence: 65, target: '$180-$220', timeframe: '30 days', color: '#9945ff' },
              ].map((item, index) => (
                <motion.div
                  key={item.token}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card p-5 hover-lift cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: item.color }}
                      >
                        {item.token.slice(0, 3)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{item.token}</h4>
                        <p className="text-sm text-gray-400">{item.timeframe} forecast</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        item.prediction.includes('Bullish') ? 'text-[#00ff88]' : 'text-[#00d4ff]'
                      }`}>
                        {item.prediction}
                      </p>
                      <p className="text-sm text-gray-400">Target: {item.target}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">AI Confidence</span>
                      <span className="text-[#00ff88]">{item.confidence}%</span>
                    </div>
                    <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${item.confidence}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}

              <Link href="/betting">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="glass-card p-5 border-dashed border-2 border-[#00ff88]/30 flex items-center justify-center cursor-pointer hover:border-[#00ff88] transition-colors"
                >
                  <span className="text-[#00ff88] font-semibold flex items-center space-x-2">
                    <span>View All Predictions</span>
                    <ArrowRight className="w-5 h-5" />
                  </span>
                </motion.div>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Platforms Section */}
      <section id="platforms" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Trade <span className="gradient-text">Anywhere</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Access VoltSwap from your preferred platform. Web, mobile, Telegram, or browser extension.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {platforms.map((platform, index) => (
              <motion.div
                key={platform.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6 hover-lift"
              >
                <div
                  className="w-14 h-14 rounded-xl mb-4 flex items-center justify-center"
                  style={{ backgroundColor: `${platform.color}20` }}
                >
                  <platform.icon className="w-7 h-7" style={{ color: platform.color }} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{platform.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{platform.description}</p>
                <span
                  className="inline-block px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: platform.status === 'Live' ? 'rgba(0, 255, 136, 0.2)' :
                      platform.status === 'Beta' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 0, 255, 0.2)',
                    color: platform.status === 'Live' ? '#00ff88' :
                      platform.status === 'Beta' ? '#00d4ff' : '#ff00ff'
                  }}
                >
                  {platform.status}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Telegram & Chrome Feature */}
          <div className="grid md:grid-cols-2 gap-8 mt-12">
            {/* Telegram Bot */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              id="telegram"
              className="glass-card p-8"
            >
              <div className="flex items-start space-x-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-[#0088cc]/20 flex items-center justify-center">
                  <Send className="w-8 h-8 text-[#0088cc]" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Telegram Bot</h3>
                  <p className="text-gray-400">Trade on TON directly from Telegram</p>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  'Instant trade notifications',
                  'Execute trades via chat commands',
                  'Portfolio tracking in DMs',
                  'TON blockchain integration',
                ].map((feature) => (
                  <div key={feature} className="flex items-center space-x-2">
                    <Check className="w-5 h-5 text-[#0088cc]" />
                    <span className="text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-3 rounded-xl bg-[#0088cc] text-white font-semibold flex items-center justify-center space-x-2"
              >
                <Send className="w-5 h-5" />
                <span>Add to Telegram</span>
              </motion.button>
            </motion.div>

            {/* Chrome Extension */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              id="chrome"
              className="glass-card p-8"
            >
              <div className="flex items-start space-x-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-[#4285f4]/20 flex items-center justify-center">
                  <Chrome className="w-8 h-8 text-[#4285f4]" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Chrome Extension</h3>
                  <p className="text-gray-400">Quick access from any webpage</p>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  'One-click portfolio view',
                  'Real-time price alerts',
                  'Quick swap interface',
                  'Cross-chain bridge access',
                ].map((feature) => (
                  <div key={feature} className="flex items-center space-x-2">
                    <Check className="w-5 h-5 text-[#4285f4]" />
                    <span className="text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-3 rounded-xl bg-[#4285f4] text-white font-semibold flex items-center justify-center space-x-2"
              >
                <Chrome className="w-5 h-5" />
                <span>Add to Chrome</span>
              </motion.button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Tokenomics Section */}
      <section id="tokenomics" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00ff88]/5 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              <span className="gradient-text-gold">$VOLT</span> Tokenomics
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              The $VOLT token powers the VoltSwap ecosystem. Free trading bot, premium features for holders.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Token Distribution */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="text-2xl font-bold text-white mb-6">Token Distribution</h3>
              <div className="space-y-4">
                {tokenomics.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-300">{item.name}</span>
                      <span style={{ color: item.color }} className="font-semibold">{item.percentage}%</span>
                    </div>
                    <div className="h-3 bg-black/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${item.percentage}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Token Stats */}
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="glass-card p-4">
                  <p className="text-gray-400 text-sm">Total Supply</p>
                  <p className="text-2xl font-bold gradient-text-gold">1,000,000,000</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-gray-400 text-sm">Network</p>
                  <p className="text-2xl font-bold text-[#28a0f0]">Arbitrum</p>
                </div>
              </div>
            </motion.div>

            {/* Token Utility */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="text-2xl font-bold text-white mb-6">Token Utility</h3>
              <div className="grid grid-cols-2 gap-4">
                {tokenUtility.map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="glass-card p-5 hover-lift"
                  >
                    <item.icon className="w-10 h-10 text-[#00ff88] mb-3" />
                    <h4 className="font-semibold text-white mb-2">{item.title}</h4>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </motion.div>
                ))}
              </div>

              {/* Free Bot Note */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mt-6 p-4 rounded-xl border border-[#00ff88]/30 bg-[#00ff88]/5"
              >
                <div className="flex items-start space-x-3">
                  <Sparkles className="w-6 h-6 text-[#00ff88] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[#00ff88]">Free Trading Bot Forever</h4>
                    <p className="text-sm text-gray-400">
                      The core trading bot is always free. $VOLT unlocks premium features and boosted rewards. Your investments are yours - we only succeed when you succeed.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-12 text-center relative overflow-hidden"
          >
            {/* Background Effects */}
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-[#00ff88]/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#00d4ff]/20 rounded-full blur-[100px]" />

            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 mx-auto mb-6"
              >
                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#00ff88] to-[#00d4ff] flex items-center justify-center">
                  <Zap className="w-10 h-10 text-black" />
                </div>
              </motion.div>

              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                Ready to <span className="gradient-text">Supercharge</span> Your Trading?
              </h2>
              <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
                Join thousands of traders already using VoltSwap to automate their crypto trading across multiple chains.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/dashboard">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="btn-primary text-lg px-10 py-4 flex items-center space-x-3"
                  >
                    <Rocket className="w-6 h-6" />
                    <span>Start Trading Free</span>
                  </motion.button>
                </Link>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-secondary text-lg px-10 py-4 flex items-center space-x-3"
                >
                  <MessageSquare className="w-6 h-6" />
                  <span>Join Community</span>
                </motion.button>
              </div>

              {/* Trust Badges */}
              <div className="flex items-center justify-center space-x-8 mt-10 pt-8 border-t border-white/10">
                <div className="flex items-center space-x-2 text-gray-400">
                  <Lock className="w-5 h-5 text-[#00ff88]" />
                  <span className="text-sm">Non-Custodial</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-400">
                  <Shield className="w-5 h-5 text-[#00d4ff]" />
                  <span className="text-sm">Audited</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-400">
                  <Star className="w-5 h-5 text-[#ffaa00]" />
                  <span className="text-sm">4.9/5 Rating</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
