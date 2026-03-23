'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCheck, AlertTriangle, Info, AlertCircle, Zap } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';
const POLL_INTERVAL_MS = 30_000;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
  createdAt: { seconds: number } | string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_ICON = {
  low:      <Info      className="h-4 w-4 text-blue-400   shrink-0" />,
  medium:   <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />,
  high:     <AlertCircle   className="h-4 w-4 text-orange-400 shrink-0" />,
  critical: <Zap           className="h-4 w-4 text-red-400    shrink-0" />,
};

const SEVERITY_DOT: Record<string, string> = {
  low:      'bg-blue-400',
  medium:   'bg-yellow-400',
  high:     'bg-orange-400',
  critical: 'bg-red-400',
};

function timeAgo(ts: Alert['createdAt']): string {
  const secs = typeof ts === 'string'
    ? Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    : Math.floor(Date.now() / 1000 - ts.seconds);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AlertsBell({ walletAddress }: { walletAddress: string }) {
  const [unread, setUnread]     = useState(0);
  const [open, setOpen]         = useState(false);
  const [alerts, setAlerts]     = useState<Alert[]>([]);
  const [loading, setLoading]   = useState(false);
  const dropdownRef             = useRef<HTMLDivElement>(null);

  const headers = { 'x-user-id': walletAddress };

  // ── Poll unread count ──────────────────────────────────────────────────────

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/alerts/unread-count`, { headers });
      if (!res.ok) return;
      const json = await res.json();
      setUnread(json.data?.count ?? 0);
    } catch { /* silent */ }
  }, [walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  // ── Load alerts on open ────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`${API_BASE}/alerts?limit=15`, { headers })
      .then(r => r.json())
      .then(json => setAlerts(json.data?.alerts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close on outside click ─────────────────────────────────────────────────

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function markAllRead() {
    await fetch(`${API_BASE}/alerts/read-all`, { method: 'POST', headers });
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    setUnread(0);
  }

  async function markRead(alertId: string) {
    await fetch(`${API_BASE}/alerts/${alertId}/read`, { method: 'POST', headers });
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    setUnread(prev => Math.max(0, prev - 1));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
        aria-label="Alerts"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="font-semibold text-sm">Alerts</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Alert list */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-800">
            {loading && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">Loading…</div>
            )}
            {!loading && alerts.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No alerts yet</p>
              </div>
            )}
            {!loading && alerts.map(alert => (
              <button
                key={alert.id}
                onClick={() => !alert.read && markRead(alert.id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors ${alert.read ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {SEVERITY_ICON[alert.severity] ?? SEVERITY_ICON.low}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{alert.title}</p>
                      {!alert.read && (
                        <span className={`shrink-0 w-2 h-2 rounded-full ${SEVERITY_DOT[alert.severity] ?? 'bg-gray-400'}`} />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{alert.message}</p>
                    <p className="text-xs text-gray-600 mt-1">{timeAgo(alert.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-800 text-center">
              <a
                href="/dashboard"
                className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors"
              >
                View all in Dashboard →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
