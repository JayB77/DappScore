/**
 * Moralis Web3 Data API client — native fetch, no SDK.
 *
 * Used for chains Alchemy doesn't cover:
 *   Ronin, opBNB, SEI, ZetaChain, Monad (+ full overlap with EVM chains)
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
  // Chains Alchemy also covers — Moralis works as a secondary source
  mainnet:       '0x1',
  bsc:           '0x38',
  polygon:       '0x89',
  avalanche:     '0xa86a',
  fantom:        '0xfa',
  arbitrum:      '0xa4b1',
  optimism:      '0xa',
  base:          '0x2105',
  linea:         '0xe708',
  celo:          '0xa4ec',
  scroll:        '0x82750',
  zksync:        '0x144',
  polygon_zkevm: '0x44d',
  mantle:        '0x1388',
  berachain:     '0x138d5',

  // Chains Moralis covers that Alchemy doesn't (or hasn't yet)
  ronin:         '0x7e4',     // chain ID 2020
  opbnb:         '0xcc',      // chain ID 204
  sei:           '0x531',     // SEI EVM chain ID 1329
  zetachain:     '0x1b59',    // chain ID 7000
  unichain:      '0x515',     // chain ID 1301
  zora:          '0x76adf1',  // chain ID 7777777
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
