/**
 * Whale Wallet Tracking Service
 *
 * Monitors large wallet movements and provides insights
 * on whale activity for project tokens.
 */

import { createPublicClient, http, parseAbiItem, formatEther, Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// Types
export interface WhaleWallet {
  address: string;
  label?: string;
  totalValueUsd: number;
  tokensHeld: TokenHolding[];
  lastActive: Date;
  isKnownEntity: boolean;
  entityType?: 'exchange' | 'fund' | 'whale' | 'protocol' | 'contract';
}

export interface TokenHolding {
  tokenAddress: string;
  tokenSymbol: string;
  balance: bigint;
  balanceFormatted: string;
  valueUsd: number;
  percentOfSupply: number;
}

export interface WhaleTransaction {
  hash: string;
  from: string;
  to: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: bigint;
  amountFormatted: string;
  valueUsd: number;
  timestamp: Date;
  type: 'buy' | 'sell' | 'transfer';
  isSignificant: boolean;
}

export interface WhaleAlert {
  id: string;
  type: 'large_transfer' | 'accumulation' | 'distribution' | 'new_whale' | 'whale_exit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  projectId: string;
  tokenAddress: string;
  walletAddress: string;
  description: string;
  details: Record<string, any>;
  timestamp: Date;
}

// Known whale/entity labels
const KNOWN_ENTITIES: Record<string, { label: string; type: WhaleWallet['entityType'] }> = {
  // Exchanges
  '0x28c6c06298d514db089934071355e5743bf21d60': { label: 'Binance Hot Wallet', type: 'exchange' },
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': { label: 'Binance Cold Wallet', type: 'exchange' },
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': { label: 'Coinbase', type: 'exchange' },
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': { label: 'Coinbase Commerce', type: 'exchange' },
  '0x503828976d22510aad0201ac7ec88293211d23da': { label: 'Coinbase Prime', type: 'exchange' },
  '0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0': { label: 'Kraken', type: 'exchange' },

  // Base-specific
  '0xd8da6bf26964af9d7eed9e03e53415d37aa96045': { label: 'Vitalik.eth', type: 'whale' },
  '0x1db92e2eebc8e0c075a02bea49a2935bcd2dfcf4': { label: 'Base Bridge', type: 'protocol' },

  // Add more known entities as needed
};

// Thresholds
const WHALE_THRESHOLD_USD = 100_000; // $100k minimum to be considered a whale
const SIGNIFICANT_TX_THRESHOLD_USD = 50_000; // $50k for significant transaction
const SUPPLY_PERCENTAGE_ALERT = 5; // Alert if wallet holds >5% of supply

// RPC clients
const clients = {
  mainnet: createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  }),
  testnet: createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
  }),
};

// ERC20 Transfer event
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

// In-memory tracking (in production, use Redis or database)
const trackedTokens: Map<string, {
  address: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  priceUsd: number;
}> = new Map();

const whaleWallets: Map<string, WhaleWallet> = new Map();
const recentTransactions: WhaleTransaction[] = [];
const alerts: WhaleAlert[] = [];

/**
 * Add a token to track for whale activity
 */
export async function trackToken(
  tokenAddress: string,
  symbol: string,
  priceUsd: number,
  network: 'mainnet' | 'testnet' = 'mainnet'
): Promise<void> {
  const client = clients[network];

  // Get token info
  const [decimals, totalSupply] = await Promise.all([
    client.readContract({
      address: tokenAddress as Address,
      abi: [{ name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }],
      functionName: 'decimals',
    }),
    client.readContract({
      address: tokenAddress as Address,
      abi: [{ name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
      functionName: 'totalSupply',
    }),
  ]);

  trackedTokens.set(tokenAddress.toLowerCase(), {
    address: tokenAddress,
    symbol,
    decimals: Number(decimals),
    totalSupply: totalSupply as bigint,
    priceUsd,
  });

  console.log(`[WhaleTracking] Now tracking ${symbol} at ${tokenAddress}`);
}

/**
 * Update token price
 */
export function updateTokenPrice(tokenAddress: string, priceUsd: number): void {
  const token = trackedTokens.get(tokenAddress.toLowerCase());
  if (token) {
    token.priceUsd = priceUsd;
  }
}

/**
 * Get whale wallets for a specific token
 */
export async function getWhalesForToken(
  tokenAddress: string,
  network: 'mainnet' | 'testnet' = 'mainnet',
  limit: number = 20
): Promise<WhaleWallet[]> {
  const client = clients[network];
  const token = trackedTokens.get(tokenAddress.toLowerCase());

  if (!token) {
    throw new Error('Token not being tracked');
  }

  // Get recent transfer events to find large holders
  const logs = await client.getLogs({
    address: tokenAddress as Address,
    event: TRANSFER_EVENT,
    fromBlock: 'earliest',
    toBlock: 'latest',
  });

  // Aggregate balances from transfers
  const balances: Map<string, bigint> = new Map();

  for (const log of logs) {
    const from = log.args.from?.toLowerCase() || '';
    const to = log.args.to?.toLowerCase() || '';
    const value = log.args.value || 0n;

    if (from && from !== '0x0000000000000000000000000000000000000000') {
      const currentFrom = balances.get(from) || 0n;
      balances.set(from, currentFrom - value);
    }

    if (to && to !== '0x0000000000000000000000000000000000000000') {
      const currentTo = balances.get(to) || 0n;
      balances.set(to, currentTo + value);
    }
  }

  // Filter to whale wallets and sort by balance
  const whales: WhaleWallet[] = [];

  for (const [address, balance] of balances.entries()) {
    if (balance <= 0n) continue;

    const balanceFormatted = Number(balance) / Math.pow(10, token.decimals);
    const valueUsd = balanceFormatted * token.priceUsd;

    if (valueUsd < WHALE_THRESHOLD_USD) continue;

    const percentOfSupply = (Number(balance) / Number(token.totalSupply)) * 100;
    const known = KNOWN_ENTITIES[address];

    whales.push({
      address,
      label: known?.label,
      totalValueUsd: valueUsd,
      tokensHeld: [{
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        balance,
        balanceFormatted: balanceFormatted.toLocaleString(),
        valueUsd,
        percentOfSupply,
      }],
      lastActive: new Date(),
      isKnownEntity: !!known,
      entityType: known?.type,
    });
  }

  // Sort by value and limit
  whales.sort((a, b) => b.totalValueUsd - a.totalValueUsd);
  return whales.slice(0, limit);
}

/**
 * Get recent whale transactions for a token
 */
export async function getRecentWhaleTransactions(
  tokenAddress: string,
  network: 'mainnet' | 'testnet' = 'mainnet',
  hours: number = 24
): Promise<WhaleTransaction[]> {
  const client = clients[network];
  const token = trackedTokens.get(tokenAddress.toLowerCase());

  if (!token) {
    throw new Error('Token not being tracked');
  }

  // Calculate block range (approximate)
  const blocksPerHour = 1800; // ~2 second blocks on Base
  const currentBlock = await client.getBlockNumber();
  const fromBlock = currentBlock - BigInt(blocksPerHour * hours);

  const logs = await client.getLogs({
    address: tokenAddress as Address,
    event: TRANSFER_EVENT,
    fromBlock,
    toBlock: 'latest',
  });

  const transactions: WhaleTransaction[] = [];

  for (const log of logs) {
    const value = log.args.value || 0n;
    const amountFormatted = Number(value) / Math.pow(10, token.decimals);
    const valueUsd = amountFormatted * token.priceUsd;

    if (valueUsd < SIGNIFICANT_TX_THRESHOLD_USD) continue;

    const block = await client.getBlock({ blockHash: log.blockHash! });

    // Determine transaction type
    let type: WhaleTransaction['type'] = 'transfer';
    const from = log.args.from?.toLowerCase() || '';
    const to = log.args.to?.toLowerCase() || '';

    // Check if from/to is a DEX or exchange
    const fromKnown = KNOWN_ENTITIES[from];
    const toKnown = KNOWN_ENTITIES[to];

    if (fromKnown?.type === 'exchange' || from.includes('swap') || from.includes('router')) {
      type = 'buy';
    } else if (toKnown?.type === 'exchange' || to.includes('swap') || to.includes('router')) {
      type = 'sell';
    }

    transactions.push({
      hash: log.transactionHash!,
      from,
      to,
      tokenAddress: token.address,
      tokenSymbol: token.symbol,
      amount: value,
      amountFormatted: amountFormatted.toLocaleString(),
      valueUsd,
      timestamp: new Date(Number(block.timestamp) * 1000),
      type,
      isSignificant: valueUsd >= SIGNIFICANT_TX_THRESHOLD_USD * 2,
    });
  }

  // Sort by timestamp descending
  transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return transactions;
}

/**
 * Analyze whale activity patterns for a token
 */
export async function analyzeWhaleActivity(
  tokenAddress: string,
  network: 'mainnet' | 'testnet' = 'mainnet'
): Promise<{
  sentiment: 'bullish' | 'bearish' | 'neutral';
  accumulation: boolean;
  distribution: boolean;
  netFlow24h: number;
  topBuyers: { address: string; amount: number }[];
  topSellers: { address: string; amount: number }[];
  whaleConcentration: number;
}> {
  const token = trackedTokens.get(tokenAddress.toLowerCase());
  if (!token) {
    throw new Error('Token not being tracked');
  }

  const transactions = await getRecentWhaleTransactions(tokenAddress, network, 24);
  const whales = await getWhalesForToken(tokenAddress, network, 10);

  // Calculate net flows
  const flows: Map<string, number> = new Map();
  let totalBuys = 0;
  let totalSells = 0;

  for (const tx of transactions) {
    const amount = tx.valueUsd;

    if (tx.type === 'buy') {
      totalBuys += amount;
      flows.set(tx.to, (flows.get(tx.to) || 0) + amount);
    } else if (tx.type === 'sell') {
      totalSells += amount;
      flows.set(tx.from, (flows.get(tx.from) || 0) - amount);
    }
  }

  const netFlow24h = totalBuys - totalSells;

  // Find top buyers and sellers
  const topBuyers: { address: string; amount: number }[] = [];
  const topSellers: { address: string; amount: number }[] = [];

  for (const [address, flow] of flows.entries()) {
    if (flow > 0) {
      topBuyers.push({ address, amount: flow });
    } else if (flow < 0) {
      topSellers.push({ address, amount: Math.abs(flow) });
    }
  }

  topBuyers.sort((a, b) => b.amount - a.amount);
  topSellers.sort((a, b) => b.amount - a.amount);

  // Calculate whale concentration
  const totalWhaleHoldings = whales.reduce((sum, w) => sum + w.totalValueUsd, 0);
  const marketCap = (Number(token.totalSupply) / Math.pow(10, token.decimals)) * token.priceUsd;
  const whaleConcentration = marketCap > 0 ? (totalWhaleHoldings / marketCap) * 100 : 0;

  // Determine sentiment
  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  const flowRatio = totalBuys > 0 ? totalBuys / (totalBuys + totalSells) : 0.5;

  if (flowRatio > 0.6) sentiment = 'bullish';
  else if (flowRatio < 0.4) sentiment = 'bearish';

  return {
    sentiment,
    accumulation: netFlow24h > SIGNIFICANT_TX_THRESHOLD_USD * 2,
    distribution: netFlow24h < -SIGNIFICANT_TX_THRESHOLD_USD * 2,
    netFlow24h,
    topBuyers: topBuyers.slice(0, 5),
    topSellers: topSellers.slice(0, 5),
    whaleConcentration,
  };
}

/**
 * Generate whale alerts for a token
 */
export async function checkForAlerts(
  tokenAddress: string,
  projectId: string,
  network: 'mainnet' | 'testnet' = 'mainnet'
): Promise<WhaleAlert[]> {
  const token = trackedTokens.get(tokenAddress.toLowerCase());
  if (!token) return [];

  const newAlerts: WhaleAlert[] = [];
  const transactions = await getRecentWhaleTransactions(tokenAddress, network, 1);
  const whales = await getWhalesForToken(tokenAddress, network, 10);

  // Check for large transfers
  for (const tx of transactions) {
    if (tx.valueUsd >= SIGNIFICANT_TX_THRESHOLD_USD * 5) {
      const severity = tx.valueUsd >= SIGNIFICANT_TX_THRESHOLD_USD * 20 ? 'critical' :
                       tx.valueUsd >= SIGNIFICANT_TX_THRESHOLD_USD * 10 ? 'high' : 'medium';

      newAlerts.push({
        id: `whale-tx-${tx.hash}`,
        type: 'large_transfer',
        severity,
        projectId,
        tokenAddress,
        walletAddress: tx.from,
        description: `Large ${tx.type} detected: ${tx.amountFormatted} ${token.symbol} ($${tx.valueUsd.toLocaleString()})`,
        details: {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          amount: tx.amountFormatted,
          valueUsd: tx.valueUsd,
          type: tx.type,
        },
        timestamp: tx.timestamp,
      });
    }
  }

  // Check for high concentration whales
  for (const whale of whales) {
    const holding = whale.tokensHeld[0];
    if (holding && holding.percentOfSupply >= SUPPLY_PERCENTAGE_ALERT) {
      const severity = holding.percentOfSupply >= 20 ? 'critical' :
                       holding.percentOfSupply >= 10 ? 'high' : 'medium';

      newAlerts.push({
        id: `whale-conc-${whale.address}-${Date.now()}`,
        type: 'accumulation',
        severity,
        projectId,
        tokenAddress,
        walletAddress: whale.address,
        description: `Whale holds ${holding.percentOfSupply.toFixed(2)}% of ${token.symbol} supply`,
        details: {
          wallet: whale.address,
          label: whale.label,
          balance: holding.balanceFormatted,
          percentOfSupply: holding.percentOfSupply,
          valueUsd: holding.valueUsd,
        },
        timestamp: new Date(),
      });
    }
  }

  return newAlerts;
}

/**
 * Get whale wallet info with labels
 */
export function getWalletInfo(address: string): { label?: string; type?: string; isKnown: boolean } {
  const known = KNOWN_ENTITIES[address.toLowerCase()];
  return {
    label: known?.label,
    type: known?.type,
    isKnown: !!known,
  };
}

/**
 * Add a custom wallet label
 */
export function addWalletLabel(
  address: string,
  label: string,
  type: WhaleWallet['entityType']
): void {
  KNOWN_ENTITIES[address.toLowerCase()] = { label, type };
}

// Export for API routes
export const whaleTrackingService = {
  trackToken,
  updateTokenPrice,
  getWhalesForToken,
  getRecentWhaleTransactions,
  analyzeWhaleActivity,
  checkForAlerts,
  getWalletInfo,
  addWalletLabel,
};

export default whaleTrackingService;
