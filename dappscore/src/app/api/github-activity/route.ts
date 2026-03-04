import { NextRequest, NextResponse } from 'next/server';

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

export async function GET(request: NextRequest) {
  const repoUrl = request.nextUrl.searchParams.get('repo');
  if (!repoUrl) {
    return NextResponse.json({ error: 'repo param required' }, { status: 400 });
  }

  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return NextResponse.json({ error: 'Not a valid GitHub URL' }, { status: 422 });
  }

  const { owner, repo } = parsed;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'DappScore-Platform',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      next: { revalidate: 3600 },
    });

    // 404 = private repo or doesn't exist — we treat both as "private" (neutral, no penalty)
    if (res.status === 404) {
      return NextResponse.json(
        { status: 'private', owner, repo },
        { headers: { 'Cache-Control': 'public, s-maxage=3600' } },
      );
    }

    if (!res.ok) {
      return NextResponse.json({ error: 'GitHub API error' }, { status: 502 });
    }

    const data = await res.json();
    const daysSinceLastPush = Math.floor(
      (Date.now() - new Date(data.pushed_at).getTime()) / 86_400_000,
    );

    return NextResponse.json(
      {
        status: 'public',
        owner,
        repo,
        stars: data.stargazers_count as number,
        forks: data.forks_count as number,
        pushedAt: data.pushed_at as string,
        createdAt: data.created_at as string,
        daysSinceLastPush,
        isForked: data.fork as boolean,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } },
    );
  } catch {
    return NextResponse.json({ error: 'GitHub fetch failed' }, { status: 500 });
  }
}
