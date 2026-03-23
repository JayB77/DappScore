'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ExternalLink, CheckCircle, AlertTriangle, Lock, Wallet,
  RefreshCw, Plus, Key, Shield, BarChart2, Users, Flag, Sliders,
  ChevronDown, ChevronUp, Copy, Check, Trash2,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  FEATURE_CONFIGS,
  getFeatureEnabled,
  setFeatureEnabled,
  type FeatureCategory,
} from '@/lib/featureFlags';

// ── Access control ────────────────────────────────────────────────────────────

const ADMIN_WALLET = '0x80361876199e2318d6993A07e37177cFd21B64a7'.toLowerCase();
const API_BASE     = process.env.NEXT_PUBLIC_API_URL ?? '/api';
const ADMIN_KEY    = process.env.NEXT_PUBLIC_ADMIN_KEY ?? '';

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ADMIN_KEY}`,
  };
}

// ── Feature flag helpers ───────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  token:   'Token Layer',
  core:    'Core',
  signals: 'Trust Signals',
  social:  'Social',
  market:  'Market & Safety',
};

const CATEGORY_ORDER: FeatureCategory[] = ['token', 'core', 'signals', 'social', 'market'];

function hasEnvKey(envVar: string): boolean {
  const val = (process.env as Record<string, string | undefined>)[envVar];
  return !!(val && val.trim().length > 0);
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface B2BAccount {
  id: string;
  company_name: string;
  contact_email: string;
  tier: 'starter' | 'professional' | 'enterprise';
  status: 'pending' | 'active' | 'suspended' | 'cancelled';
  monthly_query_limit: number;
  queries_this_month: number;
  pricing_model: 'per_query' | 'flat_rate';
  api_key_prefix: string;
  created_at: string;
}

interface ScamReport {
  id: string;
  contract_address: string;
  reporter_address: string;
  category: string;
  description: string;
  status: 'pending' | 'confirmed' | 'dismissed' | 'investigating';
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  evidence: string[];
  created_at: string;
}

interface Analytics {
  top_clients: Array<{ company_name: string; queries_this_month: number; tier: string }>;
  daily_queries: Array<{ date: string; count: number }>;
  accounts_by_tier: Record<string, number>;
  accounts_by_status: Record<string, number>;
  reports_by_status: Record<string, number>;
  total_queries_this_month: number;
}

// ── Gate screens ─────────────────────────────────────────────────────────────

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

// ── Badge helpers ──────────────────────────────────────────────────────────────

const TIER_BADGE: Record<string, string> = {
  starter:      'bg-gray-700 text-gray-300',
  professional: 'bg-blue-500/20 text-blue-400',
  enterprise:   'bg-yellow-500/20 text-yellow-400',
};

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-orange-500/20 text-orange-400',
  active:    'bg-green-500/20 text-green-400',
  suspended: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-700 text-gray-500',
};

const REPORT_STATUS_BADGE: Record<string, string> = {
  pending:      'bg-orange-500/20 text-orange-400',
  confirmed:    'bg-red-500/20 text-red-400',
  dismissed:    'bg-gray-700 text-gray-500',
  investigating:'bg-blue-500/20 text-blue-400',
};

// ── Tab: Feature Flags ────────────────────────────────────────────────────────

function FeatureFlagsTab() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const f of FEATURE_CONFIGS) {
      initial[f.id] = getFeatureEnabled(f.id, f.defaultEnabled);
    }
    setFlags(initial);
  }, []);

  const toggle = (id: string) => {
    const next = !flags[id];
    setFlags(prev => ({ ...prev, [id]: next }));
    setFeatureEnabled(id, next);
  };

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    features: FEATURE_CONFIGS.filter(f => f.category === cat),
  }));

  return (
    <div className="space-y-8">
      {grouped.map(({ category, features }) => (
        <div key={category}>
          <h2 className={`text-xs font-bold uppercase tracking-widest mb-3 ${
            category === 'token' ? 'text-yellow-500' : 'text-gray-500'
          }`}>
            {CATEGORY_LABELS[category]}
          </h2>
          {category === 'token' && (
            <p className="text-xs text-gray-500 mb-3">
              Master switch for all token functionality. Voting, reputation, and signals are unaffected.
            </p>
          )}
          <div className="space-y-2">
            {features.map(f => {
              const enabled = flags[f.id] ?? f.defaultEnabled;
              const apiKeyPresent = f.apiKey ? hasEnvKey(f.apiKey.envVar) : null;
              const isTokenMaster = f.id === 'tokenRewards';

              return (
                <div
                  key={f.id}
                  className={`rounded-xl p-4 border transition-colors ${
                    isTokenMaster
                      ? enabled
                        ? 'bg-yellow-500/10 border-yellow-500/50'
                        : 'bg-gray-800 border-gray-700'
                      : enabled
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-gray-800 border-gray-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{f.label}</span>
                        {f.apiKey && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                            API key
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{f.description}</p>

                      {f.apiKey && (
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          {apiKeyPresent ? (
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <CheckCircle className="h-3 w-3" />
                              {f.apiKey.envVar} is set
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-orange-400">
                              <AlertTriangle className="h-3 w-3" />
                              {f.apiKey.envVar} not set
                            </span>
                          )}
                          <a
                            href={f.apiKey.getUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                          >
                            Get {f.apiKey.label}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => toggle(f.id)}
                      className={`flex-shrink-0 relative w-11 h-6 rounded-full transition-colors ${
                        enabled ? 'bg-yellow-500' : 'bg-gray-600'
                      }`}
                      aria-label={enabled ? 'Disable' : 'Enable'}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-600 text-center">
        Flags stored in browser localStorage · Restricted to deployer wallet
      </p>
    </div>
  );
}

// ── Tab: B2B Accounts ────────────────────────────────────────────────────────

function B2BAccountsTab() {
  const [accounts, setAccounts]     = useState<B2BAccount[]>([]);
  const [loading, setLoading]       = useState(true);
  const [newKey, setNewKey]         = useState<{ id: string; key: string } | null>(null);
  const [copied, setCopied]         = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    company_name: '', contact_email: '', website: '',
    tier: 'starter', pricing_model: 'per_query', use_case: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/v1/admin/b2b/accounts`, { headers: adminHeaders() });
      const json = await res.json();
      setAccounts(json.data?.accounts ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function activate(id: string) {
    const res  = await fetch(`${API_BASE}/v1/admin/b2b/accounts/${id}/activate`, { method: 'POST', headers: adminHeaders() });
    const json = await res.json();
    if (json.data?.apiKey) setNewKey({ id, key: json.data.apiKey });
    await load();
  }

  async function suspend(id: string) {
    await fetch(`${API_BASE}/v1/admin/b2b/accounts/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ status: 'suspended' }),
    });
    await load();
  }

  async function reactivate(id: string) {
    await fetch(`${API_BASE}/v1/admin/b2b/accounts/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ status: 'active' }),
    });
    await load();
  }

  async function rotateKey(id: string) {
    const res  = await fetch(`${API_BASE}/v1/admin/b2b/accounts/${id}/rotate-key`, { method: 'POST', headers: adminHeaders() });
    const json = await res.json();
    if (json.data?.apiKey) setNewKey({ id, key: json.data.apiKey });
    await load();
  }

  async function deleteAccount(id: string) {
    if (!confirm('Delete this account? This cannot be undone.')) return;
    await fetch(`${API_BASE}/v1/admin/b2b/accounts/${id}`, { method: 'DELETE', headers: adminHeaders() });
    await load();
  }

  async function createAccount() {
    await fetch(`${API_BASE}/v1/admin/b2b/accounts`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(form),
    });
    setShowCreate(false);
    setForm({ company_name: '', contact_email: '', website: '', tier: 'starter', pricing_model: 'per_query', use_case: '' });
    await load();
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">

      {/* New key display */}
      {newKey && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-sm font-medium text-green-400 mb-2">
            API key issued — copy now, it won&apos;t be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-gray-900 rounded px-3 py-2 text-green-300 break-all">
              {newKey.key}
            </code>
            <button
              onClick={() => copyKey(newKey.key)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Copy"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-gray-400" />}
            </button>
            <button onClick={() => setNewKey(null)} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-xs">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{accounts.length} account(s)</p>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button onClick={() => setShowCreate(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-yellow-500 hover:bg-yellow-400 rounded-lg transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Account
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
          <h3 className="text-sm font-semibold">Create B2B Account</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['company_name', 'contact_email', 'website'] as const).map(field => (
              <input
                key={field}
                placeholder={field.replace(/_/g, ' ')}
                value={form[field]}
                onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-500"
              />
            ))}
            <select
              value={form.tier}
              onChange={e => setForm(p => ({ ...p, tier: e.target.value }))}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
            >
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select
              value={form.pricing_model}
              onChange={e => setForm(p => ({ ...p, pricing_model: e.target.value }))}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
            >
              <option value="per_query">Per Query</option>
              <option value="flat_rate">Flat Rate</option>
            </select>
          </div>
          <textarea
            placeholder="Use case"
            value={form.use_case}
            onChange={e => setForm(p => ({ ...p, use_case: e.target.value }))}
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-500 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs text-gray-400 hover:text-white bg-gray-700 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={createAccount} className="px-4 py-2 text-xs text-white bg-yellow-500 hover:bg-yellow-400 rounded-lg transition-colors">
              Create
            </button>
          </div>
        </div>
      )}

      {/* Account list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">No accounts yet</div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{acc.company_name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${TIER_BADGE[acc.tier] ?? 'bg-gray-700 text-gray-400'}`}>
                      {acc.tier}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[acc.status] ?? 'bg-gray-700 text-gray-400'}`}>
                      {acc.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{acc.contact_email}</p>
                  <p className="text-xs text-gray-600 mt-0.5 font-mono">Prefix: {acc.api_key_prefix}…</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 max-w-48">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Queries</span>
                        <span>{acc.queries_this_month.toLocaleString()} / {acc.monthly_query_limit.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            acc.queries_this_month / acc.monthly_query_limit > 0.9 ? 'bg-red-500'
                            : acc.queries_this_month / acc.monthly_query_limit > 0.7 ? 'bg-orange-500'
                            : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(100, (acc.queries_this_month / acc.monthly_query_limit) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {acc.status === 'pending' && (
                    <button onClick={() => activate(acc.id)} className="px-3 py-1.5 text-xs text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors">
                      Activate
                    </button>
                  )}
                  {acc.status === 'active' && (
                    <>
                      <button onClick={() => rotateKey(acc.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                        <Key className="h-3 w-3" /> Rotate Key
                      </button>
                      <button onClick={() => suspend(acc.id)} className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
                        Suspend
                      </button>
                    </>
                  )}
                  {acc.status === 'suspended' && (
                    <button onClick={() => reactivate(acc.id)} className="px-3 py-1.5 text-xs text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors">
                      Reactivate
                    </button>
                  )}
                  <button onClick={() => deleteAccount(acc.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Scam Reports ─────────────────────────────────────────────────────────

const REPORT_STATUSES = ['pending', 'investigating', 'confirmed', 'dismissed'] as const;

function ScamReportsTab() {
  const [reports, setReports]   = useState<ScamReport[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<string>('pending');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/v1/admin/b2b/scam-reports?status=${filter}&limit=50`, { headers: adminHeaders() });
      const json = await res.json();
      setReports(json.data?.reports ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function updateReport(id: string, update: Record<string, string>) {
    await fetch(`${API_BASE}/v1/admin/b2b/scam-reports/${id}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify(update),
    });
    await load();
  }

  async function deleteReport(id: string) {
    if (!confirm('Delete this report?')) return;
    await fetch(`${API_BASE}/v1/admin/b2b/scam-reports/${id}`, { method: 'DELETE', headers: adminHeaders() });
    await load();
  }

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {REPORT_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors capitalize ${
              filter === s ? 'bg-yellow-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
        <button onClick={load} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">No {filter} reports</div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-4"
                onClick={() => setExpanded(e => e === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${REPORT_STATUS_BADGE[r.status] ?? 'bg-gray-700 text-gray-400'}`}>
                    {r.status}
                  </span>
                  <span className="text-sm font-mono text-gray-300 truncate">{r.contract_address}</span>
                  <span className="shrink-0 text-xs text-gray-500 capitalize">{r.category.replace(/_/g, ' ')}</span>
                </div>
                {expanded === r.id ? <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
              </button>

              {expanded === r.id && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-700">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs text-gray-400">
                    <div><span className="text-gray-600">Reporter: </span><span className="font-mono">{r.reporter_address || 'anonymous'}</span></div>
                    <div><span className="text-gray-600">Submitted: </span>{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <p className="text-sm text-gray-300">{r.description}</p>
                  {r.evidence.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Evidence</p>
                      <ul className="space-y-1">
                        {r.evidence.map((e, i) => (
                          <li key={i} className="text-xs text-gray-400 font-mono bg-gray-900 rounded px-2 py-1 break-all">{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.status !== 'confirmed' && (
                      <button onClick={() => updateReport(r.id, { status: 'confirmed', severity: 'high' })} className="px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors">
                        Confirm Scam
                      </button>
                    )}
                    {r.status !== 'investigating' && (
                      <button onClick={() => updateReport(r.id, { status: 'investigating' })} className="px-3 py-1.5 text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors">
                        Investigate
                      </button>
                    )}
                    {r.status !== 'dismissed' && (
                      <button onClick={() => updateReport(r.id, { status: 'dismissed' })} className="px-3 py-1.5 text-xs text-gray-400 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                        Dismiss
                      </button>
                    )}

                    {/* Severity */}
                    <select
                      value={r.severity ?? ''}
                      onChange={e => updateReport(r.id, { severity: e.target.value })}
                      className="px-2 py-1.5 text-xs bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-yellow-500"
                    >
                      <option value="">Set severity</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>

                    <button onClick={() => deleteReport(r.id)} className="ml-auto p-1.5 text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Analytics ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [data, setData]     = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${API_BASE}/v1/admin/b2b/analytics`, { headers: adminHeaders() });
        const json = await res.json();
        setData(json.data ?? null);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500 text-sm">Loading…</div>;
  if (!data)   return <div className="text-center py-12 text-gray-500 text-sm">Failed to load analytics</div>;

  function StatGrid({ title, obj }: { title: string; obj: Record<string, number> }) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">{title}</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(obj).map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-gray-400 capitalize">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
        <p className="text-xs text-yellow-500 uppercase tracking-widest mb-1">This month</p>
        <p className="text-3xl font-bold">{(data.total_queries_this_month ?? 0).toLocaleString()}</p>
        <p className="text-xs text-gray-400 mt-1">API queries billed</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatGrid title="Accounts by Tier"   obj={data.accounts_by_tier ?? {}} />
        <StatGrid title="Accounts by Status" obj={data.accounts_by_status ?? {}} />
        <StatGrid title="Reports by Status"  obj={data.reports_by_status ?? {}} />
      </div>

      {/* Top clients */}
      {(data.top_clients?.length ?? 0) > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Top Clients This Month</h3>
          <div className="space-y-2">
            {data.top_clients.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-4">{i + 1}.</span>
                <span className="flex-1 text-sm text-gray-300 truncate">{c.company_name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TIER_BADGE[c.tier] ?? 'bg-gray-700 text-gray-400'}`}>{c.tier}</span>
                <span className="text-sm font-semibold tabular-nums">{c.queries_this_month.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'flags' | 'b2b' | 'reports' | 'analytics';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'flags',     label: 'Feature Flags', icon: <Sliders className="h-4 w-4" /> },
  { id: 'b2b',       label: 'B2B Accounts',  icon: <Users className="h-4 w-4" /> },
  { id: 'reports',   label: 'Scam Reports',  icon: <Flag className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analytics',     icon: <BarChart2 className="h-4 w-4" /> },
];

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_WALLET;
  const [tab, setTab] = useState<Tab>('flags');

  if (!isConnected) return <NotConnected />;
  if (!isAdmin)     return <AccessDenied address={address!} />;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="flex items-center space-x-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to site</span>
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Shield className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Admin Panel</h1>
                <p className="text-gray-400 text-sm mt-0.5">DappScore internal management</p>
              </div>
            </div>
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-gray-800 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm transition-colors ${
                tab === t.id ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'flags'     && <FeatureFlagsTab />}
        {tab === 'b2b'       && <B2BAccountsTab />}
        {tab === 'reports'   && <ScamReportsTab />}
        {tab === 'analytics' && <AnalyticsTab />}
      </div>
    </div>
  );
}
