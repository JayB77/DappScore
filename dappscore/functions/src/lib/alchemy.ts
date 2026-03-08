/**
 * Alchemy REST client — no native-module SDK required (Node 20 native fetch).
 *
 * Alchemy issues a separate API key per network/app. Configure each one
 * individually; the generic ALCHEMY_API_KEY is used as a fallback.
 *
 * All 28 DappScore chains are now supported on Alchemy (as of March 2026).
 *
 * NOTE: Starknet uses a different RPC path format:
 *   https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_9/{key}
 * All other chains use the standard: https://{host}.g.alchemy.com/v2/{key}
 *
 * Env vars:
 *   ALCHEMY_API_KEY              — generic fallback for any unspecified network
 *
 *   — EVM L1s —
 *   ALCHEMY_API_KEY_MAINNET      — Ethereum mainnet
 *   ALCHEMY_API_KEY_BSC          — BNB Smart Chain
 *   ALCHEMY_API_KEY_AVALANCHE    — Avalanche C-Chain
 *   ALCHEMY_API_KEY_CELO         — Celo
 *   ALCHEMY_API_KEY_RONIN        — Ronin (Sky Mavis / Axie)
 *   ALCHEMY_API_KEY_SEI          — SEI Network
 *   ALCHEMY_API_KEY_ZETACHAIN    — ZetaChain
 *
 *   — Ethereum L2s / rollups —
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
 *   ALCHEMY_API_KEY_OPBNB        — opBNB (BNB Chain L2)
 *
 *   — Newer EVM —
 *   ALCHEMY_API_KEY_MONAD        — Monad mainnet
 *   ALCHEMY_API_KEY_HYPEREVM     — HyperEVM (Hyperliquid)
 *
 *   — Non-EVM —
 *   ALCHEMY_API_KEY_STARKNET     — Starknet (Cairo; different RPC path)
 *   ALCHEMY_API_KEY_SOLANA       — Solana
 */

interface NetworkConfig {
  /** Alchemy subdomain, e.g. "eth-mainnet" */
  host: string;
  /** Env-var suffix, e.g. "MAINNET" → ALCHEMY_API_KEY_MAINNET */
  envSuffix: string;
  /**
   * RPC path template. Defaults to "/v2/{key}".
   * Only override for chains that use a non-standard path (e.g. Starknet).
   */
  pathTemplate?: string;
}

const NETWORKS: Record<string, NetworkConfig> = {
  // EVM L1s
  mainnet:       { host: 'eth-mainnet',           envSuffix: 'MAINNET'       },
  bsc:           { host: 'bnb-mainnet',            envSuffix: 'BSC'           },
  avalanche:     { host: 'avax-mainnet',           envSuffix: 'AVALANCHE'     },
  celo:          { host: 'celo-mainnet',           envSuffix: 'CELO'          },
  ronin:         { host: 'ronin-mainnet',          envSuffix: 'RONIN'         },
  sei:           { host: 'sei-mainnet',            envSuffix: 'SEI'           },
  zetachain:     { host: 'zetachain-mainnet',      envSuffix: 'ZETACHAIN'     },

  // Ethereum L2s / rollups
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
  opbnb:         { host: 'opbnb-mainnet',          envSuffix: 'OPBNB'         },

  // Newer EVM
  monad:         { host: 'monad-mainnet',          envSuffix: 'MONAD'         },
  // HyperEVM: Alchemy subdomain is "hyperliquid" (no "-mainnet" suffix)
  hyperevm:      { host: 'hyperliquid',            envSuffix: 'HYPEREVM'      },

  // Non-EVM
  // Starknet uses a different RPC path: /starknet/version/rpc/v0_9/{key}
  starknet:      { host: 'starknet-mainnet',  envSuffix: 'STARKNET',
                   pathTemplate: '/starknet/version/rpc/v0_9/{key}'           },
  solana:        { host: 'solana-mainnet',         envSuffix: 'SOLANA'        },
};

/** All network keys handled by Alchemy. */
export const ALCHEMY_NETWORKS = Object.keys(NETWORKS);

/** Whether a given chain key is handled by Alchemy. */
export function isAlchemyNetwork(network: string): boolean {
  return network in NETWORKS;
}

/** Resolve the API key for a network (network-specific → generic fallback). */
function resolveKey(net: NetworkConfig): string {
  const key =
    process.env[`ALCHEMY_API_KEY_${net.envSuffix}`] ??
    process.env.ALCHEMY_API_KEY;

  if (!key) {
    throw new Error(
      `No Alchemy API key for this network. ` +
      `Set ALCHEMY_API_KEY_${net.envSuffix} or ALCHEMY_API_KEY.`,
    );
  }
  return key;
}

/**
 * Resolve the full Alchemy RPC URL for the given network.
 * Respects per-network pathTemplate for chains like Starknet.
 */
export function alchemyUrl(network: string): string {
  const net  = NETWORKS[network] ?? NETWORKS['mainnet'];
  const key  = resolveKey(net);
  const path = (net.pathTemplate ?? '/v2/{key}').replace('{key}', key);
  return `https://${net.host}.g.alchemy.com${path}`;
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
 * Builds: https://<host>.g.alchemy.com/<path>?apiKey=<key>&<params>
 *
 * @param network  canonical network key, e.g. "base"
 * @param path     path starting with "/", e.g. "/nft/v3/getNFTsForOwner"
 * @param params   additional query string params
 */
export async function alchemyGet(
  network: string,
  path: string,
  params?: Record<string, string | number>,
): Promise<unknown> {
  const net = NETWORKS[network] ?? NETWORKS['mainnet'];
  const key = resolveKey(net);

  const qs = new URLSearchParams({ ...(params ?? {}), apiKey: key } as Record<string, string>);
  const url = `https://${net.host}.g.alchemy.com${path}?${qs}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Alchemy GET HTTP ${res.status} on ${network}: ${path}`);
  return res.json();
}
