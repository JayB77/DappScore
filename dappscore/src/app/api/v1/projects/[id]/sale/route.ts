import { NextRequest, NextResponse } from 'next/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SaleData {
  raised: number;           // Amount raised so far (in `currency` units)
  goal: number;             // Hard cap (in `currency` units)
  currency: string;         // 'USDC' | 'ETH' | 'BNB' etc.
  tokenPrice: number;       // Price per token in USD
  startDate: number;        // Unix timestamp (seconds)
  endDate: number;          // Unix timestamp (seconds)
  minContribution?: number;
  maxContribution?: number;
  saleContract?: string;    // Optional: on-chain sale contract address
  network?: string;         // Chain name e.g. 'Ethereum', 'Base'
  updatedAt: number;        // Unix timestamp — last write
}

// ── In-memory store (swap for Firestore in production) ────────────────────────
// Each key is the project ID (string). Values are set by authenticated POSTs.

const store = new Map<string, SaleData>();

// ── API key validation ─────────────────────────────────────────────────────────
// SALE_API_KEYS is a JSON env var mapping projectId → apiKey.
// Example:  SALE_API_KEYS='{"42":"sk_sale_abc123","7":"sk_sale_xyz789"}'
// Project owners get their key from the admin panel or email on-boarding.

function validateApiKey(projectId: string, authHeader: string | null): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const providedKey = authHeader.slice(7).trim();

  let keys: Record<string, string> = {};
  try {
    keys = JSON.parse(process.env.SALE_API_KEYS ?? '{}');
  } catch {
    return false;
  }

  const expectedKey = keys[projectId];
  if (!expectedKey) return false;

  // Constant-time comparison to prevent timing attacks
  if (providedKey.length !== expectedKey.length) return false;
  let mismatch = 0;
  for (let i = 0; i < providedKey.length; i++) {
    mismatch |= providedKey.charCodeAt(i) ^ expectedKey.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── GET /api/v1/projects/[id]/sale ────────────────────────────────────────────
// Public — no auth required. Cached at the edge for 60 seconds.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = store.get(id);

  if (!data) {
    return NextResponse.json(
      { error: 'No sale data found for this project.' },
      {
        status: 404,
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
      },
    );
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
  });
}

// ── POST /api/v1/projects/[id]/sale ──────────────────────────────────────────
// Authenticated — project owner sends their API key as a Bearer token.
// Only writes numbers/strings — we never hold or transfer funds.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!validateApiKey(id, req.headers.get('Authorization'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: Partial<SaleData>;
  try {
    body = await req.json() as Partial<SaleData>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // ── Validate required fields ──────────────────────────────────────────────
  const { raised, goal, currency, tokenPrice, startDate, endDate } = body;

  if (
    typeof raised !== 'number' || raised < 0 ||
    typeof goal !== 'number' || goal <= 0 ||
    typeof currency !== 'string' || !currency.trim() ||
    typeof tokenPrice !== 'number' || tokenPrice <= 0 ||
    typeof startDate !== 'number' ||
    typeof endDate !== 'number' || endDate <= startDate
  ) {
    return NextResponse.json(
      {
        error: 'Missing or invalid fields.',
        required: { raised: 'number ≥ 0', goal: 'number > 0', currency: 'string', tokenPrice: 'number > 0', startDate: 'unix timestamp', endDate: 'unix timestamp > startDate' },
      },
      { status: 422 },
    );
  }

  // ── Sanitise optional fields ──────────────────────────────────────────────
  const saleData: SaleData = {
    raised,
    goal,
    currency: currency.trim().toUpperCase().slice(0, 10),
    tokenPrice,
    startDate,
    endDate,
    updatedAt: Math.floor(Date.now() / 1000),
  };

  if (typeof body.minContribution === 'number' && body.minContribution >= 0)
    saleData.minContribution = body.minContribution;
  if (typeof body.maxContribution === 'number' && body.maxContribution > 0)
    saleData.maxContribution = body.maxContribution;
  if (typeof body.saleContract === 'string' && /^0x[0-9a-fA-F]{40}$/.test(body.saleContract))
    saleData.saleContract = body.saleContract;
  if (typeof body.network === 'string' && body.network.trim())
    saleData.network = body.network.trim().slice(0, 50);

  store.set(id, saleData);

  return NextResponse.json({ ok: true, data: saleData }, { status: 200 });
}
