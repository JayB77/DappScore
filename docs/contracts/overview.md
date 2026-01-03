# Contract Overview

DappScore is built on a suite of smart contracts deployed on Base blockchain.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        DappScore                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ ScoreToken  │  │  Voting     │  │  Premium Listings   │  │
│  │   (ERC20)   │  │   Engine    │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │               │                    │               │
│         └───────────────┴────────────────────┘               │
│                         │                                    │
│              ┌─────────────────────┐                         │
│              │  Project Registry   │                         │
│              └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## Deployed Contracts

### Base Sepolia (Testnet)

| Contract | Address | Status |
|----------|---------|--------|
| USDC (Circle) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | External |
| ScoreToken | Coming Soon | Pending |
| ProjectRegistry | Coming Soon | Pending |
| VotingEngine | Coming Soon | Pending |
| PremiumListings | Coming Soon | Pending |

### Base Mainnet

| Contract | Address | Status |
|----------|---------|--------|
| USDC (Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | External |
| ScoreToken | Coming Soon | Pending |
| ProjectRegistry | Coming Soon | Pending |
| VotingEngine | Coming Soon | Pending |
| PremiumListings | Coming Soon | Pending |

## Contract Descriptions

### ScoreToken
ERC-20 token with a max supply of 100,000,000 $SCORE. Used for governance, staking, and rewards.

### ProjectRegistry
Stores all project submissions with metadata, ownership, and verification status.

### VotingEngine
Handles upvotes/downvotes with reputation-weighted voting power.

### PremiumListings
Manages featured listings and USDC payments.

## Audits

Smart contract audits will be conducted before mainnet launch. Audit reports will be published here.

## Open Source

All contracts are open source and available on GitHub:
- [View Contracts](https://github.com/ICO-Trust/platform_private/tree/main/contracts)
