'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Code2, Shield, Zap, Building2, CheckCircle, ChevronDown, ChevronUp,
  Copy, ArrowRight, AlertTriangle, Globe, Wallet,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

// ── Pricing tiers ─────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Pay-per-query',
    priceDetail: '$0.005 / query',
    limit: '1,000 queries/month',
    color: 'border-gray-700',
    badge: null,
    features: [
      'Single address scam check',
      'Wallet trust lookup',
      'Confirmed scam report feed',
      'JSON response format',
      'Email support',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$199 / month',
    priceDetail: 'Flat rate',
    limit: '50,000 queries/month',
    color: 'border-yellow-500',
    badge: 'Popular',
    features: [
      'Everything in Starter',
      'Batch check (up to 50 addresses)',
      'Real-time confirmed report feed',
      'Webhook push for new reports',
      'Priority email support',
      'SLA 99.5% uptime',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    priceDetail: 'Contact us',
    limit: 'Unlimited queries',
    color: 'border-purple-500',
    badge: 'Best value',
    features: [
      'Everything in Professional',
      'Custom data integrations',
      'Dedicated account manager',
      'Custom SLA',
      'On-prem deployment option',
      'White-label API',
    ],
  },
];

// ── Code examples ─────────────────────────────────────────────────────────────

const CODE_EXAMPLES = {
  scamCheck: `curl -X POST https://api.dappscore.io/api/v1/b2b/scam-check \\
  -H "x-b2b-api-key: b2b_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"address": "0xAbC...", "chain": "ethereum"}'`,

  walletCheck: `curl -X POST https://api.dappscore.io/api/v1/b2b/wallet-check \\
  -H "x-b2b-api-key: b2b_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"address": "0x742d35Cc6634C0532925a3b8D4C9db96C4D4e9f0", "chain": "ethereum"}'`,

  batchCheck: `curl -X POST https://api.dappscore.io/api/v1/b2b/batch-check \\
  -H "x-b2b-api-key: b2b_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"addresses": ["0xAbc...", "0xDef...", "0x123..."], "chain": "bsc"}'`,

  reportFeed: `curl "https://api.dappscore.io/api/v1/b2b/reports?chain=ethereum&limit=100" \\
  -H "x-b2b-api-key: b2b_live_YOUR_KEY"`,

  response: `{
  "success": true,
  "cached": false,
  "data": {
    "address": "0xabc...",
    "chain": "ethereum",
    "riskScore": 85,
    "riskLevel": "critical",
    "flags": ["honeypot", "hidden-mint", "ownership-risk"],
    "confirmedScam": true,
    "scamReports": [
      {
        "category": "honeypot",
        "title": "Confirmed honeypot — sells blocked",
        "severity": "critical",
        "votes_confirm": 47
      }
    ],
    "checkedAt": "2026-03-23T12:00:00.000Z"
  }
}`,
};

// ── API endpoint docs ─────────────────────────────────────────────────────────

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/api/v1/b2b/scam-check',
    title: 'Contract / Token Scam Check',
    description: 'Full risk analysis for a contract or token address. Returns risk score, flags, and any confirmed scam reports from our community database.',
    params: [
      { name: 'address', type: 'string', required: true, desc: 'EVM contract or token address (0x…)' },
      { name: 'chain', type: 'string', required: false, desc: 'Chain name: ethereum, bsc, polygon, arbitrum, base, etc. Default: ethereum' },
    ],
  },
  {
    method: 'POST',
    path: '/api/v1/b2b/wallet-check',
    title: 'Wallet Trust Check',
    description: 'Check a wallet address for scam history, confirmed reports, and risk score. Ideal for CEX KYC flows or pre-deposit screening.',
    params: [
      { name: 'address', type: 'string', required: true, desc: 'EVM wallet address (0x…)' },
      { name: 'chain', type: 'string', required: false, desc: 'Chain name. Default: ethereum' },
    ],
  },
  {
    method: 'POST',
    path: '/api/v1/b2b/batch-check',
    title: 'Batch Address Check',
    description: 'Check up to 50 addresses in a single request. Each address counts as 1 query toward your quota. Results are cached.',
    params: [
      { name: 'addresses', type: 'string[]', required: true, desc: 'Array of up to 50 EVM addresses' },
      { name: 'chain', type: 'string', required: false, desc: 'Chain applied to all addresses. Default: ethereum' },
    ],
  },
  {
    method: 'GET',
    path: '/api/v1/b2b/reports',
    title: 'Confirmed Scam Report Feed',
    description: 'Paginated feed of community-confirmed scam addresses. Use this to bulk-ingest our scam database into your own systems.',
    params: [
      { name: 'chain', type: 'string', required: false, desc: 'Filter by chain' },
      { name: 'since', type: 'ISO date', required: false, desc: 'Return reports created after this date' },
      { name: 'limit', type: 'number', required: false, desc: 'Results per page (max 500, default 100)' },
      { name: 'offset', type: 'number', required: false, desc: 'Pagination offset' },
    ],
  },
  {
    method: 'GET',
    path: '/api/v1/b2b/account',
    title: 'Account Info & Quota',
    description: 'Get your current account details, tier, and monthly query usage.',
    params: [],
  },
];

// ── Application form ──────────────────────────────────────────────────────────

function ApplicationForm() {
  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '', website: '', use_case: '', tier: 'starter',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE}/v1/b2b/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-400" />
        </div>
        <h3 className="text-xl font-bold mb-2">Application Received</h3>
        <p className="text-gray-400 max-w-sm mx-auto">
          We'll review your application and send your API key within 1–2 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Company / Project Name <span className="text-red-400">*</span>
          </label>
          <input
            required
            value={form.company_name}
            onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))}
            placeholder="Acme Exchange"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Contact Name</label>
          <input
            value={form.contact_name}
            onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
            placeholder="Jane Smith"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Business Email <span className="text-red-400">*</span>
          </label>
          <input
            required
            type="email"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="jane@acme.io"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Website</label>
          <input
            value={form.website}
            onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
            placeholder="https://acme.io"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">How will you use the API?</label>
        <textarea
          rows={3}
          value={form.use_case}
          onChange={e => setForm(p => ({ ...p, use_case: e.target.value }))}
          placeholder="e.g. Pre-deposit scam screening for our DEX aggregator, blocking high-risk contracts before listing…"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Plan</label>
        <select
          value={form.tier}
          onChange={e => setForm(p => ({ ...p, tier: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
        >
          <option value="starter">Starter — Pay-per-query ($0.005/query, 1k/mo)</option>
          <option value="professional">Professional — $199/mo flat (50k queries)</option>
          <option value="enterprise">Enterprise — Custom (unlimited)</option>
        </select>
      </div>

      {status === 'error' && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {status === 'loading' ? 'Submitting…' : (
          <>Apply for API Access <ArrowRight className="h-4 w-4" /></>
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        We review all applications manually. You'll hear back within 1–2 business days.
      </p>
    </form>
  );
}

// ── Code block ────────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group">
      <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy"
      >
        {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ── Endpoint accordion ────────────────────────────────────────────────────────

function EndpointCard({ ep }: { ep: typeof ENDPOINTS[0] }) {
  const [open, setOpen] = useState(false);
  const methodColor: Record<string, string> = {
    GET: 'bg-blue-500/20 text-blue-400',
    POST: 'bg-green-500/20 text-green-400',
  };

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${methodColor[ep.method] ?? 'bg-gray-700 text-gray-300'}`}>
            {ep.method}
          </span>
          <code className="text-sm text-gray-200">{ep.path}</code>
          <span className="text-sm text-gray-400 hidden sm:block">— {ep.title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-4">
          <p className="text-sm text-gray-400">{ep.description}</p>

          {ep.params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Parameters</h4>
              <div className="space-y-1.5">
                {ep.params.map(p => (
                  <div key={p.name} className="flex items-start gap-3 text-sm">
                    <code className="text-yellow-400 shrink-0">{p.name}</code>
                    <span className="text-gray-600 shrink-0">{p.type}</span>
                    {p.required && <span className="text-red-400 text-xs shrink-0">required</span>}
                    <span className="text-gray-400">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeveloperPage() {
  const [activeTab, setActiveTab] = useState<'docs' | 'apply'>('docs');

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-950 to-black border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
          <div className="flex items-center gap-2 mb-4">
            <Code2 className="h-5 w-5 text-yellow-500" />
            <span className="text-yellow-500 text-sm font-medium uppercase tracking-wider">Developer API</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Scam Intelligence API<br />
            <span className="text-yellow-500">for Exchanges & Wallets</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mb-8">
            B2B access to DappScore's real-time scam data — contract risk scores, wallet trust checks,
            and a live feed of community-confirmed scam addresses. Trusted by DEXs, launchpads, and CEXs.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('apply')}
              className="px-6 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors flex items-center gap-2"
            >
              Get API Access <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className="px-6 py-3 border border-gray-700 text-gray-300 font-semibold rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Code2 className="h-4 w-4" /> View Docs
            </button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-8 mt-12 pt-8 border-t border-gray-800">
            {[
              { icon: Shield, label: 'Scam patterns detected', value: '25+' },
              { icon: Globe, label: 'Chains supported', value: '10+' },
              { icon: Zap, label: 'Avg. response time', value: '<200ms' },
              { icon: Wallet, label: 'Wallets screened', value: '1M+' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <s.icon className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="text-xl font-bold">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-gray-900 p-1 rounded-xl w-fit">
          {(['docs', 'apply'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'docs' ? 'API Reference' : 'Apply for Access'}
            </button>
          ))}
        </div>

        {activeTab === 'docs' && (
          <div className="space-y-12">

            {/* Authentication */}
            <section>
              <h2 className="text-2xl font-bold mb-2">Authentication</h2>
              <p className="text-gray-400 mb-4">
                All B2B API calls require your API key in the <code className="text-yellow-400">x-b2b-api-key</code> header.
              </p>
              <CodeBlock code={`curl -H "x-b2b-api-key: b2b_live_YOUR_KEY" https://api.dappscore.io/api/v1/b2b/account`} />
            </section>

            {/* Quick Examples */}
            <section>
              <h2 className="text-2xl font-bold mb-6">Quick Examples</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-200 mb-2">Check a contract for scams</h3>
                  <CodeBlock code={CODE_EXAMPLES.scamCheck} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-200 mb-2">Screen a wallet</h3>
                  <CodeBlock code={CODE_EXAMPLES.walletCheck} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-200 mb-2">Batch check 50 addresses</h3>
                  <CodeBlock code={CODE_EXAMPLES.batchCheck} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-200 mb-2">Pull confirmed scam feed</h3>
                  <CodeBlock code={CODE_EXAMPLES.reportFeed} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-200 mb-2">Example response</h3>
                  <CodeBlock code={CODE_EXAMPLES.response} lang="json" />
                </div>
              </div>
            </section>

            {/* Endpoints */}
            <section>
              <h2 className="text-2xl font-bold mb-6">API Endpoints</h2>
              <div className="space-y-3">
                {ENDPOINTS.map(ep => <EndpointCard key={ep.path} ep={ep} />)}
              </div>
            </section>

            {/* Pricing */}
            <section id="pricing">
              <h2 className="text-2xl font-bold mb-6">Pricing</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {TIERS.map(tier => (
                  <div
                    key={tier.id}
                    className={`relative bg-gray-900 rounded-2xl p-6 border-2 ${tier.color}`}
                  >
                    {tier.badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                        {tier.badge}
                      </span>
                    )}
                    <h3 className="text-lg font-bold mb-1">{tier.name}</h3>
                    <div className="text-2xl font-bold text-white mb-0.5">{tier.price}</div>
                    <div className="text-sm text-gray-500 mb-1">{tier.priceDetail}</div>
                    <div className="text-xs text-yellow-500 mb-5">{tier.limit}</div>
                    <ul className="space-y-2">
                      {tier.features.map(f => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                          <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setActiveTab('apply')}
                      className="w-full mt-6 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500 hover:text-black"
                    >
                      Apply for {tier.name}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Chains */}
            <section>
              <h2 className="text-2xl font-bold mb-4">Supported Chains</h2>
              <div className="flex flex-wrap gap-2">
                {['Ethereum', 'BNB Chain', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'Avalanche', 'Fantom', 'Cronos', 'zkSync Era'].map(c => (
                  <span key={c} className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-300 border border-gray-700">
                    {c}
                  </span>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="bg-gradient-to-r from-yellow-900/30 to-yellow-600/20 rounded-2xl p-8 text-center border border-yellow-500/20">
              <Building2 className="h-10 w-10 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Ready to integrate?</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Get your API key and start protecting your users from scams in minutes.
              </p>
              <button
                onClick={() => setActiveTab('apply')}
                className="px-8 py-3 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
              >
                Apply Now — It's Free to Start
              </button>
            </section>
          </div>
        )}

        {activeTab === 'apply' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">Apply for B2B API Access</h2>
              <p className="text-gray-400">
                Fill in the form below. We review all applications manually and respond within 1–2 business days.
                For urgent or enterprise inquiries, email{' '}
                <a href="mailto:admin@dappscore.io" className="text-yellow-500 hover:text-yellow-400">admin@dappscore.io</a>.
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <ApplicationForm />
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={() => setActiveTab('docs')}
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1 mx-auto"
              >
                ← Back to API docs
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
