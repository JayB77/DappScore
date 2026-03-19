/**
 * DappScore Web3 Configuration
 *
 * CONTRACT DEPLOYMENT:
 * 1. cd dappscore/contracts
 * 2. cp .env.example .env && edit .env with your keys
 * 3. Deploy: forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify
 * 4. Copy the deployed addresses from console output below
 * 5. Run setup: forge script script/Setup.s.sol:Setup --rpc-url base_sepolia --broadcast
 *
 * After deployment, update CONTRACT_ADDRESSES below with the real addresses.
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, base, baseSepolia } from 'wagmi/chains';

// Wallet connection is Base + Ethereum only.
// All other chains (Arbitrum, Solana, Polygon, etc.) are tracked in
// src/config/chains.ts for project metadata display only.
// Falls back to a placeholder so `next build` doesn't crash when the env var
// isn't set. WalletConnect will be non-functional with the placeholder — set
// NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local for a working connection.
export const config = getDefaultConfig({
  appName: 'DappScore',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '00000000000000000000000000000000',
  chains: [base, baseSepolia, mainnet],
  ssr: true,
});

// Contract addresses (update after deployment)
export const CONTRACT_ADDRESSES = {
  // Base Mainnet
  [base.id]: {
    // Stablecoins
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Official Base USDC
    usdt: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // Bridged USDT on Base
    // Core contracts
    scoreToken: '0x0000000000000000000000000000000000000000',
    projectRegistry: '0x0000000000000000000000000000000000000000',
    votingEngine: '0x0000000000000000000000000000000000000000',
    tokenSale: '0x0000000000000000000000000000000000000000',
    curatorNFT: '0x0000000000000000000000000000000000000000',
    // Feature contracts
    reputationSystem: '0x0000000000000000000000000000000000000000',
    predictionMarket: '0x0000000000000000000000000000000000000000',
    bountySystem: '0x0000000000000000000000000000000000000000',
    insurancePool: '0x0000000000000000000000000000000000000000',
    watchlist: '0x0000000000000000000000000000000000000000',
    affiliateProgram: '0x0000000000000000000000000000000000000000',
  },
  // Base Sepolia (testnet)
  [baseSepolia.id]: {
    // Stablecoins
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
    usdt: '0x0000000000000000000000000000000000000000', // No official testnet USDT - deploy mock
    // Core contracts
    scoreToken: '0x0000000000000000000000000000000000000000',
    projectRegistry: '0x0000000000000000000000000000000000000000',
    votingEngine: '0x0000000000000000000000000000000000000000',
    tokenSale: '0x0000000000000000000000000000000000000000',
    curatorNFT: '0x0000000000000000000000000000000000000000',
    // Feature contracts
    reputationSystem: '0x0000000000000000000000000000000000000000',
    predictionMarket: '0x0000000000000000000000000000000000000000',
    bountySystem: '0x0000000000000000000000000000000000000000',
    insurancePool: '0x0000000000000000000000000000000000000000',
    watchlist: '0x0000000000000000000000000000000000000000',
    affiliateProgram: '0x0000000000000000000000000000000000000000',
  },
} as const;

