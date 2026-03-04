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
  createdAt?: string;
  daysSinceLastPush?: number;
  isForked?: boolean;
}

type LoadState<T> = { state: 'idle' } | { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; msg: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

function domainRating(ageInDays: number): { label: string; color: string; icon: React.ReactNode; risk: 'low' | 'medium' | 'high' | 'critical' } {
  if (ageInDays >= 3 * 365) return { label: `${Math.floor(ageInDays / 365)} years old`, color: 'text-green-400', icon: <CheckCircle className="h-4 w-4" />, risk: 'low' };
  if (ageInDays >= 365)     return { label: `${Math.floor(ageInDays / 365)}yr ${Math.floor((ageInDays % 365) / 30)}mo old`, color: 'text-green-400', icon: <CheckCircle className="h-4 w-4" />, risk: 'low' };
  if (ageInDays >= 180)     return { label: `${Math.floor(ageInDays / 30)} months old`, color: 'text-yellow-400', icon: <Clock className="h-4 w-4" />, risk: 'medium' };
  if (ageInDays >= 90)      return { label: `${Math.floor(ageInDays / 30)} months old`, color: 'text-orange-400', icon: <AlertTriangle className="h-4 w-4" />, risk: 'high' };
  return { label: `Only ${ageInDays} days old`, color: 'text-red-400', icon: <AlertTriangle className="h-4 w-4" />, risk: 'critical' };
}

function githubRating(data: GitHubData): { label: string; sublabel: string; color: string; icon: React.ReactNode } {
  if (data.status === 'private') {
    return { label: 'Private Repo', sublabel: 'Source not public yet', color: 'text-gray-400', icon: <Lock className="h-4 w-4" /> };
  }
  const days = data.daysSinceLastPush ?? 9999;
  if (days <= 30)  return { label: 'Active', sublabel: `Last commit ${days}d ago`, color: 'text-green-400', icon: <CheckCircle className="h-4 w-4" /> };
  if (days <= 90)  return { label: 'Recent', sublabel: `Last commit ${days}d ago`, color: 'text-yellow-400', icon: <Clock className="h-4 w-4" /> };
  if (days <= 180) return { label: 'Slowing', sublabel: `Last commit ${days}d ago`, color: 'text-orange-400', icon: <Clock className="h-4 w-4" /> };
  return { label: 'Stale', sublabel: `Last commit ${days}d ago`, color: 'text-red-400', icon: <AlertTriangle className="h-4 w-4" /> };
}

function isValidGitHubUrl(url: string): boolean {
  return /github\.com\/[^/]+\/[^/]+/.test(url);
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  websiteUrl?: string;
  githubUrl?: string;
}

export default function ExternalSignalsPanel({ websiteUrl, githubUrl }: Props) {
  const [domain, setDomain] = useState<LoadState<DomainData>>({ state: 'idle' });
  const [github, setGithub] = useState<LoadState<GitHubData>>({ state: 'idle' });

  useEffect(() => {
    if (!websiteUrl) return;
    setDomain({ state: 'loading' });
    fetch(`/api/domain-age?domain=${encodeURIComponent(websiteUrl)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setDomain({ state: 'error', msg: data.error });
        else setDomain({ state: 'ok', data });
      })
      .catch(() => setDomain({ state: 'error', msg: 'Lookup failed' }));
  }, [websiteUrl]);

  useEffect(() => {
    if (!githubUrl || !isValidGitHubUrl(githubUrl)) return;
    setGithub({ state: 'loading' });
    fetch(`/api/github-activity?repo=${encodeURIComponent(githubUrl)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setGithub({ state: 'error', msg: data.error });
        else setGithub({ state: 'ok', data });
      })
      .catch(() => setGithub({ state: 'error', msg: 'Lookup failed' }));
  }, [githubUrl]);

  const hasAnything = websiteUrl || (githubUrl && isValidGitHubUrl(githubUrl));
  if (!hasAnything) return null;

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
        {githubUrl && isValidGitHubUrl(githubUrl) && (
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
        )}

        {/* No GitHub provided */}
        {(!githubUrl || !isValidGitHubUrl(githubUrl)) && (
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
        Domain data via ICANN RDAP. GitHub data cached hourly.
      </p>
    </div>
  );
}
