'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, CheckCircle, AlertTriangle, Lock, Wallet } from 'lucide-react';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Admin UI ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_WALLET;

  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAdmin) return;
    const initial: Record<string, boolean> = {};
    for (const f of FEATURE_CONFIGS) {
      initial[f.id] = getFeatureEnabled(f.id, f.defaultEnabled);
    }
    setFlags(initial);
  }, [isAdmin]);

  // Gate: not connected
  if (!isConnected) return <NotConnected />;

  // Gate: wrong wallet
  if (!isAdmin) return <AccessDenied address={address!} />;

  const toggle = (id: string) => {
    const next = !flags[id];
    setFlags((prev) => ({ ...prev, [id]: next }));
    setFeatureEnabled(id, next);
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    features: FEATURE_CONFIGS.filter((f) => f.category === cat),
  }));

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="flex items-center space-x-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to site</span>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Feature Flags</h1>
              <p className="text-gray-400 text-sm mt-1">Enable or disable individual features. Changes take effect immediately.</p>
            </div>
            <ConnectButton accountStatus="avatar" showBalance={false} />
          </div>
        </div>

        {/* Feature groups */}
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
                {features.map((f) => {
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
        </div>

        <p className="text-xs text-gray-600 mt-8 text-center">
          Flags stored in browser localStorage · Restricted to deployer wallet
        </p>
      </div>
    </div>
  );
}
