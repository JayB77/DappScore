/**
 * Alchemy REST client — no native-module SDK required (Node 20 native fetch).
 *
 * Alchemy issues a separate API key per network/app. Configure each one
 * individually; the generic ALCHEMY_API_KEY is used as a fallback when a
 * network-specific key is absent.
 *
 * Env vars (all optional except at least one must be set):
 *   ALCHEMY_API_KEY            — fallback key used for any unspecified network
 *   ALCHEMY_API_KEY_MAINNET    — Ethereum mainnet
 *   ALCHEMY_API_KEY_POLYGON    — Polygon PoS
 *   ALCHEMY_API_KEY_BSC        — BNB Chain
 *   ALCHEMY_API_KEY_BASE       — Base
 *   ALCHEMY_API_KEY_ARBITRUM   — Arbitrum One
 *   ALCHEMY_API_KEY_OPTIMISM   — Optimism
 *   ALCHEMY_API_KEY_ZKSYNC     — zkSync Era
 *   ALCHEMY_API_KEY_LINEA      — Linea
 *   ALCHEMY_API_KEY_SCROLL     — Scroll
 */

// Maps our canonical network name → Alchemy subdomain + env-var suffix
const NETWORKS: Record<string, { host: string; envSuffix: string }> = {
  mainnet:  { host: 'eth-mainnet',      envSuffix: 'MAINNET'  },
  polygon:  { host: 'polygon-mainnet',  envSuffix: 'POLYGON'  },
  bsc:      { host: 'bnb-mainnet',      envSuffix: 'BSC'      },
  base:     { host: 'base-mainnet',     envSuffix: 'BASE'     },
  arbitrum: { host: 'arb-mainnet',      envSuffix: 'ARBITRUM' },
  optimism: { host: 'opt-mainnet',      envSuffix: 'OPTIMISM' },
  zksync:   { host: 'zksync-mainnet',   envSuffix: 'ZKSYNC'   },
  linea:    { host: 'linea-mainnet',    envSuffix: 'LINEA'    },
  scroll:   { host: 'scroll-mainnet',   envSuffix: 'SCROLL'   },
};

export const SUPPORTED_NETWORKS = Object.keys(NETWORKS);

/**
 * Resolve the Alchemy base URL for the given network.
 * Throws if no key is available.
 */
export function alchemyUrl(network: string): string {
  const net = NETWORKS[network] ?? NETWORKS['mainnet'];

  // Prefer a network-specific key; fall back to the generic one.
  const key =
    process.env[`ALCHEMY_API_KEY_${net.envSuffix}`] ??
    process.env.ALCHEMY_API_KEY;

  if (!key) {
    throw new Error(
      `No Alchemy API key found for network "${network}". ` +
      `Set ALCHEMY_API_KEY_${net.envSuffix} or ALCHEMY_API_KEY.`,
    );
  }

  return `https://${net.host}.g.alchemy.com/v2/${key}`;
}

/** Returns true if at least one Alchemy key is configured in env. */
export function alchemyConfigured(): boolean {
  return !!(
    process.env.ALCHEMY_API_KEY ||
    Object.values(NETWORKS).some(n => process.env[`ALCHEMY_API_KEY_${n.envSuffix}`])
  );
}

/** Fire a JSON-RPC call against the Alchemy node endpoint. */
export async function alchemyRpc(
  network: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await fetch(alchemyUrl(network), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    signal:  AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Alchemy HTTP ${res.status} on ${network}`);

  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`Alchemy RPC error: ${json.error.message}`);
  return json.result;
}

/** Fire a call against the Alchemy REST / Enhanced API endpoint (non-JSON-RPC). */
export async function alchemyGet(
  network: string,
  path: string,          // e.g. "/nft/v3/getNFTsForOwner"
  params?: Record<string, string | number>,
): Promise<unknown> {
  const base = alchemyUrl(network);
  const url  = new URL(base.replace('/v2/', path.startsWith('/') ? '' : '/'));
  // Re-build as: https://<host>.g.alchemy.com<path>?apiKey=<key>
  // Alchemy REST endpoints use the key as a query param or in the path.
  const qs   = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params ?? {}).map(([k, v]) => [k, String(v)]),
    ),
  );

  const restUrl = `${alchemyUrl(network).replace('/v2/', '/').replace(/\/[^/]+$/, '')}${path}?apiKey=${url.pathname.split('/').pop()}&${qs}`;

  const res = await fetch(restUrl, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Alchemy GET HTTP ${res.status} on ${network}: ${path}`);
  return res.json();
}
