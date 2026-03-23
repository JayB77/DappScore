'use client';

import { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InsightLevel = 'safe' | 'caution' | 'warning' | 'critical';

export interface Insight {
  level: InsightLevel;
  text: string;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const LEVEL_ORDER: InsightLevel[] = ['safe', 'caution', 'warning', 'critical'];

export const LEVEL_STYLES: Record<InsightLevel, {
  bg: string; border: string; text: string; dot: string; label: string;
}> = {
  safe:     { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  dot: 'bg-green-400',  label: 'LOW RISK' },
  caution:  { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400', label: 'CAUTION' },
  warning:  { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400', label: 'WARNING' },
  critical: { bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-400',    dot: 'bg-red-400',    label: 'HIGH RISK' },
};

export function worstLevel(insights: Insight[]): InsightLevel {
  return insights.reduce<InsightLevel>(
    (worst, { level }) =>
      LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(worst) ? level : worst,
    'safe',
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  insights: Insight[];
  /** Extra Tailwind classes on the wrapper */
  className?: string;
}

/**
 * A collapsible "Plain English" callout appended to any panel.
 * Computes its header colour from the worst insight level supplied.
 *
 * Usage:
 *   <SectionInsight
 *     insights={[
 *       { level: 'critical', text: 'HONEYPOT: funds are permanently locked in.' },
 *       { level: 'warning',  text: 'Sell tax is 15% — you lose $150 on every $1,000 sold.' },
 *     ]}
 *     className="mt-3"
 *   />
 */
export default function SectionInsight({ insights, className = '' }: Props) {
  const [open, setOpen] = useState(false);

  if (insights.length === 0) return null;

  const worst  = worstLevel(insights);
  const styles = LEVEL_STYLES[worst];

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} overflow-hidden ${className}`}>
      {/* ── Clickable header bar ───────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2.5 text-left ${styles.text} hover:opacity-80 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Plain English — {styles.label}
          </span>
        </div>
        {open
          ? <ChevronUp   className="h-3 w-3 flex-shrink-0" />
          : <ChevronDown className="h-3 w-3 flex-shrink-0" />
        }
      </button>

      {/* ── Expanded bullet list ───────────────────────────────────────────── */}
      {open && (
        <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-gray-700/40">
          {insights.map((insight, i) => {
            const s = LEVEL_STYLES[insight.level];
            return (
              <div key={i} className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                <p className={`text-sm leading-relaxed ${s.text}`}>{insight.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
