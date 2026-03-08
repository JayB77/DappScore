/**
 * Moralis Web3 Data API client — native fetch, no SDK.
 *
 * Used for chains Alchemy doesn't cover (and as a secondary source for others).
 *
 * Moralis also has dedicated Solana endpoints under /v2/sol/...
 *
 * Env:
 *   MORALIS_API_KEY  — server-side key (different from NEXT_PUBLIC_MORALIS_API_KEY)
 *                      Get one at https://admin.moralis.io
 */

const BASE_URL   = 'https://deep-index.moralis.io/api/v2.2';
const SOLANA_URL = 'https://solana-gateway.moralis.io';

// Moralis chain identifiers for EVM chains
export const MORALIS_CHAIN_IDS: Record<string, string> = {
  // ── EVM L1s ──────────────────────────────────────────────────────────────
  mainnet:         '0x1',       // Ethereum mainnet (chain ID 1)
  bsc:             '0x38',      // BNB Smart Chain (56)
  polygon:         '0x89',      // Polygon PoS (137)
  avalanche:       '0xa86a',    // Avalanche C-Chain (43114)
  fantom:          '0xfa',      // Fantom (250)
  sonic:           '0x92',      // Sonic (146)
  celo:            '0xa4ec',    // Celo (42220)
  gnosis:          '0x64',      // Gnosis Chain (100)
  cronos:          '0x19',      // Cronos (25)
  kaia:            '0x2019',    // Kaia / Klaytn (8217)
  moonbeam:        '0x504',     // Moonbeam (1284)
  moonriver:       '0x505',     // Moonriver (1285)
  kava:            '0x8ae',     // Kava EVM (2222)
  core:            '0x45c',     // Core DAO (1116)
  ronin:           '0x7e4',     // Ronin (2020)
  sei:             '0x531',     // SEI EVM (1329)
  zetachain:       '0x1b59',    // ZetaChain (7000)

  // ── Ethereum L2s / rollups ───────────────────────────────────────────────
  arbitrum:        '0xa4b1',    // Arbitrum One (42161)
  optimism:        '0xa',       // Optimism (10)
  base:            '0x2105',    // Base (8453)
  blast:           '0x13e31',   // Blast (81457)
  zksync:          '0x144',     // zkSync Era (324)
  linea:           '0xe708',    // Linea (59144)
  scroll:          '0x82750',   // Scroll (534352)
  polygon_zkevm:   '0x44d',     // Polygon zkEVM (1101)
  mantle:          '0x1388',    // Mantle (5000)
  mode:            '0x868b',    // Mode Network (34443)
  taiko:           '0x28c58',   // Taiko (167000)
  fraxtal:         '0xfc',      // Fraxtal (252)
  manta:           '0xa9',      // Manta Pacific (169)
  metis:           '0x440',     // Metis (1088)
  opbnb:           '0xcc',      // opBNB (204)
  unichain:        '0x515',     // Unichain (1301)
  zora:            '0x76adf1',  // Zora Network (7777777)
  berachain:       '0x138d5',   // Berachain (80094)
  world_chain:     '0x1e0',     // World Chain (480)
  immutable_zkevm: '0x343b',    // Immutable zkEVM (13371)
  rootstock:       '0x1e',      // Rootstock / RSK (30)
  merlin:          '0x1068',    // Merlin Chain (4200)
};

/** Canonical chain key → Moralis chain identifier. Returns null if unsupported. */
export function moralisChainId(network: string): string | null {
  return MORALIS_CHAIN_IDS[network] ?? null;
}

function moralisHeaders(): Record<string, string> {
  const key = process.env.MORALIS_API_KEY;
  if (!key) throw new Error('MORALIS_API_KEY is not configured.');
  return { 'X-API-Key': key, 'Accept': 'application/json' };
}

export function moralisConfigured(): boolean {
  return !!process.env.MORALIS_API_KEY;
}

async function moralisGet(path: string, params?: Record<string, string | number>): Promise<unknown> {
  const qs  = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  const res = await fetch(`${BASE_URL}${path}${qs}`, {
    headers: moralisHeaders(),
    signal:  AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Moralis HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ── EVM endpoints ─────────────────────────────────────────────────────────────

/** Token metadata for an ERC-20 contract. */
export async function getTokenMetadata(
  network: string,
  tokenAddress: string,
): Promise<unknown> {
  const chain = moralisChainId(network);
  if (!chain) throw new Error(`Moralis: unsupported network "${network}".`);
  return moralisGet('/erc20/metadata', { addresses: tokenAddress, chain });
}

/** Top token holders (ERC-20). */
export async function getTokenHolders(
  network: string,
  tokenAddress: string,
  limit = 100,
): Promise<unknown> {
  const chain = moralisChainId(network);
  if (!chain) throw new Error(`Moralis: unsupported network "${network}".`);
  return moralisGet(`/erc20/${tokenAddress}/owners`, { chain, limit });
}

/** Recent ERC-20 transfers. */
export async function getTokenTransfers(
  network: string,
  tokenAddress: string,
  limit = 100,
): Promise<unknown> {
  const chain = moralisChainId(network);
  if (!chain) throw new Error(`Moralis: unsupported network "${network}".`);
  return moralisGet(`/erc20/${tokenAddress}/transfers`, { chain, limit });
}

/** Wallet token balances across a chain. */
export async function getWalletTokens(
  network: string,
  address: string,
): Promise<unknown> {
  const chain = moralisChainId(network);
  if (!chain) throw new Error(`Moralis: unsupported network "${network}".`);
  return moralisGet(`/${address}/erc20`, { chain });
}

/** Native token balance for a wallet. */
export async function getWalletBalance(
  network: string,
  address: string,
): Promise<unknown> {
  const chain = moralisChainId(network);
  if (!chain) throw new Error(`Moralis: unsupported network "${network}".`);
  return moralisGet(`/${address}/balance`, { chain });
}

/** NFTs owned by a wallet. */
export async function getWalletNFTs(
  network: string,
  address: string,
  limit = 20,
): Promise<unknown> {
  const chain = moralisChainId(network);
  if (!chain) throw new Error(`Moralis: unsupported network "${network}".`);
  return moralisGet(`/${address}/nft`, { chain, limit });
}

// ── Solana endpoints ──────────────────────────────────────────────────────────

async function moralisSolanaGet(path: string, params?: Record<string, string | number>): Promise<unknown> {
  const qs  = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  const res = await fetch(`${SOLANA_URL}${path}${qs}`, {
    headers: moralisHeaders(),
    signal:  AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Moralis Solana HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** SPL token metadata (mint address). */
export async function getSolanaTokenMetadata(mintAddress: string): Promise<unknown> {
  return moralisSolanaGet(`/account/mainnet/${mintAddress}/metadata`);
}

/** SPL token price. */
export async function getSolanaTokenPrice(mintAddress: string): Promise<unknown> {
  return moralisSolanaGet(`/token/mainnet/${mintAddress}/price`);
}

/** SOL balance + token portfolio for a wallet. */
export async function getSolanaWalletPortfolio(walletAddress: string): Promise<unknown> {
  return moralisSolanaGet(`/account/mainnet/${walletAddress}/portfolio`);
}

/** SPL token holders (top holders list). */
export async function getSolanaTokenHolders(mintAddress: string): Promise<unknown> {
  // Moralis Solana token owners endpoint
  return moralisSolanaGet(`/token/mainnet/${mintAddress}/owners`);
}

/** Recent SPL token transfers. */
export async function getSolanaTokenTransfers(mintAddress: string, limit = 100): Promise<unknown> {
  return moralisSolanaGet(`/token/mainnet/${mintAddress}/transfers`, { limit });
}
