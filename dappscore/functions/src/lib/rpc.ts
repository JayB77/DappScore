/**
 * Native public RPC client — fallback for when no Alchemy key is configured.
 *
 * All chains here are also on Alchemy (as of March 2026). These public
 * endpoints serve as zero-config fallbacks so the app works without API keys,
 * albeit at lower rate limits.
 *
 * Env overrides (optional — set to use your own node):
 *   RPC_URL_HYPEREVM  — default: https://rpc.hyperliquid.xyz/evm (100 req/min)
 *   RPC_URL_MONAD     — default: https://rpc.monad.xyz
 */

const PUBLIC_RPCS: Record<string, string> = {
  // HyperEVM: 100 req/min, read-only, no WebSocket
  hyperevm: 'https://rpc.hyperliquid.xyz/evm',
  // Monad mainnet (multiple public endpoints — rpc.monad.xyz is QuickNode-hosted)
  monad:    'https://rpc.monad.xyz',
};

/** Env-var overrides (e.g. your own node or a provider that isn't Alchemy/Moralis). */
const ENV_OVERRIDES: Record<string, string> = {
  hyperevm: 'RPC_URL_HYPEREVM',
  monad:    'RPC_URL_MONAD',
};

export const NATIVE_RPC_NETWORKS = Object.keys(PUBLIC_RPCS);

function rpcUrl(network: string): string {
  const override = ENV_OVERRIDES[network] ? process.env[ENV_OVERRIDES[network]!] : undefined;
  const url = override ?? PUBLIC_RPCS[network];
  if (!url) throw new Error(`No RPC URL for network "${network}".`);
  return url;
}

/** Fire a standard Ethereum JSON-RPC call to the network's node. */
export async function nativeRpc(
  network: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const url = rpcUrl(network);
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    signal:  AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status} on ${network}`);
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`RPC error on ${network}: ${json.error.message}`);
  return json.result;
}

/** Get native balance for a wallet (returns hex wei string). */
export async function getNativeBalance(network: string, address: string): Promise<string> {
  return (await nativeRpc(network, 'eth_getBalance', [address, 'latest'])) as string;
}
