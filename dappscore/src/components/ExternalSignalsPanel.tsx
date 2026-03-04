'use client';

import { useEffect, useState } from 'react';
import { Globe, Github, Loader2, AlertTriangle, CheckCircle, Clock, Lock, GitFork, Star } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface DomainData {
  domain: string;
  registeredAt: string;
  expiresAt: string | null;
  ageInDays: number;
}

interface GitHubData {
  status: 'public' | 'private';
  owner: string;
  repo: string;
  stars?: number;
  forks?: number;
  pushedAt?: string;
  daysSinceLastPush?: number;
  isForked?: boolean;
}

type LoadState<T> = { state: 'idle' } | { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error' };

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractRootDomain(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

function domainRating(ageInDays: number) {
  if (ageInDays >= 3 * 365) return { label: `${Math.floor(ageInDays / 365)} years old`, color: 'text-green-400', icon: <CheckCircle className="h-4 w-4" />, risk: 'low' as const };
  if (ageInDays >= 365)     return { label: `${Math.floor(ageInDays / 365)}yr ${Math.floor((ageInDays % 365) / 30)}mo old`, color: 'text-green-400', icon: <CheckCircle className="h-4 w-4" />, risk: 'low' as const };
  if (ageInDays >= 180)     return { label: `${Math.floor(ageInDays / 30)} months old`, color: 'text-yellow-400', icon: <Clock className="h-4 w-4" />, risk: 'medium' as const };
  if (ageInDays >= 90)      return { label: `${Math.floor(ageInDays / 30)} months old`, color: 'text-orange-400', icon: <AlertTriangle className="h-4 w-4" />, risk: 'high' as const };
  return { label: `Only ${ageInDays} days old`, color: 'text-red-400', icon: <AlertTriangle className="h-4 w-4" />, risk: 'critical' as const };
}

function githubRating(data: GitHubData) {
  if (data.status === 'private') {
    return { label: 'Private Repo', sublabel: 'Source not public yet', color: 'text-gray-400', icon: <Lock className="h-4 w-4" /> };
  }
  const days = data.daysSinceLastPush ?? 9999;
  if (days <= 30)  return { label: 'Active', sublabel: `Last commit ${days}d ago`, color: 'text-green-400', icon: <CheckCircle className="h-4 w-4" /> };
  if (days <= 90)  return { label: 'Recent', sublabel: `Last commit ${days}d ago`, color: 'text-yellow-400', icon: <Clock className="h-4 w-4" /> };
  if (days <= 180) return { label: 'Slowing', sublabel: `Last commit ${days}d ago`, color: 'text-orange-400', icon: <Clock className="h-4 w-4" /> };
  return { label: 'Stale', sublabel: `Last commit ${days}d ago`, color: 'text-red-400', icon: <AlertTriangle className="h-4 w-4" /> };
}

// ── Data fetchers (called directly from the browser; both APIs support CORS) ─

async function fetchDomainAge(websiteUrl: string): Promise<DomainData> {
  const rootDomain = extractRootDomain(websiteUrl);
  const res = await fetch(`https://rdap.org/domain/${rootDomain}`, {
    headers: { Accept: 'application/rdap+json' },
  });
  if (!res.ok) throw new Error('not found');
  const data = await res.json();
  const events: { eventAction: string; eventDate: string }[] = data.events ?? [];
  const registration = events.find((e) => e.eventAction === 'registration');
  const expiry = events.find((e) => e.eventAction === 'expiration');
  if (!registration) throw new Error('no registration date');
  const ageInDays = Math.floor((Date.now() - new Date(registration.eventDate).getTime()) / 86_400_000);
  return { domain: rootDomain, registeredAt: registration.eventDate, expiresAt: expiry?.eventDate ?? null, ageInDays };
}

async function fetchGitHubActivity(githubUrl: string): Promise<GitHubData> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) throw new Error('invalid url');
  const { owner, repo } = parsed;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });
  if (res.status === 404) return { status: 'private', owner, repo };
  if (!res.ok) throw new Error('api error');
  const data = await res.json();
  const daysSinceLastPush = Math.floor((Date.now() - new Date(data.pushed_at).getTime()) / 86_400_000);
  return {
    status: 'public',
    owner,
    repo,
    stars: data.stargazers_count as number,
    forks: data.forks_count as number,
    pushedAt: data.pushed_at as string,
    daysSinceLastPush,
    isForked: data.fork as boolean,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  websiteUrl?: string;
  githubUrl?: string;
}

export default function ExternalSignalsPanel({ websiteUrl, githubUrl }: Props) {
  const [domain, setDomain] = useState<LoadState<DomainData>>({ state: 'idle' });
  const [github, setGithub] = useState<LoadState<GitHubData>>({ state: 'idle' });

  const validGithubUrl = githubUrl && parseGitHubUrl(githubUrl) ? githubUrl : undefined;

  useEffect(() => {
    if (!websiteUrl) return;
    const rootDomain = extractRootDomain(websiteUrl);
    if (!rootDomain.includes('.') || rootDomain.endsWith('.eth') || rootDomain.endsWith('.sol')) return;
    setDomain({ state: 'loading' });
    fetchDomainAge(websiteUrl)
      .then((data) => setDomain({ state: 'ok', data }))
      .catch(() => setDomain({ state: 'error' }));
  }, [websiteUrl]);

  useEffect(() => {
    if (!validGithubUrl) return;
    setGithub({ state: 'loading' });
    fetchGitHubActivity(validGithubUrl)
      .then((data) => setGithub({ state: 'ok', data }))
      .catch(() => setGithub({ state: 'error' }));
  }, [validGithubUrl]);

  if (!websiteUrl && !validGithubUrl) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-gray-400">External Signals</h3>

      <div className="space-y-4">
        {/* Domain Age */}
        {websiteUrl && (
          <div className="flex items-start space-x-3">
            <div className="mt-0.5 p-2 bg-gray-700 rounded-lg">
              <Globe className="h-4 w-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-300 mb-0.5">Domain Age</div>
              {domain.state === 'loading' && (
                <div className="flex items-center space-x-1 text-gray-500 text-sm">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Checking...</span>
                </div>
              )}
              {domain.state === 'ok' && (() => {
                const rating = domainRating(domain.data.ageInDays);
                return (
                  <div className={`flex items-center space-x-1 text-sm ${rating.color}`}>
                    {rating.icon}
                    <span>{rating.label}</span>
                    {rating.risk === 'critical' && (
                      <span className="ml-1 px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">RED FLAG</span>
                    )}
                    {rating.risk === 'high' && (
                      <span className="ml-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">CAUTION</span>
                    )}
                  </div>
                );
              })()}
              {domain.state === 'error' && (
                <span className="text-gray-500 text-sm">Unable to verify</span>
              )}
            </div>
          </div>
        )}

        {/* GitHub Activity */}
        {validGithubUrl ? (
          <div className="flex items-start space-x-3">
            <div className="mt-0.5 p-2 bg-gray-700 rounded-lg">
              <Github className="h-4 w-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-300 mb-0.5">GitHub Activity</div>
              {github.state === 'loading' && (
                <div className="flex items-center space-x-1 text-gray-500 text-sm">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Checking...</span>
                </div>
              )}
              {github.state === 'ok' && (() => {
                const rating = githubRating(github.data);
                return (
                  <div>
                    <div className={`flex items-center space-x-1 text-sm ${rating.color}`}>
                      {rating.icon}
                      <span className="font-medium">{rating.label}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{rating.sublabel}</div>
                    {github.data.status === 'public' && (
                      <div className="flex items-center space-x-3 mt-1.5">
                        {github.data.stars !== undefined && (
                          <span className="flex items-center space-x-1 text-xs text-gray-400">
                            <Star className="h-3 w-3" />
                            <span>{github.data.stars.toLocaleString()}</span>
                          </span>
                        )}
                        {github.data.forks !== undefined && (
                          <span className="flex items-center space-x-1 text-xs text-gray-400">
                            <GitFork className="h-3 w-3" />
                            <span>{github.data.forks.toLocaleString()}</span>
                          </span>
                        )}
                        {github.data.isForked && (
                          <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">Forked repo</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              {github.state === 'error' && (
                <span className="text-gray-500 text-sm">Unable to verify</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start space-x-3">
            <div className="mt-0.5 p-2 bg-gray-700 rounded-lg">
              <Github className="h-4 w-4 text-gray-400" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-300 mb-0.5">GitHub</div>
              <span className="text-gray-500 text-sm">Not provided</span>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Domain data via ICANN RDAP · GitHub data via public API
      </p>
    </div>
  );
}
