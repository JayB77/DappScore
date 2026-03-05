'use client';

import { useMemo } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { computeScore, type ProjectSignals, type CompositeScore } from '@/lib/useProjectSignals';

// ── Grade styling ─────────────────────────────────────────────────────────────

const GRADE_STYLE: Record<
  CompositeScore['grade'],
  { ring: string; text: string; bg: string; label: string }
> = {
  S: { ring: 'ring-green-400',  text: 'text-green-400',  bg: 'bg-green-400/10',  label: 'Excellent' },
  A: { ring: 'ring-green-500',  text: 'text-green-500',  bg: 'bg-green-500/10',  label: 'Good' },
  B: { ring: 'ring-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Moderate Risk' },
  C: { ring: 'ring-orange-400', text: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Elevated Risk' },
  D: { ring: 'ring-red-500',    text: 'text-red-500',    bg: 'bg-red-500/10',    label: 'High Risk' },
  F: { ring: 'ring-red-600',    text: 'text-red-600',    bg: 'bg-red-600/10',    label: 'Critical Risk' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function barColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.8) return 'bg-green-500';
  if (pct >= 0.5) return 'bg-yellow-500';
  if (pct >= 0.25) return 'bg-orange-500';
  return 'bg-red-500';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  signals: ProjectSignals;
  project: {
    upvotes: number;
    downvotes: number;
    team?: unknown[];
    whitepaperUrl?: string;
    socialLinks?: Record<string, string>;
  };
}

export default function DappScorePanel({ signals, project }: Props) {
  const score = useMemo(() => computeScore(signals, project), [signals, project]);
  const style = GRADE_STYLE[score.grade];

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">DappScore</h3>
        <TrendingUp className="h-4 w-4 text-gray-500" />
      </div>

      {/* Score ring */}
      <div className="flex items-center space-x-4 mb-5">
        <div
          className={`relative flex-shrink-0 w-20 h-20 rounded-full ring-4 ${style.ring} ${style.bg} flex flex-col items-center justify-center`}
        >
          <span className={`text-2xl font-black leading-none ${style.text}`}>
            {score.isReady ? score.total : '—'}
          </span>
          <span className="text-xs text-gray-500 mt-0.5">/ 100</span>
          {!score.isReady && (
            <Loader2 className="absolute top-1 right-1 h-3 w-3 animate-spin text-gray-500" />
          )}
        </div>

        <div>
          <div className={`text-2xl font-black ${style.text}`}>{score.grade}</div>
          <div className="text-sm text-gray-400">{style.label}</div>
          {!score.isReady && (
            <div className="text-xs text-gray-500 mt-1">Updating…</div>
          )}
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-3">
        {score.breakdown.map((b) => (
          <div key={b.label}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-gray-400">{b.label}</span>
              <span className="text-xs text-gray-500">{b.detail}</span>
            </div>
            <div className="bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor(b.score, b.max)}`}
                style={{ width: `${(b.score / b.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Score updates live as signals resolve · Not financial advice
      </p>
    </div>
  );
}
