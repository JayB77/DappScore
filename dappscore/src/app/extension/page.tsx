import Link from 'next/link';
import {
  Shield,
  Chrome,
  AlertTriangle,
  CheckCircle,
  Eye,
  Zap,
  ArrowRight,
  Star,
} from 'lucide-react';

export const metadata = {
  title: 'Chrome Extension — DappScore',
  description:
    'See trust scores for crypto projects as you browse Etherscan, BaseScan, and DexScreener. Get warned before interacting with potential scams.',
};

const FEATURES = [
  {
    icon: Shield,
    color: 'text-yellow-500',
    bg:    'bg-yellow-500/10',
    title: 'Live Trust Badges',
    desc:  'Scores appear directly on Etherscan, BaseScan, and DexScreener — no tab-switching required.',
  },
  {
    icon: AlertTriangle,
    color: 'text-red-400',
    bg:    'bg-red-500/10',
    title: 'Instant Scam Warnings',
    desc:  'A red banner slides in the moment you land on a page flagged by the community.',
  },
  {
    icon: Eye,
    color: 'text-blue-400',
    bg:    'bg-blue-500/10',
    title: 'Popup Search',
    desc:  'Search any project by name or paste a contract address directly in the toolbar popup.',
  },
  {
    icon: Zap,
    color: 'text-green-400',
    bg:    'bg-green-500/10',
    title: 'Zero Config',
    desc:  'Install once — the extension silently checks every contract address you visit.',
  },
];

const STEPS = [
  { n: '1', text: 'Click "Add to Chrome" and confirm the permissions prompt.' },
  { n: '2', text: 'Visit any contract on Etherscan, BaseScan, or DexScreener.' },
  { n: '3', text: 'The DappScore badge appears next to the token name automatically.' },
];

const SITES = [
  { name: 'Etherscan',  domain: 'etherscan.io' },
  { name: 'BaseScan',   domain: 'basescan.org' },
  { name: 'DexScreener',domain: 'dexscreener.com' },
];

export default function ExtensionPage() {
  return (
    <div className="min-h-screen">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 py-24">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-yellow-500/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-yellow-500/10 px-4 py-1.5 text-sm font-medium text-yellow-400 ring-1 ring-yellow-500/20">
            <Chrome className="h-4 w-4" />
            Chrome Extension — Early Access
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Trust scores,{' '}
            <span className="text-yellow-500">right where you browse</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
            The DappScore extension injects community trust badges directly onto
            Etherscan, BaseScan, and DexScreener — and fires an instant warning
            if you land on a flagged scam.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://chromewebstore.google.com/detail/dappscore"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-8 py-3.5 font-semibold text-black hover:bg-yellow-400 transition-colors"
            >
              <Chrome className="h-5 w-5" />
              Add to Chrome — it&apos;s free
            </a>
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-8 py-3.5 font-medium text-gray-300 hover:border-yellow-500 hover:text-white transition-colors"
            >
              Browse projects instead
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-4 text-xs text-gray-600">
            No account required &nbsp;·&nbsp; No wallet connection needed &nbsp;·&nbsp; Open source
          </p>
        </div>
      </section>

      {/* ── Mock badge preview ──────────────────────────────────────────── */}
      <section className="bg-gray-950 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-gray-500 uppercase tracking-widest mb-8">
            How it looks on supported sites
          </p>

          {/* Fake Etherscan card */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden shadow-2xl">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 bg-gray-800 px-4 py-3 border-b border-gray-700">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-gray-600" />
                <div className="h-3 w-3 rounded-full bg-gray-600" />
                <div className="h-3 w-3 rounded-full bg-gray-600" />
              </div>
              <div className="flex-1 mx-3 rounded bg-gray-700 px-3 py-1 text-xs text-gray-400 font-mono">
                etherscan.io/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
              </div>
            </div>

            {/* Page content mock */}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">U</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-lg">USD Coin (USDC)</span>
                    {/* Injected badge */}
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ background: '#064E3B', color: '#10B981' }}>
                      🛡️ 94% <span className="font-medium">Trusted</span>
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-0.5">Token · Circle Internet Financial</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {['Price', 'Market Cap', 'Holders'].map((label, i) => (
                  <div key={label} className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                    <div className="h-4 bg-gray-700 rounded w-3/4" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scam warning preview */}
          <div className="mt-6 rounded-xl border border-red-900/50 bg-gradient-to-r from-red-950 to-red-900/50 overflow-hidden shadow-xl">
            <div className="flex items-center gap-3 px-5 py-4">
              <AlertTriangle className="h-6 w-6 text-red-400 flex-shrink-0" />
              <div className="flex-1 text-sm text-red-200">
                <strong className="text-red-300">DappScore Warning:</strong>{' '}
                <em>ShadyToken (SHDY)</em> has been flagged as a potential scam by the community.{' '}
                <span className="underline text-red-300 cursor-pointer">View report</span>
              </div>
              <button className="text-red-400 text-xl leading-none opacity-70">×</button>
            </div>
          </div>
          <p className="text-center text-xs text-gray-600 mt-3">
            Warning banner injected automatically for projects flagged as Scam Alert or higher
          </p>
        </div>
      </section>

      {/* ── Features grid ───────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-12">
            Everything you need to stay safe on-chain
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="rounded-xl bg-gray-800 p-6 flex gap-4">
                <div className={`${bg} rounded-lg p-3 h-fit`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Supported sites ─────────────────────────────────────────────── */}
      <section className="py-16 bg-gray-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-xl font-bold mb-2">Works on the sites you already use</h2>
          <p className="text-gray-400 text-sm mb-10">
            More integrations coming soon — CoinGecko, CoinMarketCap, and more.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {SITES.map(({ name, domain }) => (
              <div key={name} className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-6 py-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="font-medium">{name}</span>
                <span className="text-xs text-gray-500">{domain}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Install steps ───────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-900">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-12">Up and running in 30 seconds</h2>
          <div className="space-y-6">
            {STEPS.map(({ n, text }) => (
              <div key={n} className="flex items-start gap-4">
                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-yellow-500 flex items-center justify-center font-bold text-black text-sm">
                  {n}
                </div>
                <p className="text-gray-300 pt-1.5 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-gradient-to-b from-gray-950 to-gray-900">
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8 text-center">
          <Star className="h-10 w-10 text-yellow-500 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl font-bold mb-4">Stop guessing. Start knowing.</h2>
          <p className="text-gray-400 mb-8">
            Join the community that&apos;s already flagging scams before they rug.
          </p>
          <a
            href="https://chromewebstore.google.com/detail/dappscore"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-10 py-4 font-semibold text-black hover:bg-yellow-400 transition-colors text-lg"
          >
            <Chrome className="h-5 w-5" />
            Add to Chrome — free
          </a>
          <p className="mt-6 text-sm text-gray-500">
            Source code available on{' '}
            <a href="https://github.com/DappScore" target="_blank" rel="noopener noreferrer"
               className="text-gray-400 hover:text-yellow-500 underline underline-offset-2">
              GitHub
            </a>
          </p>
        </div>
      </section>

    </div>
  );
}
