import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'DappScore',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [base, baseSepolia],
  ssr: true,
});

// Contract addresses (update after deployment)
export const CONTRACT_ADDRESSES = {
  // Base Mainnet
  [base.id]: {
    scoreToken: '0x0000000000000000000000000000000000000000',
    projectRegistry: '0x0000000000000000000000000000000000000000',
    votingEngine: '0x0000000000000000000000000000000000000000',
    premiumListings: '0x0000000000000000000000000000000000000000',
    tokenSale: '0x0000000000000000000000000000000000000000',
  },
  // Base Sepolia (testnet)
  [baseSepolia.id]: {
    scoreToken: '0x0000000000000000000000000000000000000000',
    projectRegistry: '0x0000000000000000000000000000000000000000',
    votingEngine: '0x0000000000000000000000000000000000000000',
    premiumListings: '0x0000000000000000000000000000000000000000',
    tokenSale: '0x0000000000000000000000000000000000000000',
  },
} as const;
