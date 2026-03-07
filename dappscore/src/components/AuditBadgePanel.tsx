'use client';

import { ExternalLink, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';
import type { AuditRecord } from '@/components/ProjectCard';

// ── Firm styling ──────────────────────────────────────────────────────────────

const FIRM_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'CertiK':               { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/30'   },
  'Hacken':               { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',   border: 'border-cyan-500/30'   },
  'OpenZeppelin':         { bg: 'bg-indigo-500/10',  text: 'text-indigo-400', border: 'border-indigo-500/30' },
  'Code4rena':            { bg: 'bg-yellow-500/10',  text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'Sherlock':             { bg: 'bg-gray-500/10',    text: 'text-gray-300',   border: 'border-gray-500/30'   },
  'Quantstamp':           { bg: 'bg-purple-500/10',  text: 'text-purple-400', border: 'border-purple-500/30' },
  'Trail of Bits':        { bg: 'bg-orange-500/10',  text: 'text-orange-400', border: 'border-orange-500/30' },
  'PeckShield':           { bg: 'bg-teal-500/10',    text: 'text-teal-400',   border: 'border-teal-500/30'   },
  'SlowMist':             { bg: 'bg-red-500/10',     text: 'text-red-400',    border: 'border-red-500/30'    },
  'Spearbit':             { bg: 'bg-sky-500/10',     text: 'text-sky-400',    border: 'border-sky-500/30'    },
  'Consensys Diligence':  { bg: 'bg-amber-500/10',   text: 'text-amber-400',  border: 'border-amber-500/30'  },
  'Immunefi':             { bg: 'bg-green-500/10',   text: 'text-green-400',  border: 'border-green-500/30'  },
};

const DEFAULT_STYLE = { bg: 'bg-gray-600/10', text: 'text-gray-400', border: 'border-gray-600/30' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  // Accepts "2024-06" or "2024-06-15"
  const parts = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (parts.length >= 2) {
    const m = parseInt(parts[1], 10) - 1;
    return `${months[m] ?? ''} ${parts[0]}`;
  }
  return iso;
}

function findingsColor(findings: AuditRecord['findings']): string {
  if (!findings) return 'text-gray-500';
  if ((findings.critical ?? 0) > 0) return 'text-red-400';
  if ((findings.high ?? 0) > 0)     return 'text-orange-400';
  if ((findings.medium ?? 0) > 0)   return 'text-yellow-400';
  return 'text-green-400';
}

function FindingsPill({
  label, count, color,
}: { label: string; count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span className={`text-xs font-medium ${color}`}>
      {count} {label}
    </span>
  );
}

// ── Single audit card ─────────────────────────────────────────────────────────

function AuditCard({ audit }: { audit: AuditRecord }) {
  const style = FIRM_STYLES[audit.firm] ?? DEFAULT_STYLE;
  const fc = audit.findings;
  const noHighFindings = !fc || ((fc.critical ?? 0) + (fc.high ?? 0) === 0);
  const StatusIcon = noHighFindings ? ShieldCheck : ShieldAlert;

  return (
    <div className={`flex flex-col gap-2 border ${style.border} ${style.bg} rounded-lg p-3`}>
      {/* Row 1: firm + date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <StatusIcon className={`h-4 w-4 flex-shrink-0 ${noHighFindings ? 'text-green-400' : 'text-orange-400'}`} />
          <span className={`text-sm font-semibold ${style.text}`}>{audit.firm}</span>
        </div>
        <span className="text-xs text-gray-500">{fmtDate(audit.date)}</span>
      </div>

      {/* Row 2: CertiK score + findings summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {audit.score !== undefined && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              audit.score >= 85 ? 'bg-green-500/20 text-green-400'
              : audit.score >= 70 ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-red-500/20 text-red-400'
            }`}>
              Score {audit.score}
            </span>
          )}
          {fc ? (
            <div className="flex items-center gap-1.5">
              {(fc.critical ?? 0) > 0 && (
                <FindingsPill label="critical" count={fc.critical!} color="text-red-400" />
              )}
              {(fc.high ?? 0) > 0 && (
                <FindingsPill label="high" count={fc.high!} color="text-orange-400" />
              )}
              {(fc.medium ?? 0) > 0 && (
                <FindingsPill label="med" count={fc.medium!} color="text-yellow-400" />
              )}
              {(fc.low ?? 0) > 0 && (
                <FindingsPill label="low" count={fc.low!} color="text-gray-400" />
              )}
              {(fc.critical ?? 0) + (fc.high ?? 0) === 0 && (
                <span className="text-xs text-green-400">No critical/high findings</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-500">Findings not disclosed</span>
          )}
        </div>

        {/* Report link */}
        <a
          href={audit.reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <span>Report</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  audits?: AuditRecord[];
}

export default function AuditBadgePanel({ audits }: Props) {
  const enabled = useFeatureFlag('auditBadge', false);
  if (!enabled) return null;

  const hasAudits = audits && audits.length > 0;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Shield className="h-4 w-4 text-gray-400" />
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">Security Audits</h3>
        {hasAudits && (
          <span className="ml-auto text-xs text-gray-500">{audits.length} audit{audits.length > 1 ? 's' : ''} on record</span>
        )}
      </div>

      {hasAudits ? (
        <div className="space-y-2">
          {audits.map((a, i) => (
            <AuditCard key={`${a.firm}-${i}`} audit={a} />
          ))}
        </div>
      ) : (
        <div className="flex items-center space-x-2 text-sm text-gray-500 py-2">
          <ShieldAlert className="h-4 w-4 text-orange-400 flex-shrink-0" />
          <span>No audits on record — exercise caution</span>
        </div>
      )}

      <p className="text-xs text-gray-600 mt-4">Audit records manually curated · Always verify reports independently</p>
    </div>
  );
}
