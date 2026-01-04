'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Coins, Clock, Users, Target, Wallet, Sparkles, Shield, TrendingUp } from 'lucide-react';

function CountdownTimer({ endTime }: { endTime: number }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / 86400),
        hours: Math.floor((diff % 86400) / 3600),
        mins: Math.floor((diff % 3600) / 60),
        secs: diff % 60,
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  return (
    <div className="flex justify-center space-x-4">
      {Object.entries(timeLeft).map(([unit, value]) => (
        <div key={unit} className="text-center">
          <div className="bg-gray-800 rounded-lg px-4 py-3 min-w-[70px]">
            <span className="text-3xl font-bold text-yellow-500">{value}</span>
          </div>
          <span className="text-xs text-gray-400 uppercase mt-1 block">{unit}</span>
        </div>
      ))}
    </div>
  );
}

export default function TokenSalePage() {
  const { isConnected } = useAccount();
  const [usdcAmount, setUsdcAmount] = useState('');

  const tokenPrice = 0.01; // $0.01 per token
  const tokensToReceive = usdcAmount ? (parseFloat(usdcAmount) / tokenPrice).toFixed(0) : '0';

  // Sale starts in the future (placeholder)
  const saleStartTime = Math.floor(Date.now() / 1000) + 86400 * 14; // 14 days from now

  const stats = [
    { label: 'Token Price', value: '$0.01', icon: Target },
    { label: 'For Sale', value: '30M SCORE', icon: Coins },
    { label: 'Max Supply', value: '100M', icon: TrendingUp },
    { label: 'Sale Start', value: 'TBA', icon: Clock },
  ];

  const features = [
    {
      icon: Sparkles,
      title: 'Fair Launch',
      description: 'No private sale, no VCs, no whitelist. Everyone gets equal access at the same price.',
    },
    {
      icon: Shield,
      title: 'No Vesting',
      description: 'Tokens are fully unlocked immediately. No cliff, no vesting schedule.',
    },
    {
      icon: Users,
      title: 'Community First',
      description: '30% of supply available in public sale. 25% reserved for community rewards.',
    },
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full mb-4">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Fair Launch</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-yellow-500">$SCORE</span> Token Sale
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Join the DappScore community. No private rounds, no whitelist - just a fair public sale
            where everyone has equal opportunity.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-gray-800 rounded-lg p-4 text-center">
              <stat.icon className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Purchase Card */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Buy $SCORE Tokens</h2>

            {/* Countdown */}
            <div className="mb-6">
              <p className="text-gray-400 text-sm text-center mb-3">Sale starts in:</p>
              <CountdownTimer endTime={saleStartTime} />
            </div>

            {/* Price Info */}
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Token Price</span>
                <span className="text-2xl font-bold text-yellow-500">$0.01</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-400">Available</span>
                <span className="text-gray-300">30,000,000 SCORE</span>
              </div>
            </div>

            {isConnected ? (
              <>
                {/* Fair Launch Badge */}
                <div className="flex items-center space-x-2 mb-4 p-3 rounded-lg bg-yellow-900/30 text-yellow-400">
                  <Sparkles className="h-5 w-5" />
                  <span>Fair launch - no whitelist required!</span>
                </div>

                {/* Purchase Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Amount (USDC)</label>
                    <input
                      type="number"
                      value={usdcAmount}
                      onChange={(e) => setUsdcAmount(e.target.value)}
                      placeholder="100"
                      min="50"
                      max="5000"
                      step="50"
                      disabled
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Min: $50 | Max: $5,000</p>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">You will receive</span>
                      <span className="text-xl font-bold text-white">
                        {parseInt(tokensToReceive).toLocaleString()} SCORE
                      </span>
                    </div>
                  </div>

                  <button
                    disabled
                    className="w-full py-4 bg-gray-600 text-gray-400 font-bold rounded-lg cursor-not-allowed"
                  >
                    Sale Not Started Yet
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">Connect your wallet to participate</p>
                <ConnectButton />
              </div>
            )}
          </div>

          {/* Right Side - Features & Tokenomics */}
          <div className="space-y-6">
            {/* Fair Launch Features */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Why Fair Launch?</h2>
              <div className="space-y-4">
                {features.map((feature) => (
                  <div key={feature.title} className="flex items-start space-x-3">
                    <div className="bg-yellow-500/10 rounded-lg p-2">
                      <feature.icon className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{feature.title}</h3>
                      <p className="text-sm text-gray-400">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tokenomics Summary */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="font-bold mb-4">Token Allocation</h3>
              <div className="space-y-3">
                {[
                  { label: 'Public Sale', value: '30%', color: 'bg-yellow-500' },
                  { label: 'Community Rewards', value: '25%', color: 'bg-green-500' },
                  { label: 'Ecosystem Fund', value: '15%', color: 'bg-blue-500' },
                  { label: 'Team (4yr vest)', value: '15%', color: 'bg-purple-500' },
                  { label: 'Liquidity', value: '10%', color: 'bg-cyan-500' },
                  { label: 'Treasury', value: '5%', color: 'bg-orange-500' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <span className="text-gray-400">{item.label}</span>
                    </div>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* How to Participate */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="font-bold mb-4">How to Participate</h3>
              <ol className="space-y-3">
                {[
                  'Connect your wallet (Base network)',
                  'Ensure you have USDC on Base',
                  'Enter the amount you want to purchase',
                  'Confirm the transaction',
                  'Receive $SCORE tokens instantly',
                ].map((step, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-yellow-500 text-black rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <span className="text-gray-300">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
