'use client';

import { useEffect, useState } from 'react';
import {
  Globe, Github, Loader2, AlertTriangle, CheckCircle, Clock,
  Lock, GitFork, Star, Twitter, ExternalLink,
} from 'lucide-react';
import {
  fetchDomainAge,
  fetchGitHubActivity,
  extractRootDomain,
  parseGitHubUrl,
  type DomainData,
  type GitHubData,
} from '@/lib/externalSignals';
import { useFeatureFlag } from '@/lib/featureFlags';
import type { LoadState } from '@/lib/useProjectSignals';

// ── Twitter helpers ───────────────────────────────────────────────────────────

function parseTwitterHandle(url: string): string | null {
  if (!url || url === '#') return null;
  // Accept full URL or bare handle
  const match = url.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/);
  if (match) return match[1];
  // bare @handle or handle
  const bare = url.replace(/^@/, '').trim();
  if (/^[A-Za-z0-9_]{1,50}$/.test(bare)) return bare;
  return null;
}

// ── Ratings ───────────────────────────────────────────────────────────────────

function domainRating(ageInDays: number) {
  if (ageInDays >= 3 * 365) return { label: `${Math.floor(ageInDays / 365)} years old`,                                        color: 'text-green-400',  icon: <CheckCircle className="h-4 w-4" />, risk: 'low' as const };
  if (ageInDays >= 365)     return { label: `${Math.floor(ageInDays / 365)}yr ${Math.floor((ageInDays % 365) / 30)}mo old`,   color: 'text-green-400',  icon: <CheckCircle className="h-4 w-4" />, risk: 'low' as const };
  if (ageInDays >= 180)     return { label: `${Math.floor(ageInDays / 30)} months old`,                                        color: 'text-yellow-400', icon: <Clock className="h-4 w-4" />,        risk: 'medium' as const };
  if (ageInDays >= 90)      return { label: `${Math.floor(ageInDays / 30)} months old`,                                        color: 'text-orange-400', icon: <AlertTriangle className="h-4 w-4" />, risk: 'high' as const };
  return                           { label: `Only ${ageInDays} days old`,                                                      color: 'text-red-400',    icon: <AlertTriangle className="h-4 w-4" />, risk: 'critical' as const };
}

function githubRating(data: GitHubData) {
  if (data.status === 'private') return { label: 'Private Repo', sublabel: 'Source not public yet', color: 'text-gray-400',  icon: <Lock className="h-4 w-4" /> };
  const days = data.daysSinceLastPush ?? 9999;
  if (days <= 30)  return { label: 'Active',   sublabel: `Last commit ${days}d ago`, color: 'text-green-400',  icon: <CheckCircle className="h-4 w-4" /> };
  if (days <= 90)  return { label: 'Recent',   sublabel: `Last commit ${days}d ago`, color: 'text-yellow-400', icon: <Clock className="h-4 w-4" /> };
  if (days <= 180) return { label: 'Slowing',  sublabel: `Last commit ${days}d ago`, color: 'text-orange-400', icon: <Clock className="h-4 w-4" /> };
  return                  { label: 'Stale',    sublabel: `Last commit ${days}d ago`, color: 'text-red-400',    icon: <AlertTriangle className="h-4 w-4" /> };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  websiteUrl?: string;
  githubUrl?: string;
  twitterUrl?: string;
  preloaded?: {
    domain: LoadState<DomainData>;
    github: LoadState<GitHubData>;
  };
}

export default function ExternalSignalsPanel({ websiteUrl, githubUrl, twitterUrl, preloaded }: Props) {
  const [domain, setDomain] = useState<LoadState<DomainData>>({ state: 'idle' });
  const [github, setGithub] = useState<LoadState<GitHubData>>({ state: 'idle' });

  const showDomain        = useFeatureFlag('domainAge', true);
  const showGithub        = useFeatureFlag('githubActivity', true);
  const showTwitter       = useFeatureFlag('twitterDisplay', true);
  const twitterVerifyOn   = useFeatureFlag('twitterVerification', false);

  const domainState = preloaded ? preloaded.domain : domain;
  const githubState = preloaded ? preloaded.github : github;

  const validGithubUrl = githubUrl && parseGitHubUrl(githubUrl) ? githubUrl : undefined;
  const twitterHandle  = twitterUrl ? parseTwitterHandle(twitterUrl) : null;
  const hasApiToken    = !!(process.env.NEXT_PUBLIC_TWITTER_BEARER_TOKEN?.trim());

  // Domain self-fetch (when no preloaded data)
  useEffect(() => {
    if (preloaded || !websiteUrl) return;
    const root = extractRootDomain(websiteUrl);
    if (!root.includes('.') || root.endsWith('.eth') || root.endsWith('.sol')) return;
    setDomain({ state: 'loading' });
    fetchDomainAge(websiteUrl)
      .then((data) => setDomain({ state: 'ok', data }))
      .catch(() => setDomain({ state: 'error' }));
  }, [websiteUrl, preloaded]);

  // GitHub self-fetch
  useEffect(() => {
    if (preloaded || !validGithubUrl) return;
    setGithub({ state: 'loading' });
    fetchGitHubActivity(validGithubUrl)
      .then((data) => setGithub({ state: 'ok', data }))
      .catch(() => setGithub({ state: 'error' }));
  }, [validGithubUrl, preloaded]);

  const hasAnything = (showDomain && websiteUrl) || (showGithub && validGithubUrl) || (showTwitter && twitterHandle);
  if (!hasAnything) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-gray-400">External Signals</h3>

      <div className="space-y-4">

        {/* ── Domain Age ── */}
        {showDomain && websiteUrl && (
          <div className="flex items-start space-x-3">
            <div className="mt-0.5 p-2 bg-gray-700 rounded-lg">
              <Globe className="h-4 w-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-300 mb-0.5">Domain Age</div>
              {domainState.state === 'loading' && (
                <div className="flex items-center space-x-1 text-gray-500 text-sm"><Loader2 className="h-3 w-3 animate-spin" /><span>Checking...</span></div>
              )}
              {domainState.state === 'ok' && (() => {
                const rating = domainRating(domainState.data.ageInDays);
                return (
                  <div className={`flex items-center space-x-1 text-sm ${rating.color}`}>
                    {rating.icon}<span>{rating.label}</span>
                    {rating.risk === 'critical' && <span className="ml-1 px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">RED FLAG</span>}
                    {rating.risk === 'high'     && <span className="ml-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">CAUTION</span>}
                  </div>
                );
              })()}
              {domainState.state === 'error' && <span className="text-gray-500 text-sm">Unable to verify</span>}
            </div>
          </div>
        )}

        {/* ── GitHub Activity ── */}
        {showGithub && (
          validGithubUrl ? (
            <div className="flex items-start space-x-3">
              <div className="mt-0.5 p-2 bg-gray-700 rounded-lg">
                <Github className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-300 mb-0.5">GitHub Activity</div>
                {githubState.state === 'loading' && (
                  <div className="flex items-center space-x-1 text-gray-500 text-sm"><Loader2 className="h-3 w-3 animate-spin" /><span>Checking...</span></div>
                )}
                {githubState.state === 'ok' && (() => {
                  const rating = githubRating(githubState.data);
                  return (
                    <div>
                      <div className={`flex items-center space-x-1 text-sm ${rating.color}`}>{rating.icon}<span className="font-medium">{rating.label}</span></div>
                      <div className="text-xs text-gray-500 mt-0.5">{rating.sublabel}</div>
                      {githubState.data.status === 'public' && (
                        <div className="flex items-center space-x-3 mt-1.5">
                          {githubState.data.stars !== undefined && (
                            <span className="flex items-center space-x-1 text-xs text-gray-400"><Star className="h-3 w-3" /><span>{githubState.data.stars.toLocaleString('en-US')}</span></span>
                          )}
                          {githubState.data.forks !== undefined && (
                            <span className="flex items-center space-x-1 text-xs text-gray-400"><GitFork className="h-3 w-3" /><span>{githubState.data.forks.toLocaleString('en-US')}</span></span>
                          )}
                          {githubState.data.isForked && (
                            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">Forked repo</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {githubState.state === 'error' && <span className="text-gray-500 text-sm">Unable to verify</span>}
              </div>
            </div>
          ) : (
            <div className="flex items-start space-x-3">
              <div className="mt-0.5 p-2 bg-gray-700 rounded-lg"><Github className="h-4 w-4 text-gray-400" /></div>
              <div className="flex-1"><div className="text-sm font-medium text-gray-300 mb-0.5">GitHub</div><span className="text-gray-500 text-sm">Not provided</span></div>
            </div>
          )
        )}

        {/* ── Twitter/X ── */}
        {showTwitter && (
          twitterHandle ? (
            <div className="flex items-start space-x-3">
              <div className="mt-0.5 p-2 bg-gray-700 rounded-lg">
                <Twitter className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-300 mb-0.5">Twitter / X</div>
                <a
                  href={`https://x.com/${twitterHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <span>@{twitterHandle}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                {twitterVerifyOn ? (
                  hasApiToken ? (
                    <span className="mt-1 inline-flex items-center space-x-1 text-xs text-yellow-400">
                      <CheckCircle className="h-3 w-3" />
                      <span>API connected — add proxy route to activate</span>
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex items-center space-x-1 text-xs text-orange-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Set NEXT_PUBLIC_TWITTER_BEARER_TOKEN to verify</span>
                    </span>
                  )
                ) : (
                  <span className="mt-1 inline-block text-xs text-gray-600">Not API-verified</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start space-x-3">
              <div className="mt-0.5 p-2 bg-gray-700 rounded-lg"><Twitter className="h-4 w-4 text-gray-400" /></div>
              <div className="flex-1"><div className="text-sm font-medium text-gray-300 mb-0.5">Twitter / X</div><span className="text-gray-500 text-sm">Not provided</span></div>
            </div>
          )
        )}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        Domain via ICANN RDAP · GitHub via public API · Twitter display only
      </p>
    </div>
  );
}
