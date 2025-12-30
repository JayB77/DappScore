'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Coins, Clock, Users, Target, CheckCircle, AlertCircle, Wallet } from 'lucide-react';

const salePhases = [
  {
    name: 'Private Sale',
    status: 'completed',
    price: '$0.005',
    allocation: '10M TRUST',
    sold: '10M',
    progress: 100,
  },
  {
    name: 'Presale',
    status: 'active',
    price: '$0.008',
    allocation: '15M TRUST',
    sold: '8.5M',
    progress: 57,
  },
  {
    name: 'Public Sale',
    status: 'upcoming',
    price: '$0.01',
    allocation: '15M TRUST',
    sold: '0',
    progress: 0,
  },
];

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
  const { isConnected, address } = useAccount();
  const [ethAmount, setEthAmount] = useState('');
  const [isWhitelisted] = useState(true); // Mock - would check contract

  const currentPhase = salePhases.find((p) => p.status === 'active');
  const tokenPrice = 0.000024; // ETH per token (presale)
  const tokensToReceive = ethAmount ? (parseFloat(ethAmount) / tokenPrice).toFixed(0) : '0';

  const saleEndTime = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days from now

  const stats = [
    { label: 'Total Raised', value: '$425,000', icon: Target },
    { label: 'Participants', value: '1,234', icon: Users },
    { label: 'Tokens Sold', value: '18.5M', icon: Coins },
    { label: 'Time Remaining', value: '7 Days', icon: Clock },
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-yellow-500">$TRUST</span> Token Sale
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Join the ICOTrust community and earn rewards for helping vet crypto projects.
            Early participants get the best prices.
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
            <h2 className="text-xl font-bold mb-4">Buy $TRUST Tokens</h2>

            {/* Countdown */}
            <div className="mb-6">
              <p className="text-gray-400 text-sm text-center mb-3">Presale ends in:</p>
              <CountdownTimer endTime={saleEndTime} />
            </div>

            {/* Current Price */}
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Current Price</span>
                <span className="text-2xl font-bold text-yellow-500">$0.008</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-400">Next Phase Price</span>
                <span className="text-gray-300">$0.01 (+25%)</span>
              </div>
            </div>

            {isConnected ? (
              <>
                {/* Whitelist Status */}
                <div
                  className={`flex items-center space-x-2 mb-4 p-3 rounded-lg ${
                    isWhitelisted ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                  }`}
                >
                  {isWhitelisted ? (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span>Your wallet is whitelisted</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5" />
                      <span>Your wallet is not whitelisted</span>
                    </>
                  )}
                </div>

                {/* Purchase Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Amount (ETH)</label>
                    <input
                      type="number"
                      value={ethAmount}
                      onChange={(e) => setEthAmount(e.target.value)}
                      placeholder="0.1"
                      min="0.1"
                      max="5"
                      step="0.1"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Min: 0.1 ETH | Max: 5 ETH</p>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">You will receive</span>
                      <span className="text-xl font-bold text-white">
                        {parseInt(tokensToReceive).toLocaleString()} TRUST
                      </span>
                    </div>
                  </div>

                  <button
                    disabled={!ethAmount || parseFloat(ethAmount) < 0.1}
                    className="w-full py-4 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Buy Tokens
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

          {/* Sale Phases */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Sale Phases</h2>

            {salePhases.map((phase, index) => (
              <div
                key={phase.name}
                className={`bg-gray-800 rounded-xl p-6 border-2 ${
                  phase.status === 'active'
                    ? 'border-yellow-500'
                    : phase.status === 'completed'
                    ? 'border-green-500/50'
                    : 'border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        phase.status === 'completed'
                          ? 'bg-green-500'
                          : phase.status === 'active'
                          ? 'bg-yellow-500'
                          : 'bg-gray-600'
                      }`}
                    >
                      {phase.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-white" />
                      ) : (
                        <span className="text-white font-bold">{index + 1}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{phase.name}</h3>
                      <span
                        className={`text-xs ${
                          phase.status === 'active'
                            ? 'text-yellow-500'
                            : phase.status === 'completed'
                            ? 'text-green-500'
                            : 'text-gray-500'
                        }`}
                      >
                        {phase.status === 'active'
                          ? 'Currently Active'
                          : phase.status === 'completed'
                          ? 'Completed'
                          : 'Coming Soon'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-yellow-500">{phase.price}</div>
                    <div className="text-xs text-gray-400">per token</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>
                      {phase.sold} / {phase.allocation}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        phase.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${phase.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Tokenomics Summary */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="font-bold mb-4">Token Allocation</h3>
              <div className="space-y-3">
                {[
                  { label: 'Liquidity Pool', value: '40%', color: 'bg-blue-500' },
                  { label: 'Voting Rewards', value: '40%', color: 'bg-yellow-500' },
                  { label: 'Airdrop', value: '5%', color: 'bg-green-500' },
                  { label: 'Development', value: '5%', color: 'bg-purple-500' },
                  { label: 'Marketing', value: '5%', color: 'bg-pink-500' },
                  { label: 'Team', value: '5%', color: 'bg-orange-500' },
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
          </div>
        </div>
      </div>
    </div>
  );
}
