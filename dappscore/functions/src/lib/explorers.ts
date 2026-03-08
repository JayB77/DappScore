/**
 * Block explorer API client — contract verification + source code lookup.
 *
 * Three explorer formats are used:
 *   1. Etherscan-compatible  — most EVM chains (same API format)
 *   2. Blockscout            — Zora, Unichain, ZetaChain, Ronin, SEI
 *   3. Helius                — Solana (SPL token metadata + program info)
 *   4. Moralis (Solana)      — fallback for Solana token data
 *
 * Env vars (all optional but enable richer scam detection if set):
 *   ETHERSCAN_API_KEY
 *   BSCSCAN_API_KEY
 *   POLYGONSCAN_API_KEY
 *   ARBISCAN_API_KEY
 *   OPTIMISM_ETHERSCAN_API_KEY
 *   BASESCAN_API_KEY
 *   AVALANCHE_API_KEY          — Routescan (Snowtrace replacement)
 *   FTMSCAN_API_KEY
 *   CELOSCAN_API_KEY
 *   LINEASCAN_API_KEY
 *   SCROLLSCAN_API_KEY
 *   MANTLESCAN_API_KEY
 *   BERASCAN_API_KEY
 *   OPBNBSCAN_API_KEY          — BscScan opBNB API
 *   RONIN_EXPLORER_API_KEY     — Sky Mavis / Ronin explorer
 *   HELIUS_API_KEY             — Solana: Helius DAS + RPC
 */

export type ExplorerFormat = 'etherscan' | 'blockscout' | 'starkscan' | 'helius' | 'none';

interface ExplorerConfig {
  format:  ExplorerFormat;
  baseUrl: string;
  envKey:  string | null; // null = no API key needed (public)
}

const EXPLORERS: Record<string, ExplorerConfig> = {
  // Etherscan-compatible
  mainnet:       { format: 'etherscan', baseUrl: 'https://api.etherscan.io/api',                   envKey: 'ETHERSCAN_API_KEY'           },
  bsc:           { format: 'etherscan', baseUrl: 'https://api.bscscan.com/api',                    envKey: 'BSCSCAN_API_KEY'             },
  polygon:       { format: 'etherscan', baseUrl: 'https://api.polygonscan.com/api',                envKey: 'POLYGONSCAN_API_KEY'         },
  arbitrum:      { format: 'etherscan', baseUrl: 'https://api.arbiscan.io/api',                    envKey: 'ARBISCAN_API_KEY'            },
  optimism:      { format: 'etherscan', baseUrl: 'https://api-optimistic.etherscan.io/api',        envKey: 'OPTIMISM_ETHERSCAN_API_KEY'  },
  base:          { format: 'etherscan', baseUrl: 'https://api.basescan.org/api',                   envKey: 'BASESCAN_API_KEY'            },
  avalanche:     { format: 'etherscan', baseUrl: 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api', envKey: 'AVALANCHE_API_KEY' },
  fantom:        { format: 'etherscan', baseUrl: 'https://api.ftmscan.com/api',                    envKey: 'FTMSCAN_API_KEY'             },
  celo:          { format: 'etherscan', baseUrl: 'https://api.celoscan.io/api',                    envKey: 'CELOSCAN_API_KEY'            },
  linea:         { format: 'etherscan', baseUrl: 'https://api.lineascan.build/api',                envKey: 'LINEASCAN_API_KEY'           },
  scroll:        { format: 'etherscan', baseUrl: 'https://api.scrollscan.com/api',                 envKey: 'SCROLLSCAN_API_KEY'          },
  polygon_zkevm: { format: 'etherscan', baseUrl: 'https://api-zkevm.polygonscan.com/api',          envKey: 'POLYGONSCAN_API_KEY'         },
  mantle:        { format: 'etherscan', baseUrl: 'https://api.mantlescan.xyz/api',                 envKey: 'MANTLESCAN_API_KEY'          },
  berachain:     { format: 'etherscan', baseUrl: 'https://api.berascan.com/api',                   envKey: 'BERASCAN_API_KEY'            },
  opbnb:         { format: 'etherscan', baseUrl: 'https://api-opbnb.bscscan.com/api',              envKey: 'OPBNBSCAN_API_KEY'           },
  sei:           { format: 'etherscan', baseUrl: 'https://seitrace.com/pacific-1/api',             envKey: null                         },

  // Blockscout-compatible (REST v2)
  zora:          { format: 'blockscout', baseUrl: 'https://explorer.zora.energy/api/v2',           envKey: null },
  unichain:      { format: 'blockscout', baseUrl: 'https://unichain.blockscout.com/api/v2',        envKey: null },
  zetachain:     { format: 'blockscout', baseUrl: 'https://explorer.zetachain.com/api/v2',         envKey: null },
  ronin:         { format: 'blockscout', baseUrl: 'https://app.roninchain.com/api/v2',             envKey: 'RONIN_EXPLORER_API_KEY' },
  hyperevm:      { format: 'blockscout', baseUrl: 'https://hyperliquid.cloud.blockscout.com/api/v2', envKey: null },
  monad:         { format: 'blockscout', baseUrl: 'https://testnet.monadexplorer.com/api/v2',      envKey: null },

  // zksync has its own explorer API (Etherscan-compatible subset)
  zksync:        { format: 'etherscan', baseUrl: 'https://block-explorer-api.mainnet.zksync.io/api', envKey: null },

  // Solana — Helius
  solana:        { format: 'helius',   baseUrl: 'https://api.helius.xyz',                          envKey: 'HELIUS_API_KEY' },

  // Starknet — Starkscan public REST API
  // Env: STARKSCAN_API_KEY (optional, increases rate limits)
  starknet:      { format: 'blockscout', baseUrl: 'https://api.starkscan.co/api/v0', envKey: 'STARKSCAN_API_KEY' },
};

// ── Etherscan-compatible ──────────────────────────────────────────────────────

export interface ContractInfo {
  verified:     boolean;
  sourceCode?:  string;
  contractName?: string;
  compilerVersion?: string;
  proxy?:       boolean;
  implementation?: string;
  licenses?:    string[];
}

async function etherscanContractInfo(
  config: ExplorerConfig,
  address: string,
): Promise<ContractInfo> {
  const key = config.envKey ? process.env[config.envKey] : undefined;
  const qs = new URLSearchParams({
    module: 'contract',
    action: 'getsourcecode',
    address,
    ...(key ? { apikey: key } : {}),
  });

  const res  = await fetch(`${config.baseUrl}?${qs}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Explorer HTTP ${res.status}`);

  const json = (await res.json()) as {
    status: string;
    result: Array<{
      SourceCode: string;
      ContractName: string;
      CompilerVersion: string;
      Proxy: string;
      Implementation: string;
      LicenseType: string;
    }>;
  };

  if (json.status !== '1' || !json.result?.[0]) {
    return { verified: false };
  }

  const r = json.result[0];
  return {
    verified:        !!r.SourceCode,
    sourceCode:      r.SourceCode || undefined,
    contractName:    r.ContractName || undefined,
    compilerVersion: r.CompilerVersion || undefined,
    proxy:           r.Proxy === '1',
    implementation:  r.Implementation || undefined,
    licenses:        r.LicenseType ? [r.LicenseType] : undefined,
  };
}

// ── Blockscout (REST v2) ──────────────────────────────────────────────────────

async function blockscoutContractInfo(
  config: ExplorerConfig,
  address: string,
): Promise<ContractInfo> {
  const headers: Record<string, string> = {};
  if (config.envKey && process.env[config.envKey]) {
    headers['Authorization'] = `Bearer ${process.env[config.envKey]}`;
  }

  const res = await fetch(`${config.baseUrl}/smart-contracts/${address}`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 404) return { verified: false };
  if (!res.ok) throw new Error(`Blockscout HTTP ${res.status}`);

  const json = (await res.json()) as {
    is_verified?: boolean;
    name?: string;
    compiler_version?: string;
    source_code?: string;
    is_proxy?: boolean;
    implementation_address?: string;
  };

  return {
    verified:        !!json.is_verified,
    contractName:    json.name ?? undefined,
    compilerVersion: json.compiler_version ?? undefined,
    sourceCode:      json.source_code ?? undefined,
    proxy:           json.is_proxy ?? undefined,
    implementation:  json.implementation_address ?? undefined,
  };
}

// ── Helius (Solana) ───────────────────────────────────────────────────────────

export interface SolanaTokenInfo {
  mint:          string;
  name?:         string;
  symbol?:       string;
  description?:  string;
  image?:        string;
  decimals?:     number;
  supply?:       string;
  mintAuthority?: string | null;   // null = renounced ✓
  freezeAuthority?: string | null; // null = renounced ✓
  updateAuthority?: string;
  isMutable?:    boolean;
  creators?:     Array<{ address: string; share: number; verified: boolean }>;
}

export async function getSolanaTokenInfo(mintAddress: string): Promise<SolanaTokenInfo | null> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return null;

  const res = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${key}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ mintAccounts: [mintAddress], includeOffChain: true }),
    signal:  AbortSignal.timeout(10_000),
  });

  if (!res.ok) return null;

  const json = (await res.json()) as Array<{
    account: string;
    onChainMetadata?: {
      metadata?: {
        data?: { name?: string; symbol?: string; uri?: string };
        updateAuthority?: string;
        isMutable?: boolean;
        mint?: string;
        tokenStandard?: string;
      };
      tokenStandard?: string;
    };
    offChainMetadata?: { metadata?: { name?: string; description?: string; image?: string } };
    legacyMetadata?: { name?: string; symbol?: string; decimals?: number; logoURI?: string };
  }>;

  const item = json[0];
  if (!item) return null;

  const onChain   = item.onChainMetadata?.metadata?.data;
  const offChain  = item.offChainMetadata?.metadata;
  const legacy    = item.legacyMetadata;

  return {
    mint:     mintAddress,
    name:     onChain?.name ?? legacy?.name,
    symbol:   legacy?.symbol,
    description: offChain?.description,
    image:    offChain?.image ?? legacy?.logoURI,
    decimals: legacy?.decimals,
    updateAuthority: item.onChainMetadata?.metadata?.updateAuthority,
    isMutable:       item.onChainMetadata?.metadata?.isMutable,
  };
}

/** Full Solana mint account info via Helius RPC (mintAuthority, freezeAuthority). */
export async function getSolanaMintInfo(mintAddress: string): Promise<{
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: string;
  decimals: number;
} | null> {
  const key = process.env.HELIUS_API_KEY;
  if (!key) return null;

  const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'getAccountInfo',
      params: [mintAddress, { encoding: 'jsonParsed' }],
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as {
    result?: {
      value?: {
        data?: {
          parsed?: {
            info?: {
              mintAuthority: string | null;
              freezeAuthority: string | null;
              supply: string;
              decimals: number;
            };
          };
        };
      };
    };
  };

  return json.result?.value?.data?.parsed?.info ?? null;
}

// ── Starkscan (Starknet) ──────────────────────────────────────────────────────

async function starkscanContractInfo(
  config: ExplorerConfig,
  address: string,
): Promise<ContractInfo> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (config.envKey && process.env[config.envKey]) {
    headers['x-api-key'] = process.env[config.envKey]!;
  }

  const res = await fetch(`${config.baseUrl}/contract/${address}`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 404) return { verified: false };
  if (!res.ok) throw new Error(`Starkscan HTTP ${res.status}`);

  const json = (await res.json()) as {
    is_verified?: boolean;
    contract_name?: string;
    compiler_version?: string;
    source_code?: string;
    is_proxy?: boolean;
    implementation_contract?: string;
  };

  return {
    verified:        !!json.is_verified,
    contractName:    json.contract_name ?? undefined,
    compilerVersion: json.compiler_version ?? undefined,
    sourceCode:      json.source_code ?? undefined,
    proxy:           json.is_proxy ?? undefined,
    implementation:  json.implementation_contract ?? undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Get contract verification status + source for any supported chain. */
export async function getContractInfo(
  network: string,
  address: string,
): Promise<ContractInfo> {
  const config = EXPLORERS[network];
  if (!config || config.format === 'none') return { verified: false };

  try {
    if (config.format === 'etherscan')  return await etherscanContractInfo(config, address);
    if (config.format === 'blockscout') return await blockscoutContractInfo(config, address);
    if (config.format === 'starkscan')  return await starkscanContractInfo(config, address);
    return { verified: false };
  } catch (err) {
    console.warn(`[explorers] getContractInfo failed on ${network}:`, err);
    return { verified: false };
  }
}

/** Whether we have at least a public (keyless) explorer for the given network. */
export function explorerConfigured(network: string): boolean {
  return !!(EXPLORERS[network]?.baseUrl);
}

/** Names of all networks with at least a public explorer configured. */
export const EXPLORER_NETWORKS = Object.entries(EXPLORERS)
  .filter(([, c]) => c.format !== 'none')
  .map(([k]) => k);
