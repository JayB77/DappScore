'use client';

import { useState } from 'react';
import { Zap, Wifi, WifiOff, Loader2, Search } from 'lucide-react';
import { useRugMonitor } from '@/hooks/useRugMonitor';
import { RugAlertFeed } from '@/components/RugAlertFeed';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

const STATUS_CONFIG = {
  connected:    { color: 'text-green-400',  dot: 'bg-green-400',  label: 'Live',         icon: <Wifi className="h-4 w-4" /> },
  connecting:   { color: 'text-yellow-400', dot: 'bg-yellow-400', label: 'Connecting…',  icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  disconnected: { color: 'text-gray-400',   dot: 'bg-gray-400',   label: 'Disconnected', icon: <WifiOff className="h-4 w-4" /> },
  error:        { color: 'text-red-400',    dot: 'bg-red-400',    label: 'Error',         icon: <WifiOff className="h-4 w-4" /> },
} as const;

export default function RugMonitorPage() {
  const { alerts, status, clearAlerts } = useRugMonitor();

  const [tokenAddress,    setTokenAddress]    = useState('');
  const [pairAddress,     setPairAddress]     = useState('');
  const [deployerAddress, setDeployerAddress] = useState('');
  const [explorerApiBase, setExplorerApiBase] = useState('https://api.basescan.org/api');
  const [analyzing,       setAnalyzing]       = useState(false);
  const [analyzeError,    setAnalyzeError]    = useState('');

  const cfg = STATUS_CONFIG[status];

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenAddress) return;
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const res = await fetch(`${BACKEND}/api/v1/rug-monitor/analyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tokenAddress,
          pairAddress:     pairAddress     || undefined,
          deployerAddress: deployerAddress || undefined,
          explorerApiBase: explorerApiBase || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Zap className="h-7 w-7 text-red-500" />
            <h1 className="text-2xl font-bold text-white">Rug Monitor</h1>
          </div>
          <p className="text-gray-400 text-sm">
            Real-time early warning system — detects active rug pulls as they happen
          </p>
        </div>

        {/* Connection status badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800 ${cfg.color}`}>
          <span className={`w-2 h-2 rounded-full ${cfg.dot} ${status === 'connected' ? 'animate-pulse' : ''}`} />
          {cfg.icon}
          <span className="text-sm font-medium">{cfg.label}</span>
          {status === 'connected' && (
            <span className="text-gray-500 text-xs ml-1">{alerts.length} alerts</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live feed (wider column) */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Live Alert Feed
            </h2>
            <RugAlertFeed alerts={alerts} onClear={clearAlerts} />
          </div>
        </div>

        {/* Manual analysis panel */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Search className="h-4 w-4" />
              On-Demand Analysis
            </h2>

            <form onSubmit={handleAnalyze} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Token Address *</label>
                <input
                  type="text"
                  placeholder="0x…"
                  value={tokenAddress}
                  onChange={e => setTokenAddress(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Pair Address (LP)</label>
                <input
                  type="text"
                  placeholder="0x… (Uniswap V2 pair)"
                  value={pairAddress}
                  onChange={e => setPairAddress(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Deployer Address</label>
                <input
                  type="text"
                  placeholder="0x…"
                  value={deployerAddress}
                  onChange={e => setDeployerAddress(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Explorer API Base</label>
                <input
                  type="text"
                  placeholder="https://api.basescan.org/api"
                  value={explorerApiBase}
                  onChange={e => setExplorerApiBase(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
                />
              </div>

              {analyzeError && (
                <p className="text-red-400 text-xs">{analyzeError}</p>
              )}

              <button
                type="submit"
                disabled={!tokenAddress || analyzing}
                className="w-full py-2.5 rounded-lg font-semibold text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>
                ) : (
                  <><Zap className="h-4 w-4" /> Run Analysis</>
                )}
              </button>

              <p className="text-gray-600 text-xs">
                Result broadcasts to the live feed if score ≥ 25.
              </p>
            </form>
          </div>

          {/* Score legend */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
              Score Legend
            </h2>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-white font-medium">Rug in Progress</span>
                </span>
                <span className="text-gray-400">75–100</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span className="text-white font-medium">High Risk</span>
                </span>
                <span className="text-gray-400">50–74</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <span className="text-white font-medium">Elevated Risk</span>
                </span>
                <span className="text-gray-400">25–49</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                  <span className="text-white font-medium">Low Risk</span>
                </span>
                <span className="text-gray-400">0–24</span>
              </li>
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-500 space-y-1">
              <p><span className="text-gray-300">LP Drain</span> — up to 60 pts</p>
              <p><span className="text-gray-300">Contract Events</span> — up to 60 pts</p>
              <p><span className="text-gray-300">Whale Exit</span> — coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
