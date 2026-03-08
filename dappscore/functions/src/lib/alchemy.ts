/**
 * Alchemy REST client — no native-module SDK required (Node 20 native fetch).
 *
 * Alchemy issues a separate API key per network/app. Configure each one
 * individually; the generic ALCHEMY_API_KEY is used as a fallback when a
 * network-specific key is absent.
 *
 * Env vars (all optional except at least one must be set):
 *   ALCHEMY_API_KEY              — fallback for any network without its own key
 *
 *   — EVM L1s —
 *   ALCHEMY_API_KEY_MAINNET      — Ethereum mainnet
 *   ALCHEMY_API_KEY_BSC          — BNB Smart Chain
 *   ALCHEMY_API_KEY_AVALANCHE    — Avalanche C-Chain
 *   ALCHEMY_API_KEY_FANTOM       — Fantom Opera (if/when Alchemy adds it)
 *   ALCHEMY_API_KEY_CELO         — Celo
 *
 *   — Ethereum L2s —
 *   ALCHEMY_API_KEY_ARBITRUM     — Arbitrum One
 *   ALCHEMY_API_KEY_OPTIMISM     — Optimism
 *   ALCHEMY_API_KEY_BASE         — Base
 *   ALCHEMY_API_KEY_ZKSYNC       — zkSync Era
 *   ALCHEMY_API_KEY_LINEA        — Linea
 *   ALCHEMY_API_KEY_SCROLL       — Scroll
 *   ALCHEMY_API_KEY_POLYGON      — Polygon PoS
 *   ALCHEMY_API_KEY_POLYGON_ZKEVM — Polygon zkEVM
 *   ALCHEMY_API_KEY_ZORA         — Zora Network
 *   ALCHEMY_API_KEY_UNICHAIN     — Unichain (Uniswap)
 *   ALCHEMY_API_KEY_MANTLE       — Mantle
 *   ALCHEMY_API_KEY_BERACHAIN    — Berachain
 *
 *   — Non-EVM (Alchemy uses separate REST/JSON-RPC format) —
 *   ALCHEMY_API_KEY_STARKNET     — Starknet
 *   ALCHEMY_API_KEY_SOLANA       — Solana
 */

// Maps our canonical network key → Alchemy subdomain + env-var suffix
const NETWORKS: Record<string, { host: string; envSuffix: string }> = {
  // EVM L1s
  mainnet:       { host: 'eth-mainnet',           envSuffix: 'MAINNET'       },
  bsc:           { host: 'bnb-mainnet',            envSuffix: 'BSC'           },
  avalanche:     { host: 'avax-mainnet',           envSuffix: 'AVALANCHE'     },
  celo:          { host: 'celo-mainnet',           envSuffix: 'CELO'          },

  // Ethereum L2s / sidechains
  arbitrum:      { host: 'arb-mainnet',            envSuffix: 'ARBITRUM'      },
  optimism:      { host: 'opt-mainnet',            envSuffix: 'OPTIMISM'      },
  base:          { host: 'base-mainnet',           envSuffix: 'BASE'          },
  zksync:        { host: 'zksync-mainnet',         envSuffix: 'ZKSYNC'        },
  linea:         { host: 'linea-mainnet',          envSuffix: 'LINEA'         },
  scroll:        { host: 'scroll-mainnet',         envSuffix: 'SCROLL'        },
  polygon:       { host: 'polygon-mainnet',        envSuffix: 'POLYGON'       },
  polygon_zkevm: { host: 'polygonzkevm-mainnet',   envSuffix: 'POLYGON_ZKEVM' },
  zora:          { host: 'zora-mainnet',           envSuffix: 'ZORA'          },
  unichain:      { host: 'unichain-mainnet',       envSuffix: 'UNICHAIN'      },
  mantle:        { host: 'mantle-mainnet',         envSuffix: 'MANTLE'        },
  berachain:     { host: 'berachain-mainnet',      envSuffix: 'BERACHAIN'     },

  // Non-EVM (different RPC format — callers must handle accordingly)
  starknet:      { host: 'starknet-mainnet',       envSuffix: 'STARKNET'      },
  solana:        { host: 'solana-mainnet',         envSuffix: 'SOLANA'        },
};

/** All network keys that Alchemy handles. */
export const ALCHEMY_NETWORKS = Object.keys(NETWORKS);

/**
 * Whether a given chain key is handled by Alchemy.
 * Returns false for chains routed via Moralis or native RPC.
 */
export function isAlchemyNetwork(network: string): boolean {
  return network in NETWORKS;
}

/**
 * Resolve the Alchemy base URL for the given network.
 * Throws if no key is available for that network.
 */
export function alchemyUrl(network: string): string {
  const net = NETWORKS[network] ?? NETWORKS['mainnet'];

  const key =
    process.env[`ALCHEMY_API_KEY_${net.envSuffix}`] ??
    process.env.ALCHEMY_API_KEY;

  if (!key) {
    throw new Error(
      `No Alchemy API key for "${network}". ` +
      `Set ALCHEMY_API_KEY_${net.envSuffix} or ALCHEMY_API_KEY.`,
    );
  }

  return `https://${net.host}.g.alchemy.com/v2/${key}`;
}

/** Returns true if at least one Alchemy key is configured. */
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

/**
 * Fire a call against an Alchemy Enhanced / REST API endpoint.
 * Builds: https://<host>.g.alchemy.com/<path>?<params>
 * The API key is appended automatically.
 *
 * @param network  canonical network key, e.g. "base"
 * @param path     path starting with "/", e.g. "/nft/v3/getNFTsForOwner"
 * @param params   query string params (excluding apiKey)
 */
export async function alchemyGet(
  network: string,
  path: string,
  params?: Record<string, string | number>,
): Promise<unknown> {
  const net = NETWORKS[network] ?? NETWORKS['mainnet'];
  const key =
    process.env[`ALCHEMY_API_KEY_${net.envSuffix}`] ??
    process.env.ALCHEMY_API_KEY;

  if (!key) throw new Error(`No Alchemy API key for "${network}".`);

  const qs = new URLSearchParams({ ...(params ?? {}), apiKey: key } as Record<string, string>);
  const url = `https://${net.host}.g.alchemy.com${path}?${qs}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Alchemy GET HTTP ${res.status} on ${network}: ${path}`);
  return res.json();
}
