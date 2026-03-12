'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';
const POLL_INTERVAL_MS = 30_000;

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'unknown';

interface ServiceCheck {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  note?: string;
}

interface StatusResponse {
  overall: ServiceStatus;
  services: ServiceCheck[];
  checkedAt: string;
}

function StatusDot({ status }: { status: ServiceStatus }) {
  if (status === 'operational') return <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />;
  if (status === 'degraded')    return <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />;
  if (status === 'down')        return <XCircle className="h-5 w-5 text-red-400 shrink-0" />;
  return <div className="h-5 w-5 rounded-full bg-gray-600 shrink-0" />;
}

function statusLabel(s: ServiceStatus) {
  if (s === 'operational') return 'Operational';
  if (s === 'degraded')    return 'Degraded';
  if (s === 'down')        return 'Down';
  return 'Unknown';
}

function statusColor(s: ServiceStatus) {
  if (s === 'operational') return 'text-green-400';
  if (s === 'degraded')    return 'text-yellow-400';
  if (s === 'down')        return 'text-red-400';
  return 'text-gray-400';
}

function overallBanner(s: ServiceStatus) {
  if (s === 'operational') return {
    bg: 'bg-green-500/10 border-green-500/30',
    text: 'text-green-400',
    message: 'All systems operational',
  };
  if (s === 'degraded') return {
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    text: 'text-yellow-400',
    message: 'Partial outage — some services degraded',
  };
  return {
    bg: 'bg-red-500/10 border-red-500/30',
    text: 'text-red-400',
    message: 'Service disruption detected',
  };
}

export default function StatusPage() {
  const [data, setData]         = useState<StatusResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const [spinning, setSpinning] = useState(false);

  const poll = useCallback(async (manual = false) => {
    if (manual) setSpinning(true);
    try {
      const res = await fetch(`${API_BASE}/v1/status`);
      if (res.ok) {
        setData(await res.json());
        setLastPoll(new Date());
      }
    } finally {
      setLoading(false);
      if (manual) setTimeout(() => setSpinning(false), 600);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(() => {
      if (!document.hidden) poll();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const banner = data ? overallBanner(data.overall) : null;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <Activity className="h-7 w-7 text-yellow-500" />
            <div>
              <h1 className="text-2xl font-bold">System Status</h1>
              <p className="text-sm text-gray-400">Real-time service health</p>
            </div>
          </div>
          <button
            onClick={() => poll(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Overall banner */}
        {loading ? (
          <div className="h-16 bg-gray-800 rounded-xl animate-pulse mb-8" />
        ) : banner && data ? (
          <div className={`border rounded-xl px-6 py-4 mb-8 ${banner.bg}`}>
            <div className="flex items-center justify-between">
              <span className={`font-semibold text-lg ${banner.text}`}>{banner.message}</span>
              <StatusDot status={data.overall} />
            </div>
          </div>
        ) : null}

        {/* Service rows */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4">
                <div className="h-4 w-28 bg-gray-800 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
              </div>
            ))
          ) : data?.services.map(svc => (
            <div key={svc.name} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <StatusDot status={svc.status} />
                <span className="font-medium">{svc.name}</span>
                {svc.note && <span className="text-xs text-gray-500">({svc.note})</span>}
              </div>
              <div className="flex items-center gap-4 text-sm">
                {svc.latencyMs !== undefined && (
                  <span className="text-gray-500 font-mono">{svc.latencyMs}ms</span>
                )}
                <span className={`font-medium ${statusColor(svc.status)}`}>
                  {statusLabel(svc.status)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Last checked */}
        <p className="text-center text-xs text-gray-600 mt-6">
          {lastPoll
            ? `Last checked ${lastPoll.toLocaleTimeString()} · Auto-refreshes every 30s`
            : 'Checking…'}
        </p>
      </div>
    </main>
  );
}
