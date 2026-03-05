// Shared types and fetch logic for domain + GitHub signals.
// Used by ExternalSignalsPanel (display) and useProjectSignals (composite score).

// ── Types ────────────────────────────────────────────────────────────────────

export interface DomainData {
  domain: string;
  registeredAt: string;
  expiresAt: string | null;
  ageInDays: number;
}

export interface GitHubData {
  status: 'public' | 'private';
  owner: string;
  repo: string;
  stars?: number;
  forks?: number;
  pushedAt?: string;
  daysSinceLastPush?: number;
  isForked?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function extractRootDomain(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

export async function fetchDomainAge(websiteUrl: string): Promise<DomainData> {
  const rootDomain = extractRootDomain(websiteUrl);
  const res = await fetch(`https://rdap.org/domain/${rootDomain}`, {
    headers: { Accept: 'application/rdap+json' },
  });
  if (!res.ok) throw new Error('not found');
  const data = await res.json() as {
    events?: { eventAction: string; eventDate: string }[];
  };
  const events = data.events ?? [];
  const registration = events.find((e) => e.eventAction === 'registration');
  const expiry = events.find((e) => e.eventAction === 'expiration');
  if (!registration) throw new Error('no registration date');
  const ageInDays = Math.floor(
    (Date.now() - new Date(registration.eventDate).getTime()) / 86_400_000,
  );
  return {
    domain: rootDomain,
    registeredAt: registration.eventDate,
    expiresAt: expiry?.eventDate ?? null,
    ageInDays,
  };
}

export async function fetchGitHubActivity(githubUrl: string): Promise<GitHubData> {
  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) throw new Error('invalid url');
  const { owner, repo } = parsed;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });
  if (res.status === 404) return { status: 'private', owner, repo };
  if (!res.ok) throw new Error('api error');
  const data = await res.json() as {
    stargazers_count: number;
    forks_count: number;
    pushed_at: string;
    fork: boolean;
  };
  const daysSinceLastPush = Math.floor(
    (Date.now() - new Date(data.pushed_at).getTime()) / 86_400_000,
  );
  return {
    status: 'public',
    owner,
    repo,
    stars: data.stargazers_count,
    forks: data.forks_count,
    pushedAt: data.pushed_at,
    daysSinceLastPush,
    isForked: data.fork,
  };
}
