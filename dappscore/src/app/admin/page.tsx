'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import {
  FEATURE_CONFIGS,
  getFeatureEnabled,
  setFeatureEnabled,
  type FeatureCategory,
} from '@/lib/featureFlags';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  core:    'Core',
  signals: 'Trust Signals',
  social:  'Social',
  market:  'Market & Safety',
};

const CATEGORY_ORDER: FeatureCategory[] = ['core', 'signals', 'social', 'market'];

function hasEnvKey(envVar: string): boolean {
  const val = (process.env as Record<string, string | undefined>)[envVar];
  return !!(val && val.trim().length > 0);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  // Map of id → enabled
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const f of FEATURE_CONFIGS) {
      initial[f.id] = getFeatureEnabled(f.id, f.defaultEnabled);
    }
    setFlags(initial);
  }, []);

  const toggle = (id: string, defaultEnabled: boolean) => {
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
          <h1 className="text-2xl font-bold">Feature Flags</h1>
          <p className="text-gray-400 text-sm mt-1">
            Enable or disable individual features. Changes take effect immediately.
            Useful if a third-party API goes down.
          </p>
        </div>

        {/* Feature groups */}
        <div className="space-y-8">
          {grouped.map(({ category, features }) => (
            <div key={category}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="space-y-2">
                {features.map((f) => {
                  const enabled = flags[f.id] ?? f.defaultEnabled;
                  const apiKeyPresent = f.apiKey ? hasEnvKey(f.apiKey.envVar) : null;

                  return (
                    <div
                      key={f.id}
                      className={`bg-gray-800 rounded-xl p-4 border transition-colors ${
                        enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'
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

                          {/* API key status */}
                          {f.apiKey && (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
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

                        {/* Toggle */}
                        <button
                          onClick={() => toggle(f.id, f.defaultEnabled)}
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

        {/* Footer note */}
        <p className="text-xs text-gray-600 mt-8 text-center">
          Flags are stored in your browser's localStorage · Keep this URL private
        </p>
      </div>
    </div>
  );
}
