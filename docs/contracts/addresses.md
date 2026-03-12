# Contract Addresses

All DappScore smart contracts are deployed on **Base** (Coinbase's Ethereum L2).

{% hint style="danger" %}
**Always verify addresses through this page before interacting with any contract.** DappScore will never DM you contract addresses.
{% endhint %}

***

## Core Contracts

| Contract            | Description                                  | Mainnet     | Testnet (Base Sepolia) |
| ------------------- | -------------------------------------------- | ----------- | ---------------------- |
| **ScoreToken**      | $SCORE ERC-20 governance token (100M supply) | Coming Soon | Coming Soon            |
| **ProjectRegistry** | Project listing and management               | Coming Soon | Coming Soon            |
| **VotingEngine**    | Voting, staking, and $SCORE rewards          | Coming Soon | Coming Soon            |
| **TokenSale**       | 3-stage fair launch token sale               | Coming Soon | Coming Soon            |
| **PremiumListings** | Premium listing payments (100 USDC)          | Coming Soon | Coming Soon            |

***

## Feature Contracts

| Contract             | Description                             | Mainnet     | Testnet     |
| -------------------- | --------------------------------------- | ----------- | ----------- |
| **CuratorNFT**       | Curator badge NFTs for top contributors | Coming Soon | Coming Soon |
| **ReputationSystem** | On-chain reputation tracking            | Coming Soon | Coming Soon |
| **PredictionMarket** | Community scam prediction markets       | Coming Soon | Coming Soon |
| **BountySystem**     | Investigation bounties for scam hunters | Coming Soon | Coming Soon |
| **InsurancePool**    | Community-funded scam insurance         | Coming Soon | Coming Soon |
| **Watchlist**        | Personal and public on-chain watchlists | Coming Soon | Coming Soon |
| **AffiliateProgram** | Referral rewards system                 | Coming Soon | Coming Soon |

***

## Network Details

|              | Base Mainnet                         | Base Sepolia (Testnet)                               |
| ------------ | ------------------------------------ | ---------------------------------------------------- |
| **Chain ID** | 8453                                 | 84532                                                |
| **Explorer** | [basescan.org](https://basescan.org) | [sepolia.basescan.org](https://sepolia.basescan.org) |
| **RPC**      | `https://mainnet.base.org`           | `https://sepolia.base.org`                           |
| **Symbol**   | ETH                                  | ETH                                                  |
| **Status**   | 🔜 Coming Soon                       | ✅ Live                                               |

***

## Contract Architecture

All contracts use **UUPS proxy** pattern (upgradeable), secured by:

* Multi-sig admin control
* Time-locked upgrades
* Separate treasury and protocol fee wallets
* Emergency pause functionality

***

## Official Wallets

For payment receiver, protocol fee, team, and deployer wallet addresses, see the [Official Wallets](wallets.md) page.

***

## Source Code

All contract source code is open source and will be verified on BaseScan at deployment. The full source is available in the [GitHub repository](https://github.com/DappScore/platform_private).

***

{% hint style="info" %}
Contract addresses will be published here before mainnet launch. Subscribe to official channels for the announcement.
{% endhint %}
