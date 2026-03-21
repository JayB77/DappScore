/**
 * Rug-in-Progress Detector
 *
 * Combines three real-time signal sources into a single composite Rug Score
 * (0–100) and broadcasts critical alerts via an EventEmitter that the
 * WebSocket server in index.ts listens to.
 *
 *   Signal 1 — LP Drain         (lp-monitor.ts)   up to 60 pts
 *   Signal 2 — Contract Events  (event-monitor.ts) up to 60 pts
 *   Final score = min(100, signal1 + signal2)
 *
 * Thresholds:
 *   0–24   Low Risk
 *   25–49  Elevated Risk
 *   50–74  High Risk
 *   75–100 Rug in Progress  ← triggers WS broadcast + alert delivery
 */

import EventEmitter from 'events';
import { detectLpMovements } from './lp-monitor';
import { monitorContractEvents } from './event-monitor';
import { logger } from './logger';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RugEvent {
  type: string;
  severity: 'info' | 'medium' | 'high' | 'critical';
  description: string;
  txHash?: string;
  /** Unix seconds (approximate for on-chain events where we have block not timestamp) */
  timestamp: number;
  /** How many points this event contributed to the score */
  contribution: number;
}

export interface RugSignal {
  /** Unique alert ID — `<tokenAddress>-<timestamp>` */
  id: string;
  tokenAddress: string;
  pairAddress?: string;
  deployerAddress?: string;
  chainId: number;
  /** Composite score 0–100 */
  score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable severity label */
  label: string;
  /** Per-signal score breakdowns */
  signals: {
    lpDrain: number;
    contractEvents: number;
    whaleExit: number;
  };
  /** Ordered list of contributing events (most-recent first) */
  events: RugEvent[];
  detectedAt: number;
}

// ── In-memory ring buffer (last 50 alerts with score ≥ 25) ───────────────────

const RING_SIZE = 50;
const recentAlerts: RugSignal[] = [];

// ── Event emitter — index.ts attaches a WS broadcast listener ────────────────

export const rugDetectorEvents = new EventEmitter();

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreToLabel(score: number): { severity: RugSignal['severity']; label: string } {
  if (score >= 75) return { severity: 'critical', label: 'Rug in Progress' };
  if (score >= 50) return { severity: 'high',     label: 'High Risk'        };
  if (score >= 25) return { severity: 'medium',   label: 'Elevated Risk'    };
  return             { severity: 'low',      label: 'Low Risk'         };
}

// ── Core analysis function ────────────────────────────────────────────────────

export interface AnalyzeParams {
  tokenAddress: string;
  pairAddress?: string;
  deployerAddress?: string;
  /** Etherscan-compatible block explorer API base URL */
  explorerApiBase?: string;
  chainId?: number;
  network?: 'mainnet' | 'testnet';
}

export async function analyzeForRug(params: AnalyzeParams): Promise<RugSignal> {
  const {
    tokenAddress,
    pairAddress,
    deployerAddress,
    explorerApiBase,
    chainId = 8453,
    network = 'mainnet',
  } = params;

  const events: RugEvent[] = [];
  let lpDrainScore      = 0;
  let contractEvtScore  = 0;

  // ── Signal 1: LP drain ─────────────────────────────────────────────────────
  if (pairAddress && deployerAddress && explorerApiBase) {
    try {
      // Tight 1-day window — we want fresh signals, not historical noise
      const lp = await detectLpMovements(explorerApiBase, pairAddress, deployerAddress, 1);

      for (const alert of lp.alerts) {
        let contribution = 0;
        if (alert.type === 'lp-to-deployer') contribution = 40;
        else if (alert.type === 'early-unlock') contribution = 35;
        else if (alert.type === 'lp-burn')    contribution = 10;

        lpDrainScore = Math.min(60, lpDrainScore + contribution);

        events.push({
          type:         alert.type,
          severity:     alert.severity === 'danger' ? 'high' : 'medium',
          description:  alert.description,
          txHash:       alert.txHash,
          timestamp:    alert.timestamp,
          contribution,
        });
      }
    } catch (err) {
      logger.warn('[RugDetector] LP analysis failed:', err as Error);
    }
  }

  // ── Signal 2: Contract events (last ~1 h on Base = 300 blocks) ────────────
  try {
    const evts = await monitorContractEvents(tokenAddress, pairAddress, network, 300);
    contractEvtScore = Math.min(60, evts.riskScore);

    for (const e of evts.events) {
      if (e.severity === 'info') continue;
      events.push({
        type:         e.type,
        severity:     e.severity,
        description:  e.description,
        txHash:       e.transactionHash || undefined,
        timestamp:    Math.floor(Date.now() / 1000), // approx — block ts unavailable here
        contribution: contractEvtScore,
      });
    }
  } catch (err) {
    logger.warn('[RugDetector] Event monitor failed:', err as Error);
  }

  const rawScore = Math.min(100, lpDrainScore + contractEvtScore);
  const { severity, label } = scoreToLabel(rawScore);

  return {
    id:              `${tokenAddress.toLowerCase()}-${Date.now()}`,
    tokenAddress:    tokenAddress.toLowerCase(),
    pairAddress:     pairAddress?.toLowerCase(),
    deployerAddress: deployerAddress?.toLowerCase(),
    chainId,
    score:    rawScore,
    severity,
    label,
    signals: {
      lpDrain:        lpDrainScore,
      contractEvents: contractEvtScore,
      whaleExit:      0, // future: integrate whale-tracking dump signal
    },
    events: events.sort((a, b) => b.timestamp - a.timestamp),
    detectedAt: Date.now(),
  };
}

// ── Run analysis, persist to ring buffer, and emit if notable ─────────────────

export async function runAndBroadcast(params: AnalyzeParams): Promise<RugSignal> {
  const signal = await analyzeForRug(params);

  if (signal.score >= 25) {
    recentAlerts.unshift(signal);
    if (recentAlerts.length > RING_SIZE) recentAlerts.pop();
    rugDetectorEvents.emit('rug_alert', signal);
  }

  return signal;
}

export function getRecentAlerts(limit = 50): RugSignal[] {
  return recentAlerts.slice(0, Math.min(limit, RING_SIZE));
}
