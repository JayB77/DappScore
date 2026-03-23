'use client';

import { useState } from 'react';
import { AlertTriangle, Zap, ShieldAlert, Info, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import type { RugSignal } from '@/hooks/useRugMonitor';

const SEVERITY_CONFIG = {
  critical: {
    bg:     'bg-red-950 border-red-500',
    badge:  'bg-red-500 text-white',
    icon:   <Zap className="h-5 w-5 text-red-400" />,
    bar:    'bg-red-500',
    pulse:  true,
  },
  high: {
    bg:     'bg-orange-950 border-orange-500',
    badge:  'bg-orange-500 text-white',
    icon:   <ShieldAlert className="h-5 w-5 text-orange-400" />,
    bar:    'bg-orange-500',
    pulse:  false,
  },
  medium: {
    bg:     'bg-yellow-950 border-yellow-600',
    badge:  'bg-yellow-600 text-white',
    icon:   <AlertTriangle className="h-5 w-5 text-yellow-400" />,
    bar:    'bg-yellow-500',
    pulse:  false,
  },
  low: {
    bg:     'bg-gray-900 border-gray-700',
    badge:  'bg-gray-600 text-white',
    icon:   <Info className="h-5 w-5 text-gray-400" />,
    bar:    'bg-gray-500',
    pulse:  false,
  },
} as const;

function timeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60)   return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function EvtSeverityDot({ sev }: { sev: RugSignal['events'][0]['severity'] }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-500',
    high:     'bg-orange-500',
    medium:   'bg-yellow-500',
    info:     'bg-gray-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full mr-2 ${colors[sev] ?? 'bg-gray-500'}`} />;
}

function RugAlertCard({ signal }: { signal: RugSignal }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[signal.severity];

  return (
    <div className={`border rounded-lg p-4 transition-all ${cfg.bg} ${cfg.pulse ? 'animate-pulse-subtle' : ''}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {cfg.icon}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                {signal.label.toUpperCase()}
              </span>
              <span className="text-white font-mono text-sm">
                {shortAddr(signal.tokenAddress)}
              </span>
            </div>
            <div className="text-gray-400 text-xs mt-1">
              {timeAgo(signal.detectedAt)} · Chain {signal.chainId}
            </div>
          </div>
        </div>

        {/* Score gauge */}
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-bold text-white">{signal.score}</div>
          <div className="text-gray-500 text-xs">/ 100</div>
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${cfg.bar}`}
          style={{ width: `${signal.score}%` }}
        />
      </div>

      {/* Signal breakdown */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
        <div className="bg-gray-900/60 rounded p-2">
          <div className="text-gray-400">LP Drain</div>
          <div className="font-bold text-white">{signal.signals.lpDrain}</div>
        </div>
        <div className="bg-gray-900/60 rounded p-2">
          <div className="text-gray-400">Contract</div>
          <div className="font-bold text-white">{signal.signals.contractEvents}</div>
        </div>
        <div className="bg-gray-900/60 rounded p-2">
          <div className="text-gray-400">Whales</div>
          <div className="font-bold text-white">{signal.signals.whaleExit}</div>
        </div>
      </div>

      {/* Expandable events */}
      {signal.events.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {signal.events.length} signal{signal.events.length !== 1 ? 's' : ''}
          </button>

          {expanded && (
            <ul className="mt-2 space-y-1">
              {signal.events.map((e, i) => (
                <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                  <EvtSeverityDot sev={e.severity} />
                  <span className="flex-1">{e.description}</span>
                  {e.txHash && (
                    <a
                      href={`https://basescan.org/tx/${e.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface RugAlertFeedProps {
  alerts: RugSignal[];
  onClear?: () => void;
}

export function RugAlertFeed({ alerts, onClear }: RugAlertFeedProps) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');

  const filtered = alerts.filter(a =>
    filter === 'all' ? true : a.severity === filter,
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {(['all', 'critical', 'high', 'medium'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {onClear && alerts.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Clear feed
          </button>
        )}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No alerts in feed — monitoring active</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(signal => (
            <RugAlertCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}
