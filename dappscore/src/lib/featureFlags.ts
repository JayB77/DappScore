'use client';

import { useState, useEffect } from 'react';

// ── Feature definitions ───────────────────────────────────────────────────────

export type FeatureCategory = 'core' | 'signals' | 'social' | 'market';

export interface FeatureConfig {
  id: string;
  label: string;
  description: string;
  category: FeatureCategory;
  defaultEnabled: boolean;
  /** If the feature needs a third-party API key, describe it here */
  apiKey?: {
    envVar: string;
    label: string;
    getUrl: string;
  };
}

export const FEATURE_CONFIGS: FeatureConfig[] = [
  // ── Core ──────────────────────────────────────────────────────────────────
  {
    id: 'dappScore',
    label: 'DappScore Composite',
    description: 'Live 0–100 aggregate safety score combining all signals',
    category: 'core',
    defaultEnabled: true,
  },

  // ── Signals ───────────────────────────────────────────────────────────────
  {
    id: 'domainAge',
    label: 'Domain Age Check',
    description: 'RDAP lookup for domain registration date — no API key required',
    category: 'signals',
    defaultEnabled: true,
  },
  {
    id: 'githubActivity',
    label: 'GitHub Activity',
    description: 'Public GitHub API for commit recency and repo stats — no API key required',
    category: 'signals',
    defaultEnabled: true,
  },
  {
    id: 'contractFingerprint',
    label: 'Contract Fingerprint',
    description: 'Source verification, proxy detection, and deployer address via Etherscan-compatible APIs',
    category: 'signals',
    defaultEnabled: true,
  },

  // ── Social ────────────────────────────────────────────────────────────────
  {
    id: 'socialProof',
    label: 'Community Social Proof',
    description: 'Discord member/online count (public invite API) and Telegram link — positive signal only, never a penalty',
    category: 'social',
    defaultEnabled: true,
  },
  {
    id: 'twitterDisplay',
    label: 'Twitter/X Profile',
    description: 'Show project Twitter/X handle and link — no API key required',
    category: 'social',
    defaultEnabled: true,
  },
  {
    id: 'twitterVerification',
    label: 'Twitter/X Verification',
    description: 'Verify account age and follower count via Twitter API v2. Requires a Bearer Token from the Twitter Developer Portal.',
    category: 'social',
    defaultEnabled: false,
    apiKey: {
      envVar: 'NEXT_PUBLIC_TWITTER_BEARER_TOKEN',
      label: 'Twitter Bearer Token',
      getUrl: 'https://developer.twitter.com/en/portal/dashboard',
    },
  },

  // ── Market (upcoming features) ────────────────────────────────────────────
  {
    id: 'tokenSale',
    label: 'Token Sale Progress Bar',
    description: 'Raise progress, countdown timer, and token price. Data pushed by project owners via authenticated API key — DappScore never holds funds.',
    category: 'market',
    defaultEnabled: true,
  },
  {
    id: 'honeypotDetector',
    label: 'Honeypot Detector',
    description: 'Can the token actually be sold? Powered by honeypot.is — no API key required',
    category: 'market',
    defaultEnabled: false,
  },
  {
    id: 'dexLiquidity',
    label: 'DEX Liquidity Snapshot',
    description: 'Price, liquidity, volume, and buy/sell pressure via DexScreener — no API key required',
    category: 'market',
    defaultEnabled: false,
  },
  {
    id: 'tokenDistribution',
    label: 'Token Distribution',
    description: 'Top-10 holder concentration, whale risk, burn address detection via Ethplorer (free key, Ethereum only)',
    category: 'market',
    defaultEnabled: false,
  },
  {
    id: 'deployerHistory',
    label: 'Deployer Wallet History',
    description: 'Has this deployer wallet launched rugged projects before? Serial scammer detection',
    category: 'market',
    defaultEnabled: false,
  },
  {
    id: 'liquidityLock',
    label: 'Liquidity Lock Checker',
    description: 'Is the LP locked, for how long, and by whom? Via Team Finance / PinkLock',
    category: 'market',
    defaultEnabled: false,
  },
  {
    id: 'auditBadge',
    label: 'Audit Badge Registry',
    description: 'Security audit records from CertiK, Hacken, OpenZeppelin, Code4rena',
    category: 'market',
    defaultEnabled: false,
  },
  {
    id: 'whaleTracker',
    label: 'Whale Tracker',
    description: 'Top token transfers in the last 24h — spot large wallet movements and burn events. Powered by Alchemy Asset Transfers API.',
    category: 'market',
    defaultEnabled: false,
  },
];

// ── Storage helpers ───────────────────────────────────────────────────────────

const PREFIX = 'dappscore_feat_';

export function getFeatureEnabled(id: string, defaultEnabled: boolean): boolean {
  if (typeof window === 'undefined') return defaultEnabled;
  const stored = localStorage.getItem(PREFIX + id);
  return stored !== null ? stored === 'true' : defaultEnabled;
}

export function setFeatureEnabled(id: string, enabled: boolean): void {
  localStorage.setItem(PREFIX + id, String(enabled));
  // Notify other hooks on the same page via a synthetic storage event
  window.dispatchEvent(
    new StorageEvent('storage', { key: PREFIX + id, newValue: String(enabled) }),
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useFeatureFlag(id: string, defaultEnabled = true): boolean {
  // Start with defaultEnabled so server and client render identically (no hydration mismatch).
  // After mount, sync from localStorage and listen for admin-page changes.
  const [enabled, setEnabled] = useState<boolean>(defaultEnabled);

  useEffect(() => {
    setEnabled(getFeatureEnabled(id, defaultEnabled));
    const sync = () => setEnabled(getFeatureEnabled(id, defaultEnabled));
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [id, defaultEnabled]);

  return enabled;
}
