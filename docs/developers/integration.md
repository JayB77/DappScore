# Integration Guide

Learn how to integrate DappScore into your project or application.

## Quick Start

### Install Dependencies

```bash
npm install wagmi viem @tanstack/react-query
```

### Configure Chain

```typescript
import { base, baseSepolia } from 'wagmi/chains';
import { createConfig, http } from 'wagmi';

export const config = createConfig({
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});
```

### Contract Addresses

```typescript
export const CONTRACT_ADDRESSES = {
  // Base Mainnet
  [8453]: {
    projectRegistry: 'Coming Soon',
    votingEngine: 'Coming Soon',
    premiumListings: 'Coming Soon',
    scoreToken: 'Coming Soon',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  // Base Sepolia
  [84532]: {
    projectRegistry: 'Coming Soon',
    votingEngine: 'Coming Soon',
    premiumListings: 'Coming Soon',
    scoreToken: 'Coming Soon',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
};
```

## Reading Project Data

### Get Project by ID

```typescript
import { useReadContract } from 'wagmi';

function useProject(projectId: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES[chainId].projectRegistry,
    abi: PROJECT_REGISTRY_ABI,
    functionName: 'getProject',
    args: [BigInt(projectId)],
  });
}
```

### Get Project Score

```typescript
function useProjectScore(projectId: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES[chainId].votingEngine,
    abi: VOTING_ENGINE_ABI,
    functionName: 'getProjectScore',
    args: [BigInt(projectId)],
  });
}
```

## Submitting Projects

### Submit a New Project

```typescript
import { useWriteContract } from 'wagmi';

function useSubmitProject() {
  const { writeContractAsync } = useWriteContract();

  const submit = async (project: ProjectData) => {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES[chainId].projectRegistry,
      abi: PROJECT_REGISTRY_ABI,
      functionName: 'submitProject',
      args: [
        project.name,
        project.symbol,
        project.category,
        project.description,
        project.metadataUri,
      ],
    });
    return hash;
  };

  return { submit };
}
```

## Voting on Projects

### Cast a Vote

```typescript
function useVote() {
  const { writeContractAsync } = useWriteContract();

  const vote = async (projectId: number, isUpvote: boolean, comment: string) => {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES[chainId].votingEngine,
      abi: VOTING_ENGINE_ABI,
      functionName: 'vote',
      args: [BigInt(projectId), isUpvote, comment],
    });
    return hash;
  };

  return { vote };
}
```

## Premium Listings

### Check Premium Status

```typescript
function useIsPremium(projectId: number) {
  return useReadContract({
    address: CONTRACT_ADDRESSES[chainId].premiumListings,
    abi: PREMIUM_LISTINGS_ABI,
    functionName: 'isPremium',
    args: [BigInt(projectId)],
  });
}
```

### Purchase Premium (USDC)

```typescript
function usePurchasePremium() {
  const { writeContractAsync } = useWriteContract();

  const purchase = async (projectId: number, months: number = 1) => {
    // First approve USDC spending
    await writeContractAsync({
      address: CONTRACT_ADDRESSES[chainId].usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [
        CONTRACT_ADDRESSES[chainId].premiumListings,
        BigInt(100_000000 * months), // 100 USDC per month
      ],
    });

    // Then purchase premium
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES[chainId].premiumListings,
      abi: PREMIUM_LISTINGS_ABI,
      functionName: 'purchasePremium',
      args: [BigInt(projectId), BigInt(months)],
    });
    return hash;
  };

  return { purchase };
}
```

## Displaying Widgets

### Embed Trust Score Badge

```html
<iframe
  src="https://dappscore.io/embed/badge/:projectId"
  width="200"
  height="60"
  frameborder="0"
></iframe>
```

### Embed Full Widget

```html
<iframe
  src="https://dappscore.io/embed/widget/:projectId"
  width="400"
  height="300"
  frameborder="0"
></iframe>
```

## Best Practices

1. **Error Handling**: Always wrap contract calls in try-catch
2. **Loading States**: Show loading indicators during transactions
3. **Confirmation**: Wait for transaction confirmation before updating UI
4. **Network Checks**: Verify user is on correct network (Base)
5. **Gas Estimation**: Let wallet estimate gas, don't hardcode

## Support

- [API Reference](api.md)
- [Discord Community](https://discord.gg/dappscore)
- [GitHub Discussions](https://github.com/dappscore/platform/discussions)
