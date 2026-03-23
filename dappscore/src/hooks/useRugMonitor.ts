'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface RugEvent {
  type: string;
  severity: 'info' | 'medium' | 'high' | 'critical';
  description: string;
  txHash?: string;
  timestamp: number;
  contribution: number;
}

export interface RugSignal {
  id: string;
  tokenAddress: string;
  pairAddress?: string;
  deployerAddress?: string;
  chainId: number;
  score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  signals: {
    lpDrain: number;
    contractEvents: number;
    whaleExit: number;
  };
  events: RugEvent[];
  detectedAt: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const MAX_FEED_SIZE = 50;
const RECONNECT_DELAY_MS = 3_000;

function deriveWsUrl(): string {
  const backend =
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3001';
  return backend.replace(/^http/, 'ws') + '/ws';
}

export function useRugMonitor() {
  const [alerts, setAlerts]       = useState<RugSignal[]>([]);
  const [status, setStatus]       = useState<ConnectionStatus>('connecting');
  const [lastAlert, setLastAlert] = useState<RugSignal | null>(null);
  const wsRef    = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    setStatus('connecting');

    const ws = new WebSocket(deriveWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus('connected');
    };

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(evt.data as string);
        if (msg.type === 'rug_alert' && msg.signal) {
          const signal: RugSignal = msg.signal;
          setLastAlert(signal);
          setAlerts(prev => {
            const next = [signal, ...prev.filter(a => a.id !== signal.id)];
            return next.slice(0, MAX_FEED_SIZE);
          });
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setStatus('error');
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      timerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connect]);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  return { alerts, status, lastAlert, clearAlerts };
}
