'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Coins, Clock, Users, Target, Wallet, Sparkles, Shield, TrendingUp, ChevronDown, Gift, Zap } from 'lucide-react';
type PaymentMethod = 'ETH' | 'USDC' | 'USDT';

const PAYMENT_METHODS: { id: PaymentMethod; name: string }[] = [
  { id: 'ETH',  name: 'Ethereum (ETH)' },
  { id: 'USDC', name: 'USD Coin (USDC)' },
  { id: 'USDT', name: 'Tether (USDT)' },
];

type Stage = 1 | 2 | 3;

interface StageInfo {
  stage: Stage;
  name: string;
  price: number;
  discount: string;
  allocation: number;
  color: string;
}

const stages: StageInfo[] = [
  { stage: 1, name: 'Early Bird', price: 0.008, discount: '20% OFF', allocation: 166666, color: 'green' },
  { stage: 2, name: 'Growth', price: 0.009, discount: '10% OFF', allocation: 166667, color: 'blue' },
  { stage: 3, name: 'Public', price: 0.01, discount: 'Full Price', allocation: 166667, color: 'yellow' },
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
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('USDC');
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [currentStage] = useState<Stage>(1); // Will be read from contract

  const { data: ethBalance } = useBalance({ address });

  const ethPrice = 3000;
  const stageInfo = stages.find(s => s.stage === currentStage)!;

  const calculateTokens = () => {
    if (!amount || isNaN(parseFloat(amount))) return '0';
    const inputAmount = parseFloat(amount);

    if (paymentMethod === 'ETH') {
      const usdValue = inputAmount * ethPrice;
      return Math.floor(usdValue / stageInfo.price).toLocaleString();
    } else {
      return Math.floor(inputAmount / stageInfo.price).toLocaleString();
    }
  };

  const tokensToReceive = calculateTokens();
  const saleStartTime = Math.floor(Date.now() / 1000) + 86400 * 14;

  const stats = [
    { label: 'Current Price', value: `$${stageInfo.price}`, icon: Target },
    { label: 'Total For Sale', value: '500K SCORE', icon: Coins },
    { label: 'Max Per Wallet', value: '$5,000', icon: TrendingUp },
    { label: 'Min Purchase', value: '$20', icon: Clock },
  ];

  const features = [
    {
      icon: Sparkles,
      title: 'Fair Launch',
      description: 'No private sale, no VCs, no whitelist. Everyone gets equal access.',
    },
    {
      icon: Zap,
      title: '3 Stages',
      description: 'Early supporters get the best price. Prices increase each stage.',
    },
    {
      icon: Gift,
      title: 'Claim After Sale',
      description: 'Tokens are distributed after the sale ends. Everyone claims together.',
    },
    {
      icon: Shield,
      title: 'Investment Cap',
      description: '$5,000 max per wallet ensures fair distribution.',
    },
  ];

  const getMinMax = () => {
    if (paymentMethod === 'ETH') {
      return { min: (20 / ethPrice).toFixed(4), max: (5000 / ethPrice).toFixed(2) };
    }
    return { min: '20', max: '5000' };
  };

  const { min, max } = getMinMax();

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full mb-4">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Fair Launch - 3 Stages</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-yellow-500">$SCORE</span> Token Sale
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Join the DappScore community. No private rounds, no whitelist - early supporters get the best price!
          </p>
        </div>

        {/* Stage Progress */}
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h3 className="font-bold mb-4 text-center">Sale Stages</h3>
          <div className="grid grid-cols-3 gap-4">
            {stages.map((stage) => (
              <div
                key={stage.stage}
                className={`relative rounded-lg p-4 border-2 transition-all ${
                  currentStage === stage.stage
                    ? 'border-yellow-500 bg-yellow-500/10'
                    : currentStage > stage.stage
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-gray-700 bg-gray-700/30'
                }`}
              >
                {currentStage === stage.stage && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">
                    ACTIVE
                  </div>
                )}
                {currentStage > stage.stage && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                    SOLD OUT
                  </div>
                )}
                <div className="text-center">
                  <div className="text-sm text-gray-400 mb-1">Stage {stage.stage}</div>
                  <div className="font-bold text-lg mb-1">{stage.name}</div>
                  <div className="text-2xl font-bold text-yellow-500">${stage.price}</div>
                  <div className={`text-sm mt-1 ${
                    stage.discount === 'Full Price' ? 'text-gray-400' : 'text-green-400'
                  }`}>
                    {stage.discount}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {stage.allocation.toLocaleString()} SCORE
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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

            {/* Current Stage Price */}
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-gray-400 text-sm">Current Stage</span>
                  <div className="font-bold">{stageInfo.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-500">${stageInfo.price}</div>
                  {stageInfo.discount !== 'Full Price' && (
                    <span className="text-green-400 text-sm">{stageInfo.discount}</span>
                  )}
                </div>
              </div>
            </div>

            {isConnected ? (
              <>
                {/* Fair Launch Badge */}
                <div className="flex items-center space-x-2 mb-4 p-3 rounded-lg bg-green-900/30 text-green-400">
                  <Gift className="h-5 w-5" />
                  <span>Early bird pricing - get more tokens!</span>
                </div>

                {/* Payment Method Selector */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">Pay with</label>
                  <div className="relative">
                    <button
                      onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
                      disabled
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white flex items-center justify-between disabled:opacity-50"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">
                          {paymentMethod === 'ETH' ? 'Ξ' : paymentMethod === 'USDC' ? '$' : '₮'}
                        </span>
                        <span>{PAYMENT_METHODS.find(m => m.id === paymentMethod)?.name}</span>
                      </div>
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    </button>

                    {showPaymentDropdown && (
                      <div className="absolute z-10 w-full mt-2 bg-gray-700 border border-gray-600 rounded-lg overflow-hidden">
                        {PAYMENT_METHODS.map((method) => (
                          <button
                            key={method.id}
                            onClick={() => {
                              setPaymentMethod(method.id);
                              setShowPaymentDropdown(false);
                              setAmount('');
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-gray-600 flex items-center space-x-3 ${
                              paymentMethod === method.id ? 'bg-gray-600' : ''
                            }`}
                          >
                            <span className="text-xl">
                              {method.id === 'ETH' ? 'Ξ' : method.id === 'USDC' ? '$' : '₮'}
                            </span>
                            <span>{method.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Purchase Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Amount ({paymentMethod})
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={paymentMethod === 'ETH' ? '0.1' : '100'}
                      min={min}
                      max={max}
                      step={paymentMethod === 'ETH' ? '0.001' : '10'}
                      disabled
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-yellow-500 focus:outline-none disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Min: {paymentMethod === 'ETH' ? `${min} ETH` : `$${min}`} | Max: {paymentMethod === 'ETH' ? `${max} ETH` : `$${max}`}
                    </p>
                  </div>

                  {paymentMethod === 'ETH' && ethBalance && (
                    <div className="text-xs text-gray-500">
                      Your balance: {parseFloat(ethBalance.formatted).toFixed(4)} ETH
                    </div>
                  )}

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">You will receive</span>
                      <span className="text-xl font-bold text-white">
                        {tokensToReceive} SCORE
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Tokens will be claimable after the sale ends
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

          {/* Right Side */}
          <div className="space-y-6">
            {/* Features */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">How It Works</h2>
              <div className="grid grid-cols-2 gap-4">
                {features.map((feature) => (
                  <div key={feature.title} className="flex flex-col items-center text-center p-3">
                    <div className="bg-yellow-500/10 rounded-lg p-3 mb-2">
                      <feature.icon className="h-6 w-6 text-yellow-500" />
                    </div>
                    <h3 className="font-semibold text-white text-sm mb-1">{feature.title}</h3>
                    <p className="text-xs text-gray-400">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Accepted Payments */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="font-bold mb-4">Accepted Payments</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { symbol: 'Ξ', name: 'ETH', color: 'bg-blue-500/20 text-blue-400' },
                  { symbol: '$', name: 'USDC', color: 'bg-green-500/20 text-green-400' },
                  { symbol: '₮', name: 'USDT', color: 'bg-emerald-500/20 text-emerald-400' },
                ].map((payment) => (
                  <div key={payment.name} className={`${payment.color} rounded-lg p-3 text-center`}>
                    <div className="text-2xl font-bold">{payment.symbol}</div>
                    <div className="text-sm">{payment.name}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                All payments on Base network
              </p>
            </div>

            {/* Tokenomics */}
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
                  'Choose payment: ETH, USDC, or USDT',
                  'Enter amount ($20 min, $5,000 max)',
                  'Confirm the transaction',
                  'Claim tokens after sale ends!',
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
