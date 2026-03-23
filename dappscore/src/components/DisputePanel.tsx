'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Scale, ThumbsUp, ThumbsDown, Loader2, CheckCircle,
  XCircle, Clock, AlertTriangle, Plus, ChevronDown,
  ChevronUp, Trash2,
} from 'lucide-react';
import { useFeatureFlag } from '@/lib/featureFlags';

// ── Types ─────────────────────────────────────────────────────────────────────

type DisputeStatus = 'pending' | 'under_review' | 'upheld' | 'rejected' | 'withdrawn';
type DisputeCategory = 'false_flag' | 'stale_data' | 'wrong_score' | 'other';

interface Dispute {
  id: number;
  project_id: string;
  submitter: string;
  category: DisputeCategory;
  description: string;
  evidence_urls: string[];
  status: DisputeStatus;
  votes_for: number;
  votes_against: number;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface Props {
  projectId: string;
  /**
   * Trust level — string name (e.g. "Suspicious") or numeric index
   * (3=Suspicious, 4=SuspectedScam, 5=ProbableScam).
   */
  trustLevel?: string | number;
}

const TRUST_LEVEL_NUMERIC: Record<string, number> = {
  NewListing: 0, Trusted: 1, Neutral: 2,
  Suspicious: 3, SuspectedScam: 4, ProbableScam: 5,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<DisputeCategory, string> = {
  false_flag:  'Automated flag is incorrect',
  stale_data:  'Data shown is outdated',
  wrong_score: 'Trust score is unfair',
  other:       'Other reason',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30)  return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DisputeStatus }) {
  const configs: Record<DisputeStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    pending:      { label: 'Pending review',  cls: 'bg-yellow-500/20 text-yellow-400',  icon: <Clock className="h-3 w-3" /> },
    under_review: { label: 'Under review',    cls: 'bg-blue-500/20 text-blue-400',      icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    upheld:       { label: 'Upheld — flag cleared', cls: 'bg-green-500/20 text-green-400', icon: <CheckCircle className="h-3 w-3" /> },
    rejected:     { label: 'Dismissed',       cls: 'bg-red-500/20 text-red-400',        icon: <XCircle className="h-3 w-3" /> },
    withdrawn:    { label: 'Withdrawn',       cls: 'bg-gray-600/30 text-gray-500',      icon: <Trash2 className="h-3 w-3" /> },
  };

  const c = configs[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${c.cls}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ── Vote bar ──────────────────────────────────────────────────────────────────

function VoteBar({ votesFor, votesAgainst }: { votesFor: number; votesAgainst: number }) {
  const total = votesFor + votesAgainst;
  if (total === 0) return <p className="text-xs text-gray-600">No community votes yet</p>;
  const forPct = Math.round((votesFor / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{votesFor} support</span>
        <span>{votesAgainst} oppose</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${forPct}%` }}
        />
      </div>
    </div>
  );
}

// ── Dispute card ──────────────────────────────────────────────────────────────

function DisputeCard({
  dispute,
  walletAddress,
  onVote,
  onWithdraw,
}: {
  dispute: Dispute;
  walletAddress: string | undefined;
  onVote: (id: number, support: boolean) => Promise<void>;
  onWithdraw: (id: number) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [voting, setVoting] = useState<'for' | 'against' | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  const isOpen     = dispute.status === 'pending' || dispute.status === 'under_review';
  const isOwner    = walletAddress?.toLowerCase() === dispute.submitter.toLowerCase();
  const canWithdraw = isOwner && dispute.status === 'pending';
  const canVote    = isOpen && !isOwner && !!walletAddress;

  async function handleVote(support: boolean) {
    setVoting(support ? 'for' : 'against');
    setVoteError(null);
    try {
      await onVote(dispute.id, support);
    } catch (e) {
      setVoteError(e instanceof Error ? e.message : 'Vote failed');
    } finally {
      setVoting(null);
    }
  }

  async function handleWithdraw() {
    setWithdrawing(true);
    try {
      await onWithdraw(dispute.id);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="border border-gray-700 rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <StatusBadge status={dispute.status} />
          <p className="text-xs text-gray-500">
            {CATEGORY_LABELS[dispute.category]} · {fmtRelative(dispute.created_at)}
          </p>
        </div>
        {canWithdraw && (
          <button
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors"
            title="Withdraw dispute"
          >
            {withdrawing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        )}
      </div>

      {/* Description (collapsed by default for long text) */}
      <div>
        <p className={`text-sm text-gray-300 ${!expanded && 'line-clamp-3'}`}>
          {dispute.description}
        </p>
        {dispute.description.length > 180 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-0.5 text-xs text-gray-600 hover:text-gray-400 mt-0.5 transition-colors"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
          </button>
        )}
      </div>

      {/* Evidence links */}
      {expanded && dispute.evidence_urls.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Evidence</p>
          {dispute.evidence_urls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-blue-400 hover:text-blue-300 truncate transition-colors"
            >
              {url}
            </a>
          ))}
        </div>
      )}

      {/* Community vote bar */}
      {isOpen && (
        <VoteBar votesFor={dispute.votes_for} votesAgainst={dispute.votes_against} />
      )}

      {/* Vote actions */}
      {canVote && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => handleVote(true)}
            disabled={!!voting}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
          >
            {voting === 'for' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
            Flag is wrong
          </button>
          <button
            onClick={() => handleVote(false)}
            disabled={!!voting}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
          >
            {voting === 'against' ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
            Flag is correct
          </button>
          {voteError && <span className="text-xs text-red-400">{voteError}</span>}
        </div>
      )}

      {/* Admin resolution notes */}
      {dispute.admin_notes && (
        <div className="bg-gray-700/40 rounded px-2.5 py-2 space-y-0.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reviewer notes</p>
          <p className="text-sm text-gray-300">{dispute.admin_notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Submit form ───────────────────────────────────────────────────────────────

function SubmitForm({
  projectId,
  walletAddress,
  onSuccess,
  onCancel,
}: {
  projectId: string;
  walletAddress: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<DisputeCategory>('false_flag');
  const [description, setDescription] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleUrlChange(i: number, val: string) {
    setEvidenceUrls(prev => prev.map((u, idx) => idx === i ? val : u));
  }

  function addUrlField() {
    if (evidenceUrls.length < 5) setEvidenceUrls(prev => [...prev, '']);
  }

  function removeUrlField(i: number) {
    setEvidenceUrls(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validUrls = evidenceUrls.filter(u => u.trim().startsWith('http'));

    if (description.trim().length < 30) {
      setError('Please provide at least 30 characters of explanation.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/v1/disputes/project/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': walletAddress,
        },
        body: JSON.stringify({ category, description: description.trim(), evidenceUrls: validUrls }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Submission failed. Please try again.');
        return;
      }

      onSuccess();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border border-gray-700 rounded-lg p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">File a dispute</p>

      {/* Category */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">What needs to be corrected?</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as DisputeCategory)}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-yellow-500 focus:outline-none"
        >
          {(Object.entries(CATEGORY_LABELS) as [DisputeCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Explanation <span className="text-gray-600">({description.length}/2000)</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value.slice(0, 2000))}
          placeholder="Describe why this flag or score is incorrect. Be specific — reference your smart contract source code, audit reports, or other verifiable facts."
          rows={4}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-yellow-500 focus:outline-none resize-none"
        />
      </div>

      {/* Evidence URLs */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Supporting links (optional)</label>
        <div className="space-y-1.5">
          {evidenceUrls.map((url, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                type="url"
                value={url}
                onChange={e => handleUrlChange(i, e.target.value)}
                placeholder="https://…"
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:border-yellow-500 focus:outline-none"
              />
              {evidenceUrls.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeUrlField(i)}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {evidenceUrls.length < 5 && (
            <button
              type="button"
              onClick={addUrlField}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add link
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2.5 py-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Submit dispute
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-gray-400 hover:text-gray-200 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-gray-600">
        Our team reviews all disputes within 72 hours. Community votes are advisory —
        final decisions are made by DappScore reviewers.
      </p>
    </form>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function DisputePanel({ projectId, trustLevel }: Props) {
  const enabled = useFeatureFlag('disputePanel', true);
  const { address } = useAccount();

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll]   = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const walletAddress = address?.toLowerCase();

  // Normalise trustLevel to a number and flag when >= 3 (Suspicious / SuspectedScam / ProbableScam)
  const trustLevelNum = typeof trustLevel === 'number'
    ? trustLevel
    : typeof trustLevel === 'string'
      ? (TRUST_LEVEL_NUMERIC[trustLevel] ?? -1)
      : -1;
  const isFlagged = trustLevelNum >= 3;

  async function loadDisputes() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_BASE}/v1/disputes/project/${projectId}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setDisputes(data.data?.disputes ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDisputes(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeDispute = disputes.find(
    d => d.status === 'pending' || d.status === 'under_review',
  );
  const hasOpenDispute = !!activeDispute;

  async function handleVote(disputeId: number, support: boolean) {
    if (!walletAddress) return;
    const res = await fetch(`${API_BASE}/v1/disputes/${disputeId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': walletAddress },
      body: JSON.stringify({ support }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Vote failed');
    // Update vote counts in place
    setDisputes(prev => prev.map(d =>
      d.id === disputeId
        ? { ...d, votes_for: data.data.votes_for, votes_against: data.data.votes_against }
        : d,
    ));
  }

  async function handleWithdraw(disputeId: number) {
    if (!walletAddress) return;
    const res = await fetch(`${API_BASE}/v1/disputes/${disputeId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': walletAddress },
    });
    if (res.ok) {
      setDisputes(prev => prev.map(d =>
        d.id === disputeId ? { ...d, status: 'withdrawn' } : d,
      ));
    }
  }

  function handleSubmitSuccess() {
    setShowForm(false);
    setSuccessMsg('Your dispute has been submitted. We\'ll review it within 72 hours.');
    loadDisputes();
    setTimeout(() => setSuccessMsg(null), 6000);
  }

  if (!enabled) return null;

  const visibleDisputes = showAll ? disputes : disputes.slice(0, 2);

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Scale className="h-4 w-4 text-gray-400" />
          <h3 className="font-bold text-sm uppercase tracking-wider text-gray-400">
            Dispute &amp; Appeals
          </h3>
        </div>
        {/* File new dispute — only when no open dispute and a wallet is connected */}
        {!hasOpenDispute && !showForm && walletAddress && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-yellow-500 hover:text-yellow-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            File dispute
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-1.5 text-gray-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <p className="text-xs text-gray-500">Unable to load disputes.</p>
      )}

      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded px-3 py-2 text-sm text-green-400 mb-3">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {/* Context: when flagged with no open dispute, nudge the owner */}
          {isFlagged && !hasOpenDispute && !showForm && disputes.length === 0 && (
            <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-400 font-medium">Is this assessment incorrect?</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Project owners can file a formal dispute with supporting evidence. Community
                  members vote on disputes, and our team makes the final call.
                </p>
              </div>
            </div>
          )}

          {/* Wallet required prompt */}
          {!walletAddress && !hasOpenDispute && disputes.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Connect your wallet to file a dispute or vote on existing ones.
              </p>
              <ConnectButton />
            </div>
          )}

          {/* Submit form */}
          {showForm && walletAddress && (
            <SubmitForm
              projectId={projectId}
              walletAddress={walletAddress}
              onSuccess={handleSubmitSuccess}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* Dispute cards */}
          {visibleDisputes.map(d => (
            <DisputeCard
              key={d.id}
              dispute={d}
              walletAddress={walletAddress}
              onVote={handleVote}
              onWithdraw={handleWithdraw}
            />
          ))}

          {/* Show more / less */}
          {disputes.length > 2 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full text-xs text-gray-600 hover:text-gray-400 py-1 transition-colors"
            >
              {showAll
                ? 'Show fewer'
                : `Show ${disputes.length - 2} more dispute${disputes.length - 2 > 1 ? 's' : ''}`}
            </button>
          )}

          {/* No disputes at all */}
          {!showForm && disputes.length === 0 && !isFlagged && (
            <p className="text-xs text-gray-600">No disputes filed for this project.</p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-600 mt-4">
        Dispute outcomes are advisory — DappScore reviewers make final decisions.
        Frivolous or bad-faith disputes may result in account restrictions.
      </p>
    </div>
  );
}
