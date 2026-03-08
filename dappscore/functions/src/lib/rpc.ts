/**
 * Native public RPC client — for chains not covered by Alchemy or Moralis.
 *
 * Currently covers:
 *   HyperEVM  — Hyperliquid's EVM (chain ID 998)
 *   Monad     — high-performance EVM-compatible chain
 *
 * These use standard Ethereum JSON-RPC, so the same helper works for all.
 *
 * Env (optional — if set, used as a private RPC endpoint):
 *   RPC_URL_HYPEREVM  — override the public HyperEVM RPC
 *   RPC_URL_MONAD     — override the public Monad RPC
 *   RPC_URL_STARKNET  — Starknet full node (if not using Alchemy Starknet key)
 */

const PUBLIC_RPCS: Record<string, string> = {
  hyperevm: 'https://rpc.hyperliquid.xyz/evm',
  monad:    'https://testnet-rpc.monad.xyz', // update to mainnet RPC when live
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
