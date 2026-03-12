'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Wallet, Lock, Gift, Plus, Trash2,
  Download, Edit3, Check, X, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { getFeatureEnabled } from '@/lib/featureFlags';

// ── Config ────────────────────────────────────────────────────────────────────

const ADMIN_WALLET = '0x0cC77C9d660f2E7D10783014e0e3D510f7307A50'.toLowerCase();
const API_BASE     = process.env.NEXT_PUBLIC_API_URL ?? '/api';
const CLAIM_KEY    = process.env.NEXT_PUBLIC_CLAIM_KEY ?? '';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Allocation {
  address: string;
  votes:   number;
  score:   number;
  note:    string;
  addedAt?: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}/v1/claim${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CLAIM_KEY}`,
      ...(options?.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json;
}

// ── Gate screens ──────────────────────────────────────────────────────────────

function NotConnected() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-gray-800 rounded-2xl p-10 max-w-sm w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-gray-700 rounded-full">
            <Wallet className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <h2 className="text-lg font-bold mb-2">Connect Wallet</h2>
        <p className="text-gray-400 text-sm mb-6">Admin access requires the deployer wallet.</p>
        <ConnectButton />
      </div>
    </div>
  );
}

function AccessDenied({ address }: { address: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-gray-800 rounded-2xl p-10 max-w-sm w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-red-500/20 rounded-full">
            <Lock className="h-8 w-8 text-red-400" />
          </div>
        </div>
        <h2 className="text-lg font-bold mb-2 text-red-400">Access Denied</h2>
        <p className="text-gray-400 text-sm mb-2">This page is restricted to the DappScore deployer wallet.</p>
        <p className="font-mono text-xs text-gray-600 break-all">{address}</p>
        <Link href="/" className="mt-6 inline-block text-sm text-gray-400 hover:text-white transition-colors">
          ← Back to site
        </Link>
      </div>
    </div>
  );
}

// ── Inline row editor ─────────────────────────────────────────────────────────

function AllocationRow({
  entry,
  onSave,
  onDelete,
  saving,
}: {
  entry:    Allocation;
  onSave:   (updated: Allocation) => Promise<void>;
  onDelete: (address: string) => Promise<void>;
  saving:   boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry);

  const save = async () => { await onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(entry); setEditing(false); };

  if (editing) {
    return (
      <tr className="bg-yellow-500/5 border-b border-gray-700">
        <td className="px-4 py-3 font-mono text-xs text-gray-300">{entry.address}</td>
        <td className="px-4 py-3">
          <input type="number" value={draft.votes}
            onChange={(e) => setDraft({ ...draft, votes: Number(e.target.value) })}
            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:border-yellow-500 focus:outline-none" />
        </td>
        <td className="px-4 py-3">
          <input type="number" value={draft.score}
            onChange={(e) => setDraft({ ...draft, score: Number(e.target.value) })}
            className="w-28 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:border-yellow-500 focus:outline-none" />
        </td>
        <td className="px-4 py-3">
          <input type="text" value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:border-yellow-500 focus:outline-none"
            placeholder="Optional note" />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving}
              className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={cancel} className="p-1 text-gray-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-700/20 transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-gray-300">{entry.address}</td>
      <td className="px-4 py-3 text-sm">{entry.votes.toLocaleString()}</td>
      <td className="px-4 py-3 text-sm font-medium text-yellow-400">{entry.score.toLocaleString()} $SCORE</td>
      <td className="px-4 py-3 text-sm text-gray-400">{entry.note || '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(true)}
            className="p-1 text-gray-400 hover:text-yellow-400 transition-colors">
            <Edit3 className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(entry.address)} disabled={saving}
            className="p-1 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClaimAdminPage() {
  const { address, isConnected } = useAccount();
  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_WALLET;

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [rewardsLive, setRewardsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [newAddr, setNewAddr] = useState('');
  const [newVotes, setNewVotes] = useState('');
  const [newScore, setNewScore] = useState('');
  const [newNote, setNewNote] = useState('');
  const [addError, setAddError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const json = await apiFetch('/');
      setAllocations(json.data.allocations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load allocations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setRewardsLive(getFeatureEnabled('tokenRewards', false));
    load();
  }, [isAdmin, load]);

  const handleSave = async (updated: Allocation) => {
    setSaving(true);
    try {
      await apiFetch(`/${updated.address}`, {
        method: 'PUT',
        body: JSON.stringify({ votes: updated.votes, score: updated.score, note: updated.note }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (addr: string) => {
    setSaving(true);
    try {
      await apiFetch(`/${addr}`, { method: 'DELETE' });
      setAllocations((prev) => prev.filter((a) => a.address !== addr));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    setAddError('');
    const addr = newAddr.trim().toLowerCase();
    if (!addr.match(/^0x[0-9a-f]{40}$/i)) { setAddError('Invalid address'); return; }
    setSaving(true);
    try {
      await apiFetch(`/${addr}`, {
        method: 'PUT',
        body: JSON.stringify({
          votes: parseInt(newVotes) || 0,
          score: parseInt(newScore) || 0,
          note:  newNote.trim(),
        }),
      });
      setNewAddr(''); setNewVotes(''); setNewScore(''); setNewNote('');
      await load();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Add failed.');
    } finally {
      setSaving(false);
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(allocations, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `dappscore-claim-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isConnected) return <NotConnected />;
  if (!isAdmin)     return <AccessDenied address={address!} />;

  const totalScore = allocations.reduce((s, a) => s + a.score, 0);
  const totalVotes = allocations.reduce((s, a) => s + a.votes, 0);

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Link href="/admin"
            className="flex items-center space-x-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Admin</span>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Gift className="h-6 w-6 text-yellow-500" />
                Pre-Launch Claim Allocations
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Manage $SCORE claim allocations for early participants. Stored in Firestore.
              </p>
            </div>
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>

        {/* Token launch status */}
        <div className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${
          rewardsLive
            ? 'bg-green-500/10 border border-green-500/30'
            : 'bg-yellow-500/10 border border-yellow-500/30'
        }`}>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            rewardsLive ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'
          }`} />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {rewardsLive ? 'Token Rewards are LIVE' : 'Token Rewards are OFF — pre-launch phase'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {rewardsLive
                ? 'Claims are enabled. Users can claim their allocation from the dashboard.'
                : 'Voting and reputation are active. Allocations set here will be claimable when you flip the switch in Admin.'}
            </p>
          </div>
          <Link href="/admin" className="text-xs text-yellow-400 hover:text-yellow-300 whitespace-nowrap">
            Admin →
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{allocations.length}</div>
            <div className="text-xs text-gray-400 mt-1">Wallets</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{totalVotes.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">Total Votes Tracked</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{totalScore.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">$SCORE Allocated</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Allocation List</h2>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button onClick={exportJSON}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-800 rounded-xl overflow-hidden mb-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Wallet</th>
                <th className="px-4 py-3 text-left">Votes</th>
                <th className="px-4 py-3 text-left">$SCORE</th>
                <th className="px-4 py-3 text-left">Note</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500 text-sm">
                    Loading from Firestore...
                  </td>
                </tr>
              ) : allocations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500 text-sm">
                    No allocations yet. Add wallets below.
                  </td>
                </tr>
              ) : (
                allocations.map((entry) => (
                  <AllocationRow
                    key={entry.address}
                    entry={entry}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    saving={saving}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add new entry */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-yellow-500" />
            Add Allocation
          </h3>
          <div className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-5">
              <input type="text" value={newAddr}
                onChange={(e) => setNewAddr(e.target.value)}
                placeholder="0x wallet address"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm font-mono focus:border-yellow-500 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <input type="number" value={newVotes}
                onChange={(e) => setNewVotes(e.target.value)}
                placeholder="Votes"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <input type="number" value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                placeholder="$SCORE"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <input type="text" value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none" />
            </div>
            <div className="col-span-1">
              <button onClick={handleAdd} disabled={saving}
                className="w-full py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors flex items-center justify-center disabled:opacity-50">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          {addError && <p className="text-xs text-red-400 mt-2">{addError}</p>}
        </div>

        <p className="text-xs text-gray-600 mt-6 text-center">
          Admin-only · Stored in Firestore (claim_allocations) · Restricted to deployer wallet
        </p>
      </div>
    </div>
  );
}
