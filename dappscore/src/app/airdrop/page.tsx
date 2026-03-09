'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Wallet,
  Lock,
  Gift,
  Plus,
  Trash2,
  Download,
  Upload,
  Edit3,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { getFeatureEnabled } from '@/lib/featureFlags';

// ── Access control ─────────────────────────────────────────────────────────────

const ADMIN_WALLET = '0x0cC77C9d660f2E7D10783014e0e3D510f7307A50'.toLowerCase();
const STORAGE_KEY = 'dappscore_airdrop_allocations';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Allocation {
  address: string;
  votes: number;
  score: number;
  note: string;
  addedAt: string;
}

type AllocationMap = Record<string, Allocation>;

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
}: {
  entry: Allocation;
  onSave: (updated: Allocation) => void;
  onDelete: (address: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry);

  const save = () => {
    onSave(draft);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(entry);
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="bg-yellow-500/5 border-b border-gray-700">
        <td className="px-4 py-3 font-mono text-xs text-gray-300">{entry.address}</td>
        <td className="px-4 py-3">
          <input
            type="number"
            value={draft.votes}
            onChange={(e) => setDraft({ ...draft, votes: Number(e.target.value) })}
            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:border-yellow-500 focus:outline-none"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            value={draft.score}
            onChange={(e) => setDraft({ ...draft, score: Number(e.target.value) })}
            className="w-28 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:border-yellow-500 focus:outline-none"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:border-yellow-500 focus:outline-none"
            placeholder="Optional note"
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={save} className="p-1 text-green-400 hover:text-green-300">
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
          <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-yellow-400 transition-colors">
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(entry.address)}
            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AirdropPage() {
  const { address, isConnected } = useAccount();
  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_WALLET;

  const [allocations, setAllocations] = useState<AllocationMap>({});
  const [rewardsLive, setRewardsLive] = useState(false);

  // New entry form
  const [newAddr, setNewAddr] = useState('');
  const [newVotes, setNewVotes] = useState('');
  const [newScore, setNewScore] = useState('');
  const [newNote, setNewNote] = useState('');
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setAllocations(JSON.parse(raw)); } catch { /* ignore */ }
    }
    setRewardsLive(getFeatureEnabled('tokenRewards', false));
  }, [isAdmin]);

  const persist = (next: AllocationMap) => {
    setAllocations(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleAdd = () => {
    setAddError('');
    const addr = newAddr.trim().toLowerCase();
    if (!addr.match(/^0x[0-9a-f]{40}$/i)) {
      setAddError('Invalid address');
      return;
    }
    const votes = parseInt(newVotes) || 0;
    const score = parseInt(newScore) || 0;
    const entry: Allocation = {
      address: addr,
      votes,
      score,
      note: newNote.trim(),
      addedAt: new Date().toISOString().slice(0, 10),
    };
    persist({ ...allocations, [addr]: entry });
    setNewAddr(''); setNewVotes(''); setNewScore(''); setNewNote('');
  };

  const handleSave = (updated: Allocation) => {
    persist({ ...allocations, [updated.address]: updated });
  };

  const handleDelete = (addr: string) => {
    const next = { ...allocations };
    delete next[addr];
    persist(next);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(allocations, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dappscore-airdrop-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        persist(parsed);
      } catch { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Gates
  if (!isConnected) return <NotConnected />;
  if (!isAdmin) return <AccessDenied address={address!} />;

  const entries = Object.values(allocations).sort((a, b) => b.score - a.score);
  const totalScore = entries.reduce((s, e) => s + e.score, 0);
  const totalVotes = entries.reduce((s, e) => s + e.votes, 0);

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="flex items-center space-x-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Admin</span>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Gift className="h-6 w-6 text-yellow-500" />
                Pre-Launch Airdrop Allocations
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Track and manage $SCORE allocations for early participants before token launch.
              </p>
            </div>
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>

        {/* Token launch status banner */}
        <div className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${
          rewardsLive
            ? 'bg-green-500/10 border border-green-500/30'
            : 'bg-yellow-500/10 border border-yellow-500/30'
        }`}>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${rewardsLive ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {rewardsLive ? 'Token Rewards are LIVE' : 'Token Rewards are OFF — pre-launch phase'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {rewardsLive
                ? 'Claiming is enabled. Users can claim their allocation from their dashboard.'
                : 'Voting and reputation are active. Manage allocations below — users will claim when you flip the switch in Admin.'}
            </p>
          </div>
          <Link href="/admin" className="text-xs text-yellow-400 hover:text-yellow-300 whitespace-nowrap">
            Admin →
          </Link>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{entries.length}</div>
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

        {/* localStorage warning */}
        <div className="flex items-start gap-2 bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-6 text-xs text-gray-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-orange-400 mt-0.5" />
          <span>
            Allocations are stored in your browser&apos;s localStorage. Use <strong className="text-gray-300">Export JSON</strong> to back them up regularly, and <strong className="text-gray-300">Import JSON</strong> to restore on another device. A persistent backend for this will be added before token launch.
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Allocation List</h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors">
              <Upload className="h-3.5 w-3.5" />
              Import JSON
              <input type="file" accept=".json" onChange={importJSON} className="hidden" />
            </label>
            <button
              onClick={exportJSON}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
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
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500 text-sm">
                    No allocations yet. Add wallets below.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <AllocationRow
                    key={entry.address}
                    entry={entry}
                    onSave={handleSave}
                    onDelete={handleDelete}
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
              <input
                type="text"
                value={newAddr}
                onChange={(e) => setNewAddr(e.target.value)}
                placeholder="0x wallet address"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm font-mono focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <input
                type="number"
                value={newVotes}
                onChange={(e) => setNewVotes(e.target.value)}
                placeholder="Votes"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <input
                type="number"
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                placeholder="$SCORE"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <div className="col-span-1">
              <button
                onClick={handleAdd}
                className="w-full py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors flex items-center justify-center"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          {addError && <p className="text-xs text-red-400 mt-2">{addError}</p>}
        </div>

        <p className="text-xs text-gray-600 mt-6 text-center">
          Admin-only · Restricted to deployer wallet · Not indexed in site navigation
        </p>
      </div>
    </div>
  );
}
