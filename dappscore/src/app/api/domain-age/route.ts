import { NextRequest, NextResponse } from 'next/server';

function extractRootDomain(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];
}

export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get('domain');
  if (!domain) {
    return NextResponse.json({ error: 'domain param required' }, { status: 400 });
  }

  const rootDomain = extractRootDomain(domain);

  // Reject obviously non-web domains (ENS, .sol, etc.)
  if (!rootDomain.includes('.') || rootDomain.endsWith('.eth') || rootDomain.endsWith('.sol')) {
    return NextResponse.json({ error: 'Non-standard domain' }, { status: 422 });
  }

  try {
    const res = await fetch(`https://rdap.org/domain/${rootDomain}`, {
      headers: { Accept: 'application/rdap+json' },
      // Next.js fetch cache — revalidate once per day
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Domain not found in RDAP' }, { status: 404 });
    }

    const data = await res.json();
    const events: { eventAction: string; eventDate: string }[] = data.events ?? [];

    const registration = events.find((e) => e.eventAction === 'registration');
    const expiry = events.find((e) => e.eventAction === 'expiration');

    if (!registration) {
      return NextResponse.json({ error: 'Registration date unavailable' }, { status: 404 });
    }

    const registeredAt = new Date(registration.eventDate);
    const ageInDays = Math.floor((Date.now() - registeredAt.getTime()) / 86_400_000);

    return NextResponse.json(
      {
        domain: rootDomain,
        registeredAt: registration.eventDate,
        expiresAt: expiry?.eventDate ?? null,
        ageInDays,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } },
    );
  } catch {
    return NextResponse.json({ error: 'RDAP lookup failed' }, { status: 500 });
  }
}
