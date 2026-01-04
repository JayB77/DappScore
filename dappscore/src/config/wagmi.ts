import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'DappScore',
  projectId: '621bdd56c6b4f8f819a93e0353018b98',
  chains: [base, baseSepolia],
  ssr: true,
});

// Premium listing price in USDC (6 decimals)
// Configurable via environment variable - defaults to 100 USDC
const DEFAULT_PREMIUM_PRICE_USDC = 100;
export const PREMIUM_LISTING_PRICE = BigInt(
  (parseInt(process.env.NEXT_PUBLIC_PREMIUM_LISTING_PRICE || String(DEFAULT_PREMIUM_PRICE_USDC)) * 1_000000)
); // USDC has 6 decimals

// Payment receiver address (your wallet to receive payments)
export const PAYMENT_RECEIVER = '0x3b4368820c0A03ebd2B5C688b3CBC0A3B31C41B7';

// Contract addresses (update after deployment)
export const CONTRACT_ADDRESSES = {
  // Base Mainnet
  [base.id]: {
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Official Base USDC
    usdt: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // Bridged USDT on Base
    scoreToken: '0x0000000000000000000000000000000000000000',
    projectRegistry: '0x0000000000000000000000000000000000000000',
    votingEngine: '0x0000000000000000000000000000000000000000',
    premiumListings: '0x0000000000000000000000000000000000000000',
    tokenSale: '0x0000000000000000000000000000000000000000',
    curatorNFT: '0x0000000000000000000000000000000000000000',
  },
  // Base Sepolia (testnet)
  [baseSepolia.id]: {
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
    usdt: '0x0000000000000000000000000000000000000000', // No official testnet USDT - deploy mock
    scoreToken: '0x0000000000000000000000000000000000000000',
    projectRegistry: '0x0000000000000000000000000000000000000000',
    votingEngine: '0x0000000000000000000000000000000000000000',
    premiumListings: '0x0000000000000000000000000000000000000000',
    tokenSale: '0x0000000000000000000000000000000000000000',
    curatorNFT: '0x0000000000000000000000000000000000000000',
  },
} as const;

// Payment methods supported
export type PaymentMethod = 'ETH' | 'USDC' | 'USDT';

export const PAYMENT_METHODS: { id: PaymentMethod; name: string; decimals: number }[] = [
  { id: 'ETH', name: 'Ethereum', decimals: 18 },
  { id: 'USDC', name: 'USD Coin', decimals: 6 },
  { id: 'USDT', name: 'Tether', decimals: 6 },
];

// ERC20 ABI for USDC transfers
export const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;
