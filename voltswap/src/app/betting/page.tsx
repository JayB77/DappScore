'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Send,
  BarChart3,
  Clock,
  Target,
  Zap,
  AlertCircle,
  ChevronDown,
  RefreshCw,
  History,
  Star,
  Filter
} from 'lucide-react';

const predictions = [
  {
    token: 'BTC',
    name: 'Bitcoin',
    currentPrice: '$97,450',
    prediction: 'Bullish',
    confidence: 82,
    target: '$105,000',
    timeframe: '7 days',
    change24h: '+2.4%',
    color: '#f7931a',
    analysis: 'Strong institutional buying pressure with ETF inflows reaching record highs.',
  },
  {
    token: 'ETH',
    name: 'Ethereum',
    currentPrice: '$3,450',
    prediction: 'Bullish',
    confidence: 75,
    target: '$4,200',
    timeframe: '14 days',
    change24h: '+3.1%',
    color: '#627eea',
    analysis: 'Network upgrades and staking yields driving demand. Watch for $3,500 resistance.',
  },
  {
    token: 'ARB',
    name: 'Arbitrum',
    currentPrice: '$1.24',
    prediction: 'Very Bullish',
    confidence: 91,
    target: '$2.00',
    timeframe: '30 days',
    change24h: '+8.7%',
    color: '#28a0f0',
    analysis: 'L2 adoption accelerating. DeFi TVL growth outpacing competitors.',
  },
  {
    token: 'SOL',
    name: 'Solana',
    currentPrice: '$195',
    prediction: 'Neutral',
    confidence: 58,
    target: '$180-$220',
    timeframe: '7 days',
    change24h: '-1.2%',
    color: '#9945ff',
    analysis: 'Consolidating after strong rally. Volume decreasing, wait for breakout confirmation.',
  },
  {
    token: 'BNB',
    name: 'BNB',
    currentPrice: '$620',
    prediction: 'Bearish',
    confidence: 67,
    target: '$580',
    timeframe: '7 days',
    change24h: '-2.8%',
    color: '#f3ba2f',
    analysis: 'Regulatory concerns and decreasing exchange volume. Support at $600.',
  },
  {
    token: 'MATIC',
    name: 'Polygon',
    currentPrice: '$0.92',
    prediction: 'Bullish',
    confidence: 73,
    target: '$1.20',
    timeframe: '14 days',
    change24h: '+4.5%',
    color: '#8247e5',
    analysis: 'zkEVM adoption growing. Multiple partnerships announced this week.',
  },
];

const chatHistory = [
  {
    role: 'user',
    content: 'What are the odds for ETH reaching $5000 in 30 days?',
  },
  {
    role: 'ai',
    content: `Based on my analysis of historical price data, market sentiment, and on-chain metrics:

**ETH $5,000 in 30 days:**
• Probability: 28%
• Current resistance levels: $3,500, $4,000, $4,500
• Required gain: +45%

**Key factors:**
- Institutional inflows: Positive
- Network activity: Growing
- Market correlation with BTC: High

**Recommendation:** Consider a gradual position build if ETH breaks $3,500 with volume confirmation.`,
  },
  {
    role: 'user',
    content: 'Should I go long on ARB right now?',
  },
  {
    role: 'ai',
    content: `**ARB Analysis - Long Position:**

Current price: $1.24
My recommendation: **Yes, with conditions**

**Bull case (probability 65%):**
- Target 1: $1.50 (+21%)
- Target 2: $2.00 (+61%)
- Stop loss: $1.05 (-15%)

**Entry strategy:**
1. Enter 50% now at $1.24
2. Add 25% if it dips to $1.15
3. Add 25% on breakout above $1.35

**Risk/Reward ratio:** 3.2:1

Would you like me to set up a position with these parameters?`,
  },
];

export default function Betting() {
  const [message, setMessage] = useState('');
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  const quickBetPercentages = [25, 50, 75, 100];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              AI <span className="gradient-text">Betting Odds</span> Predictor
            </h1>
            <p className="text-gray-400">Get AI-powered predictions based on historical data and market analysis</p>
          </div>

          <div className="flex items-center space-x-4 mt-4 lg:mt-0">
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl border ${
                showHistory ? 'border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]' : 'border-white/20 text-gray-400'
              }`}
            >
              <History className="w-5 h-5" />
              <span>History</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="p-2 rounded-xl glass border border-white/10"
            >
              <RefreshCw className="w-5 h-5 text-gray-400" />
            </motion.button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Predictions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 text-center"
              >
                <TrendingUp className="w-8 h-8 text-[#00ff88] mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">78%</p>
                <p className="text-xs text-gray-400">Accuracy (30d)</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4 text-center"
              >
                <Target className="w-8 h-8 text-[#00d4ff] mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">1,247</p>
                <p className="text-xs text-gray-400">Predictions Made</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-4 text-center"
              >
                <Star className="w-8 h-8 text-[#ffaa00] mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">4.8/5</p>
                <p className="text-xs text-gray-400">User Rating</p>
              </motion.div>
            </div>

            {/* Prediction Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Top Predictions</h2>
                <button className="flex items-center space-x-2 text-gray-400 hover:text-white">
                  <Filter className="w-5 h-5" />
                  <span className="text-sm">Filter</span>
                </button>
              </div>

              {predictions.map((pred, index) => (
                <motion.div
                  key={pred.token}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setSelectedToken(pred.token)}
                  className={`glass-card p-6 cursor-pointer transition-all ${
                    selectedToken === pred.token ? 'ring-2 ring-[#00ff88]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: pred.color }}
                      >
                        {pred.token}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{pred.name}</h3>
                        <p className="text-gray-400">{pred.currentPrice}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        pred.prediction.includes('Bullish') ? 'text-[#00ff88]' :
                        pred.prediction.includes('Bearish') ? 'text-[#ff3366]' :
                        'text-[#00d4ff]'
                      }`}>
                        {pred.prediction}
                      </p>
                      <p className={`text-sm ${pred.change24h.startsWith('+') ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                        {pred.change24h}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-400 text-sm mb-4">{pred.analysis}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-xs text-gray-500">Target</p>
                        <p className="text-[#00ff88] font-semibold">{pred.target}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Timeframe</p>
                        <p className="text-white font-semibold">{pred.timeframe}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Confidence</p>
                      <p className="text-lg font-bold text-white">{pred.confidence}%</p>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div className="mt-4">
                    <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pred.confidence}%` }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: pred.color }}
                      />
                    </div>
                  </div>

                  {/* Quick Bet Buttons */}
                  {selectedToken === pred.token && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-4 border-t border-white/10"
                    >
                      <p className="text-sm text-gray-400 mb-3">Quick Position Size (after gas)</p>
                      <div className="grid grid-cols-4 gap-3">
                        {quickBetPercentages.map((percent) => (
                          <motion.button
                            key={percent}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setBetAmount(percent);
                            }}
                            className={`py-3 rounded-xl font-semibold transition-all ${
                              betAmount === percent
                                ? 'bg-[#00ff88] text-black'
                                : 'bg-gradient-to-r from-[#00ff88]/20 to-[#00d4ff]/20 border border-[#00ff88]/30 text-white hover:border-[#00ff88]'
                            }`}
                          >
                            {percent}%
                          </motion.button>
                        ))}
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-[#00ff88] to-[#00d4ff] text-black font-semibold"
                      >
                        Execute Trade
                      </motion.button>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Column - AI Chat */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-6 h-[700px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-[#ff00ff]" />
                  <h3 className="text-lg font-semibold text-white">AI Prediction Chat</h3>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                  <span className="text-xs text-gray-400">Online</span>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {chatHistory.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-[#00ff88]/10 rounded-tr-sm'
                          : 'bg-white/5 rounded-tl-sm'
                      }`}
                    >
                      {msg.role === 'ai' ? (
                        <div className="text-gray-300 text-sm whitespace-pre-wrap">
                          {msg.content.split('\n').map((line, i) => (
                            <p key={i} className={line.startsWith('**') ? 'font-semibold text-white' : ''}>
                              {line.replace(/\*\*/g, '')}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-white">{msg.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Suggested Questions */}
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Quick questions:</p>
                <div className="flex flex-wrap gap-2">
                  {['BTC prediction', 'Best trade now?', 'Risk analysis'].map((q) => (
                    <button
                      key={q}
                      onClick={() => setMessage(q)}
                      className="px-3 py-1 rounded-full bg-white/5 text-gray-400 text-xs hover:bg-white/10 hover:text-white"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about any crypto..."
                  className="flex-1 px-4 py-3 rounded-xl bg-black/50 border border-[#00ff88]/30 focus:border-[#00ff88] focus:outline-none text-white"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-3 rounded-xl bg-gradient-to-r from-[#ff00ff] to-[#00d4ff] text-white"
                >
                  <Send className="w-5 h-5" />
                </motion.button>
              </div>
            </motion.div>

            {/* Disclaimer */}
            <div className="glass-card p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-[#ffaa00] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[#ffaa00] font-semibold text-sm">Disclaimer</p>
                  <p className="text-gray-400 text-xs">
                    AI predictions are for informational purposes only. Always DYOR and never invest more than you can afford to lose.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
