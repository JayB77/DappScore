'use client';

import { useEffect, useState } from 'react';
import {
  fetchDomainAge,
  fetchGitHubActivity,
  extractRootDomain,
  parseGitHubUrl,
  type DomainData,
  type GitHubData,
} from './externalSignals';
import {
  fetchContractInfo,
  hasApiSupport,
  getChainConfig,
  type ContractInfo,
} from './chainAdapters';

// ── Types ────────────────────────────────────────────────────────────────────

export type LoadState<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; data: T }
  | { state: 'error' };

export interface ContractAddress {
  chain: string;
  address: string;
}

export interface ProjectSignals {
  domain: LoadState<DomainData>;
  github: LoadState<GitHubData>;
  /** keyed by `"chain:address"` */
  contracts: Record<string, LoadState<ContractInfo>>;
}

// ── Scoring helpers (also used by DappScorePanel) ────────────────────────────

export interface ScoreBreakdown {
  label: string;
  score: number;
  max: number;
  detail: string;
}

export interface CompositeScore {
  total: number;          // 0–100
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: ScoreBreakdown[];
  isReady: boolean;       // false while any signal is still loading
}

function gradeFor(total: number): CompositeScore['grade'] {
  if (total >= 85) return 'S';
  if (total >= 70) return 'A';
  if (total >= 55) return 'B';
  if (total >= 40) return 'C';
  if (total >= 25) return 'D';
  return 'F';
}

export function computeScore(
  signals: ProjectSignals,
  project: {
    upvotes: number;
    downvotes: number;
    team?: unknown[];
    whitepaperUrl?: string;
    socialLinks?: Record<string, string>;
  },
): CompositeScore {
  const breakdown: ScoreBreakdown[] = [];

  // ── 1. Contract verification (25 pts) ───────────────────────────────────
  const contractEntries = Object.values(signals.contracts);
  const isContractsLoading = contractEntries.some((c) => c.state === 'loading');
  let contractScore = 0;
  let contractDetail = 'No contracts listed';
  if (contractEntries.length > 0) {
    const resolved = contractEntries.filter((c) => c.state === 'ok') as { state: 'ok'; data: ContractInfo }[];
    const verified = resolved.filter((c) => c.data.verified).length;
    const total = contractEntries.length;
    if (resolved.length === 0) {
      contractScore = 0;
      contractDetail = isContractsLoading ? 'Checking...' : 'Unable to verify';
    } else if (verified === total) {
      contractScore = 25;
      contractDetail = 'All contracts verified';
    } else if (verified > 0) {
      contractScore = 12;
      contractDetail = `${verified}/${total} contracts verified`;
    } else {
      contractScore = 0;
      contractDetail = 'No contracts verified';
    }
  } else {
    contractScore = 5; // neutral — no contracts provided yet
    contractDetail = 'No contracts listed';
  }
  breakdown.push({ label: 'Contract Verification', score: contractScore, max: 25, detail: contractDetail });

  // ── 2. Domain credibility (20 pts) ───────────────────────────────────────
  let domainScore = 0;
  let domainDetail = '';
  if (signals.domain.state === 'loading') {
    domainDetail = 'Checking...';
  } else if (signals.domain.state === 'ok') {
    const age = signals.domain.data.ageInDays;
    if (age >= 2 * 365)      { domainScore = 20; domainDetail = `Domain ${Math.floor(age / 365)} yrs old`; }
    else if (age >= 365)     { domainScore = 15; domainDetail = `Domain ${Math.floor(age / 365)} yr old`; }
    else if (age >= 180)     { domainScore = 8;  domainDetail = `Domain ${Math.floor(age / 30)} mo old`; }
    else if (age >= 90)      { domainScore = 3;  domainDetail = `Domain only ${Math.floor(age / 30)} mo old`; }
    else                     { domainScore = 0;  domainDetail = `Domain only ${age} days old`; }
  } else if (signals.domain.state === 'error') {
    domainScore = 5; // unresolvable — mild penalty but not zero (might be a new gTLD)
    domainDetail = 'Unable to verify';
  } else {
    domainScore = 5;
    domainDetail = 'No website provided';
  }
  breakdown.push({ label: 'Domain Credibility', score: domainScore, max: 20, detail: domainDetail });

  // ── 3. Development activity (20 pts) ─────────────────────────────────────
  let devScore = 0;
  let devDetail = '';
  if (signals.github.state === 'loading') {
    devDetail = 'Checking...';
  } else if (signals.github.state === 'ok') {
    const gh = signals.github.data;
    if (gh.status === 'private') {
      devScore = 8;
      devDetail = 'Private repository';
    } else {
      const days = gh.daysSinceLastPush ?? 9999;
      if (days <= 30)       { devScore = 20; devDetail = `Active — last commit ${days}d ago`; }
      else if (days <= 90)  { devScore = 15; devDetail = `Recent — last commit ${days}d ago`; }
      else if (days <= 180) { devScore = 8;  devDetail = `Slowing — last commit ${days}d ago`; }
      else                  { devScore = 2;  devDetail = `Stale — last commit ${days}d ago`; }
    }
  } else if (signals.github.state === 'error') {
    devScore = 0;
    devDetail = 'Unable to check';
  } else {
    devScore = 0;
    devDetail = 'No GitHub provided';
  }
  breakdown.push({ label: 'Dev Activity', score: devScore, max: 20, detail: devDetail });

  // ── 4. Community trust (20 pts) ──────────────────────────────────────────
  const totalVotes = project.upvotes + project.downvotes;
  let communityScore = 0;
  let communityDetail = '';
  if (totalVotes < 5) {
    communityScore = 10; // not enough votes to penalise or reward
    communityDetail = 'Too few votes';
  } else {
    const pct = (project.upvotes / totalVotes) * 100;
    if (pct >= 80)      { communityScore = 20; communityDetail = `${Math.round(pct)}% trust`; }
    else if (pct >= 60) { communityScore = 12; communityDetail = `${Math.round(pct)}% trust`; }
    else if (pct >= 40) { communityScore = 5;  communityDetail = `${Math.round(pct)}% trust`; }
    else                { communityScore = 0;  communityDetail = `${Math.round(pct)}% trust — low`; }
  }
  breakdown.push({ label: 'Community Trust', score: communityScore, max: 20, detail: communityDetail });

  // ── 5. Project completeness (15 pts) ─────────────────────────────────────
  let completenessScore = 0;
  const socialLinks = project.socialLinks ?? {};
  const hasTeam = Array.isArray(project.team) && project.team.length > 0;
  const hasWhitepaper = !!project.whitepaperUrl;
  const socialCount = Object.values(socialLinks).filter((v) => v && v !== '#').length;

  if (hasTeam) completenessScore += 5;
  if (hasWhitepaper) completenessScore += 5;
  if (socialCount >= 3) completenessScore += 5;
  else if (socialCount >= 1) completenessScore += 2;

  const completenessDetail = [
    hasTeam ? 'Team ✓' : 'No team',
    hasWhitepaper ? 'Whitepaper ✓' : 'No whitepaper',
    socialCount >= 3 ? 'Socials ✓' : `${socialCount} socials`,
  ].join(' · ');

  breakdown.push({ label: 'Completeness', score: completenessScore, max: 15, detail: completenessDetail });

  // ── Total ─────────────────────────────────────────────────────────────────
  const total = breakdown.reduce((sum, b) => sum + b.score, 0);
  const isReady = !isContractsLoading
    && signals.domain.state !== 'loading'
    && signals.github.state !== 'loading';

  return { total, grade: gradeFor(total), breakdown, isReady };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useProjectSignals(
  websiteUrl: string | undefined,
  githubUrl: string | undefined,
  contractAddresses: ContractAddress[],
): ProjectSignals {
  const [signals, setSignals] = useState<ProjectSignals>({
    domain: { state: 'idle' },
    github: { state: 'idle' },
    contracts: {},
  });

  // Domain
  useEffect(() => {
    if (!websiteUrl) return;
    const root = extractRootDomain(websiteUrl);
    if (!root.includes('.') || root.endsWith('.eth') || root.endsWith('.sol')) return;
    setSignals((s) => ({ ...s, domain: { state: 'loading' } }));
    fetchDomainAge(websiteUrl)
      .then((data) => setSignals((s) => ({ ...s, domain: { state: 'ok', data } })))
      .catch(() => setSignals((s) => ({ ...s, domain: { state: 'error' } })));
  }, [websiteUrl]);

  // GitHub
  useEffect(() => {
    if (!githubUrl || !parseGitHubUrl(githubUrl)) return;
    setSignals((s) => ({ ...s, github: { state: 'loading' } }));
    fetchGitHubActivity(githubUrl)
      .then((data) => setSignals((s) => ({ ...s, github: { state: 'ok', data } })))
      .catch(() => setSignals((s) => ({ ...s, github: { state: 'error' } })));
  }, [githubUrl]);

  // Contracts — all in parallel
  useEffect(() => {
    for (const { chain, address } of contractAddresses) {
      if (!chain || !address) continue;
      const key = `${chain}:${address}`;
      const config = getChainConfig(chain);

      if (!config || !hasApiSupport(chain)) {
        // skip unsupported / no-api — don't mark as loading
        continue;
      }

      setSignals((s) => ({
        ...s,
        contracts: { ...s.contracts, [key]: { state: 'loading' } },
      }));

      fetchContractInfo(chain, address)
        .then((data) =>
          setSignals((s) => ({
            ...s,
            contracts: { ...s.contracts, [key]: { state: 'ok', data } },
          })),
        )
        .catch(() =>
          setSignals((s) => ({
            ...s,
            contracts: { ...s.contracts, [key]: { state: 'error' } },
          })),
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return signals;
}
