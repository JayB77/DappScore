'use client';

import { useState, useEffect, useCallback } from 'react';
import { Key, Plus, RotateCw, Trash2, Copy, CheckCircle, Eye, EyeOff, AlertTriangle, Pencil } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  projectId: string | null;
  permissions: string[];
  active: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  usageCount: number;
}

interface NewKeyResult extends ApiKey {
  key: string;
  rotatedFrom?: string;
}

const VALID_PERMISSIONS = ['sale:write', 'webhooks:manage', 'data:read'] as const;

export default function ApiKeysPanel({ walletAddress }: { walletAddress: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createProjectId, setCreateProjectId] = useState('');
  const [createPermissions, setCreatePermissions] = useState<string[]>(['sale:write']);
  const [creating, setCreating] = useState(false);

  // Newly created key shown once
  const [revealedKey, setRevealedKey] = useState<NewKeyResult | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Confirm revoke
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Confirm rotate
  const [confirmRotateId, setConfirmRotateId] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  const headers = {
    'x-user-id': walletAddress,
    'Content-Type': 'application/json',
  };

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/api-keys`, { headers });
      if (!res.ok) throw new Error(`Failed to load keys (${res.status})`);
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  async function handleCreate() {
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: createName.trim(), permissions: createPermissions };
      if (createProjectId.trim()) body.projectId = createProjectId.trim();
      const res = await fetch(`${API_BASE}/v1/api-keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setRevealedKey(data as NewKeyResult);
      setShowKey(false);
      setCopiedKey(false);
      setShowCreate(false);
      setCreateName('');
      setCreateProjectId('');
      setCreatePermissions(['sale:write']);
      await fetchKeys();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    setRevoking(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/api-keys/${keyId}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setConfirmRevokeId(null);
      await fetchKeys();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRevoking(false);
    }
  }

  async function handleRotate(keyId: string) {
    setRotating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/api-keys/${keyId}/rotate`, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setRevealedKey(data as NewKeyResult);
      setShowKey(false);
      setCopiedKey(false);
      setConfirmRotateId(null);
      await fetchKeys();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRotating(false);
    }
  }

  async function handleRename(keyId: string) {
    if (!renameValue.trim()) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/api-keys/${keyId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setRenamingId(null);
      await fetchKeys();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function togglePermission(p: string) {
    setCreatePermissions(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const activeKeys = keys.filter(k => k.active);

  return (
    <div className="space-y-6">
      {/* Newly revealed key banner */}
      {revealedKey && (
        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-400">Copy your key now — it won&apos;t be shown again</p>
              <p className="text-sm text-gray-400 mt-0.5">
                Key &quot;{revealedKey.name}&quot; was {revealedKey.rotatedFrom ? 'rotated' : 'created'} successfully.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3 font-mono text-sm">
            <span className="flex-1 truncate text-green-400">
              {showKey ? revealedKey.key : revealedKey.key.slice(0, 16) + '•'.repeat(24)}
            </span>
            <button onClick={() => setShowKey(v => !v)} className="flex items-center gap-1.5 px-2 py-1 text-gray-400 hover:text-white text-xs shrink-0">
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showKey ? 'Hide' : 'Show'}
            </button>
            <button onClick={() => copyToClipboard(revealedKey.key)} className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 text-xs shrink-0">
              {copiedKey ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedKey ? 'Copied!' : 'Copy key'}
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-300"
          >
            I&apos;ve saved my key — dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Key className="h-5 w-5 text-yellow-500" />
            API Keys
          </h2>
          {activeKeys.length < 10 && (
            <button
              onClick={() => setShowCreate(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              New Key
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400">
          API keys let your backend services push sale data and manage webhooks without exposing your wallet.
          You can have up to 10 active keys.
        </p>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="mt-5 border border-gray-700 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold">Create new API key</h3>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                maxLength={100}
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="e.g. Production sale tracker"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Permissions <span className="text-red-400">*</span></label>
              <div className="flex flex-wrap gap-2">
                {VALID_PERMISSIONS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePermission(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      createPermissions.includes(p)
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Project ID <span className="text-gray-500">(optional — scope key to one contract)</span>
              </label>
              <input
                type="text"
                value={createProjectId}
                onChange={e => setCreateProjectId(e.target.value)}
                placeholder="0x..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-sm font-mono focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={creating || !createName.trim() || createPermissions.length === 0}
                className="px-5 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating…' : 'Create key'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-5 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Key list */}
      <div className="bg-gray-800 rounded-xl divide-y divide-gray-700">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="p-10 text-center">
            <Key className="h-10 w-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No API keys yet. Create one to get started.</p>
          </div>
        ) : (
          keys.map(k => (
            <div key={k.id} className={`p-5 ${!k.active ? 'opacity-50' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  {/* Name / rename */}
                  {renamingId === k.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        maxLength={100}
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(k.id); if (e.key === 'Escape') setRenamingId(null); }}
                        className="bg-gray-700 border border-yellow-500 rounded-lg px-3 py-1 text-sm focus:outline-none"
                      />
                      <button onClick={() => handleRename(k.id)} className="text-yellow-500 text-sm hover:text-yellow-400">Save</button>
                      <button onClick={() => setRenamingId(null)} className="text-gray-500 text-sm hover:text-gray-300">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{k.name}</span>
                      {k.active && (
                        <button
                          onClick={() => { setRenamingId(k.id); setRenameValue(k.name); }}
                          className="text-gray-500 hover:text-gray-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!k.active && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Revoked</span>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-400">
                    <button
                      onClick={() => copyToClipboard(k.keyPrefix)}
                      className="font-mono hover:text-white flex items-center gap-1"
                      title="Copy prefix"
                    >
                      {k.keyPrefix}… <Copy className="h-3 w-3 opacity-50" />
                    </button>
                    {k.permissions.map(p => (
                      <span key={p} className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{p}</span>
                    ))}
                    {k.projectId && (
                      <span className="font-mono text-xs text-blue-400">{k.projectId.slice(0, 10)}…</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Created {formatDate(k.createdAt)} · Last used {formatDate(k.lastUsedAt)} · {k.usageCount} calls
                  </div>
                </div>

                {k.active && (
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Rotate */}
                    {confirmRotateId === k.id ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-yellow-400">Rotate?</span>
                        <button
                          onClick={() => handleRotate(k.id)}
                          disabled={rotating}
                          className="px-3 py-1 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50"
                        >
                          {rotating ? '…' : 'Yes'}
                        </button>
                        <button onClick={() => setConfirmRotateId(null)} className="text-gray-400 hover:text-white">Cancel</button>
                      </div>
                    ) : confirmRevokeId !== k.id && (
                      <button
                        onClick={() => setConfirmRotateId(k.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                        title="Rotate key"
                      >
                        <RotateCw className="h-4 w-4" />
                        <span>Rotate</span>
                      </button>
                    )}

                    {/* Revoke */}
                    {confirmRevokeId === k.id ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-red-400">Revoke?</span>
                        <button
                          onClick={() => handleRevoke(k.id)}
                          disabled={revoking}
                          className="px-3 py-1 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-400 disabled:opacity-50"
                        >
                          {revoking ? '…' : 'Yes'}
                        </button>
                        <button onClick={() => setConfirmRevokeId(null)} className="text-gray-400 hover:text-white">Cancel</button>
                      </div>
                    ) : confirmRotateId !== k.id && (
                      <button
                        onClick={() => setConfirmRevokeId(k.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
                        title="Revoke key"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Revoke</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
