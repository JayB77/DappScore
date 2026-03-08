/**
 * Native public RPC client — fallback for when no Alchemy key is configured.
 *
 * Chains on Alchemy (blast, gnosis, mode, fraxtal, sonic) have public fallbacks
 * here too so the app works without API keys at lower rate limits.
 * Chains NOT on Alchemy rely exclusively on these public endpoints.
 *
 * Env overrides (optional — set to use your own node or a paid provider):
 *   RPC_URL_HYPEREVM         — default: https://rpc.hyperliquid.xyz/evm
 *   RPC_URL_MONAD            — default: https://rpc.monad.xyz
 *   RPC_URL_GNOSIS           — default: https://rpc.gnosischain.com
 *   RPC_URL_CRONOS           — default: https://evm.cronos.org
 *   RPC_URL_KAIA             — default: https://public-en.node.kaia.io
 *   RPC_URL_MOONBEAM         — default: https://rpc.api.moonbeam.network
 *   RPC_URL_MOONRIVER        — default: https://rpc.api.moonriver.moonbeam.network
 *   RPC_URL_KAVA             — default: https://evm.kava.io
 *   RPC_URL_AURORA           — default: https://mainnet.aurora.dev
 *   RPC_URL_CORE             — default: https://rpc.coredao.org
 *   RPC_URL_METIS            — default: https://andromeda.metis.io/?owner=1088
 *   RPC_URL_TAIKO            — default: https://rpc.mainnet.taiko.xyz
 *   RPC_URL_MANTA            — default: https://pacific-rpc.manta.network/http
 *   RPC_URL_SONIC            — default: https://rpc.soniclabs.com
 *   RPC_URL_BLAST            — default: https://rpc.blast.io
 *   RPC_URL_MODE             — default: https://mainnet.mode.network
 *   RPC_URL_FRAXTAL          — default: https://rpc.frax.com
 *   RPC_URL_ROOTSTOCK        — default: https://public-node.rsk.co
 *   RPC_URL_MERLIN           — default: https://rpc.merlinchain.io
 *   RPC_URL_BOB              — default: https://rpc.gobob.xyz
 *   RPC_URL_WORLD_CHAIN      — default: https://worldchain-mainnet.g.alchemy.com/public
 *   RPC_URL_SONEIUM          — default: https://rpc.soneium.org
 *   RPC_URL_IMMUTABLE_ZKEVM  — default: https://rpc.immutable.com
 *   RPC_URL_NEON_EVM         — default: https://neon-proxy-mainnet.solana.p2p.org
 */

const PUBLIC_RPCS: Record<string, string> = {
  // ── Chains with Alchemy support (public fallbacks) ───────────────────────
  blast:           'https://rpc.blast.io',
  gnosis:          'https://rpc.gnosischain.com',
  mode:            'https://mainnet.mode.network',
  fraxtal:         'https://rpc.frax.com',
  sonic:           'https://rpc.soniclabs.com',
  // HyperEVM: 100 req/min, read-only, no WebSocket
  hyperevm:        'https://rpc.hyperliquid.xyz/evm',
  // Monad mainnet (multiple public endpoints — rpc.monad.xyz is QuickNode-hosted)
  monad:           'https://rpc.monad.xyz',

  // ── Chains without Alchemy (public RPC only) ─────────────────────────────
  cronos:          'https://evm.cronos.org',
  kaia:            'https://public-en.node.kaia.io',
  moonbeam:        'https://rpc.api.moonbeam.network',
  moonriver:       'https://rpc.api.moonriver.moonbeam.network',
  kava:            'https://evm.kava.io',
  aurora:          'https://mainnet.aurora.dev',
  core:            'https://rpc.coredao.org',
  metis:           'https://andromeda.metis.io/?owner=1088',
  taiko:           'https://rpc.mainnet.taiko.xyz',
  manta:           'https://pacific-rpc.manta.network/http',
  rootstock:       'https://public-node.rsk.co',
  merlin:          'https://rpc.merlinchain.io',
  bob:             'https://rpc.gobob.xyz',
  world_chain:     'https://worldchain-mainnet.g.alchemy.com/public',
  soneium:         'https://rpc.soneium.org',
  immutable_zkevm: 'https://rpc.immutable.com',
  neon_evm:        'https://neon-proxy-mainnet.solana.p2p.org',
};

/** Env-var overrides (e.g. your own node or a paid provider). */
const ENV_OVERRIDES: Record<string, string> = {
  hyperevm:        'RPC_URL_HYPEREVM',
  monad:           'RPC_URL_MONAD',
  blast:           'RPC_URL_BLAST',
  gnosis:          'RPC_URL_GNOSIS',
  mode:            'RPC_URL_MODE',
  fraxtal:         'RPC_URL_FRAXTAL',
  sonic:           'RPC_URL_SONIC',
  cronos:          'RPC_URL_CRONOS',
  kaia:            'RPC_URL_KAIA',
  moonbeam:        'RPC_URL_MOONBEAM',
  moonriver:       'RPC_URL_MOONRIVER',
  kava:            'RPC_URL_KAVA',
  aurora:          'RPC_URL_AURORA',
  core:            'RPC_URL_CORE',
  metis:           'RPC_URL_METIS',
  taiko:           'RPC_URL_TAIKO',
  manta:           'RPC_URL_MANTA',
  rootstock:       'RPC_URL_ROOTSTOCK',
  merlin:          'RPC_URL_MERLIN',
  bob:             'RPC_URL_BOB',
  world_chain:     'RPC_URL_WORLD_CHAIN',
  soneium:         'RPC_URL_SONEIUM',
  immutable_zkevm: 'RPC_URL_IMMUTABLE_ZKEVM',
  neon_evm:        'RPC_URL_NEON_EVM',
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
