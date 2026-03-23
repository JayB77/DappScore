'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Shield, CheckCircle, ArrowLeft, Plus, X, ExternalLink } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

const CATEGORIES = [
  { id: 'rug_pull',      label: 'Rug Pull',        desc: 'Developer drained LP / funds' },
  { id: 'honeypot',      label: 'Honeypot',         desc: 'Contract prevents selling' },
  { id: 'phishing',      label: 'Phishing',         desc: 'Fake site or wallet drainer' },
  { id: 'fake_project',  label: 'Fake Project',     desc: 'Impersonating a real project' },
  { id: 'ponzi',         label: 'Ponzi / Pyramid',  desc: 'Unsustainable yield scheme' },
  { id: 'exit_scam',     label: 'Exit Scam',        desc: 'Team disappeared with funds' },
  { id: 'fake_team',     label: 'Fake Team',        desc: 'Team identities are fabricated' },
  { id: 'pump_dump',     label: 'Pump & Dump',      desc: 'Coordinated price manipulation' },
  { id: 'impersonation', label: 'Impersonation',    desc: 'Impersonating another entity' },
  { id: 'other',         label: 'Other',            desc: 'Something else entirely' },
];

const CHAINS = [
  'ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'optimism',
  'avalanche', 'fantom', 'cronos', 'solana', 'other',
];

const REPORT_TYPES = [
  { id: 'contract', label: 'Contract / Token' },
  { id: 'wallet',   label: 'Wallet Address' },
  { id: 'exchange', label: 'DEX / Exchange' },
  { id: 'cex',      label: 'CEX' },
  { id: 'website',  label: 'Website / Phishing' },
  { id: 'other',    label: 'Other' },
];

export default function ReportScamPage() {
  const [form, setForm] = useState({
    address:          '',
    chain:            'ethereum',
    report_type:      'contract',
    category:         '',
    title:            '',
    description:      '',
    reporter_address: '',
    reporter_email:   '',
  });
  const [evidence, setEvidence] = useState<string[]>(['']);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function addEvidence() {
    if (evidence.length < 10) setEvidence(p => [...p, '']);
  }

  function updateEvidence(idx: number, val: string) {
    setEvidence(p => { const n = [...p]; n[idx] = val; return n; });
  }

  function removeEvidence(idx: number) {
    setEvidence(p => p.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category) {
      setErrorMsg('Please select a scam category.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    const payload = {
      ...form,
      evidence: evidence.filter(e => e.trim()),
    };

    try {
      const res = await fetch(`${API_BASE}/v1/scam-detection/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress: form.address,
          reason: form.category,
          evidence: evidence.filter(e => e.trim()),
          reporter: form.reporter_address || form.reporter_email || 'anonymous',
          // Extended fields for community_scam_reports table
          chain: form.chain,
          report_type: form.report_type,
          category: form.category,
          title: form.title,
          description: form.description,
          reporter_address: form.reporter_address,
          reporter_email: form.reporter_email,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.error ?? 'Submission failed. Please try again.');
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Report Submitted</h1>
          <p className="text-gray-400 mb-6">
            Thank you for helping protect the community. Our team will review your report and
            update the scam database accordingly. Confirmed reports are immediately available
            to exchanges and wallets via our B2B API.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/projects"
              className="py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
            >
              Browse Projects
            </Link>
            <button
              onClick={() => {
                setStatus('idle');
                setForm({ address: '', chain: 'ethereum', report_type: 'contract', category: '', title: '', description: '', reporter_address: '', reporter_email: '' });
                setEvidence(['']);
              }}
              className="py-3 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Submit Another Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">

      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-red-500/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold">Report a Scam</h1>
          </div>
          <p className="text-gray-400">
            Help protect the crypto community by reporting scams, honeypots, and fraudulent projects.
            All reports are reviewed by our team and confirmed reports are shared with exchanges and
            wallets via our B2B API.
          </p>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-8">
          <Shield className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <strong>Your identity is optional.</strong> Reports can be submitted anonymously.
            Providing your wallet or email helps us follow up if we need more information.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Address & Chain */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-lg">Target Address / URL</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Address or URL <span className="text-red-400">*</span>
              </label>
              <input
                required
                value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="0x… or https://scamsite.io"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-yellow-500 transition-colors font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Chain</label>
                <select
                  value={form.chain}
                  onChange={e => setForm(p => ({ ...p, chain: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                >
                  {CHAINS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Report Type</label>
                <select
                  value={form.report_type}
                  onChange={e => setForm(p => ({ ...p, report_type: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                >
                  {REPORT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Category */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="font-semibold text-lg mb-4">
              Scam Category <span className="text-red-400">*</span>
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, category: cat.id }))}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                    form.category === cat.id
                      ? 'bg-yellow-500/10 border-yellow-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium text-sm">{cat.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-lg">Report Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                required
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Brief description (e.g. 'Confirmed honeypot — sells blocked after launch')"
                maxLength={120}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Detailed Description <span className="text-red-400">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Describe what happened in detail. Include timeline, affected users, amounts lost, how you discovered this…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-yellow-500 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Evidence */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-lg">Evidence</h2>
                <p className="text-xs text-gray-500 mt-0.5">Transaction hashes, screenshot URLs, social media links, etc.</p>
              </div>
              {evidence.length < 10 && (
                <button
                  type="button"
                  onClick={addEvidence}
                  className="flex items-center gap-1.5 text-sm text-yellow-500 hover:text-yellow-400 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              )}
            </div>
            <div className="space-y-2">
              {evidence.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    value={item}
                    onChange={e => updateEvidence(idx, e.target.value)}
                    placeholder="0x tx hash, https://screenshot.url, tweet link…"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors font-mono"
                  />
                  {evidence.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEvidence(idx)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contact (optional) */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-lg mb-0.5">Your Contact (Optional)</h2>
              <p className="text-xs text-gray-500">Helps us follow up if we need more details. Fully optional — reports can be anonymous.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Wallet Address</label>
                <input
                  value={form.reporter_address}
                  onChange={e => setForm(p => ({ ...p, reporter_address: e.target.value }))}
                  placeholder="0x…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.reporter_email}
                  onChange={e => setForm(p => ({ ...p, reporter_email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {status === 'error' && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-4 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-2"
          >
            {status === 'loading' ? 'Submitting…' : (
              <>
                <AlertTriangle className="h-5 w-5" />
                Submit Scam Report
              </>
            )}
          </button>

          <p className="text-xs text-gray-600 text-center">
            False reports are taken seriously. Submitting a malicious or false report may result in your
            wallet being flagged.{' '}
            <Link href="/developer" className="text-gray-500 hover:text-gray-400 inline-flex items-center gap-0.5">
              B2B API <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
