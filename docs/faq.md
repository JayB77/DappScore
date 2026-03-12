# FAQ

Quick answers to common questions.

***

## 🌐 General

<details>

<summary><strong>What is DappScore?</strong></summary>

A community-driven platform for vetting crypto projects across 50+ blockchains. Users vote, comment, and earn $SCORE tokens for helping identify trustworthy projects. Each project page also runs 9 automated on-chain security checks (honeypot, DEX liquidity, liquidity lock, deployer history, and more).

</details>

<details>

<summary><strong>What blockchain is DappScore on?</strong></summary>

DappScore's smart contracts run on **Base** (Coinbase's Layer 2). However, you can list and research projects from 50+ chains including Ethereum, Solana, BSC, Polygon, Arbitrum, TON, Tron, NEAR, Starknet, and many more.

</details>

<details>

<summary><strong>Is DappScore free to use?</strong></summary>

Yes! Browsing, voting, commenting, and security signals are all free. Only premium listings cost 100 USDC.

</details>

***

## 🦊 Wallet & Connection

<details>

<summary><strong>Which wallets are supported?</strong></summary>

Any WalletConnect-compatible wallet:

* MetaMask
* Coinbase Wallet
* Rainbow
* Trust Wallet
* And many more via WalletConnect v2

</details>

<details>

<summary><strong>Do I need ETH?</strong></summary>

Yes, a small amount of ETH on Base for gas fees (< $0.01 per transaction).

</details>

<details>

<summary><strong>How do I switch to Base?</strong></summary>

Your wallet will prompt you automatically. Or manually add:

| Setting  | Value                    |
| -------- | ------------------------ |
| Network  | Base                     |
| RPC      | https://mainnet.base.org |
| Chain ID | 8453                     |
| Symbol   | ETH                      |

</details>

***

## 🗳️ Voting & Reputation

<details>

<summary><strong>How does voting work?</strong></summary>

1. Connect wallet
2. Go to any project page
3. Review the security signals and community comments
4. Click **Trust** ✅ or **Distrust** ❌
5. Your vote is recorded on-chain and you earn $SCORE

</details>

<details>

<summary><strong>What determines vote weight?</strong></summary>

Your reputation level and account age:

| Level      | Weight |
| ---------- | ------ |
| New/Member | 1x     |
| Active     | 2x     |
| Trusted    | 3x     |

Higher account age also adds a multiplier (up to 1.25x for 90+ day accounts).

</details>

<details>

<summary><strong>Can I change my vote?</strong></summary>

Not currently. Votes are permanent once submitted on-chain.

</details>

<details>

<summary><strong>How do I build reputation?</strong></summary>

* Vote on projects (+5 rep per vote)
* Write quality comments that get upvoted (+10 per upvote)
* Vote accurately (align with eventual consensus) (+10 bonus)
* Report confirmed scams (+100)

</details>

***

## 🛡️ Security Signals

<details>

<summary><strong>What are security signals?</strong></summary>

9 automated on-chain and off-chain checks that run on every project:

1. **Honeypot Detector** — can the token be sold?
2. **DEX Liquidity** — is there real trading activity?
3. **Liquidity Lock** — is the LP locked?
4. **Deployer History** — has this wallet rugge before?
5. **Token Distribution** — are whales in control?
6. **Audit Badges** — has it been audited?
7. **Social Proof** — does it have a real community?
8. **Whale Tracker** — are there suspicious large transfers?
9. **Contract Fingerprint** — is it verified and transparent?

</details>

<details>

<summary><strong>Are the signals always accurate?</strong></summary>

Signals rely on third-party APIs and public blockchain data — they are informational, not definitive. A project can pass all signals and still be a scam, or fail some for legitimate reasons. Always do your own research.

</details>

<details>

<summary><strong>What chains do signals support?</strong></summary>

Honeypot, deployer history, DEX liquidity, and contract fingerprint work on 20+ EVM chains. Token distribution supports EVM chains, Solana, Tron, TON, and NEAR. See the [Supported Chains](multichain/overview.md) page for the full list.

</details>

***

## 📝 Projects

<details>

<summary><strong>How do I submit a project?</strong></summary>

Click "Submit Project", fill out the form with your project's details, add contract addresses for each chain you're deployed on, choose Free or Premium, and submit.

👉 [Full guide](platform/submitting-projects.md)

</details>

<details>

<summary><strong>Can I add contracts on multiple chains?</strong></summary>

Yes! When submitting or editing your project, you can add contract addresses for as many chains as you're deployed on. Each one gets independently analysed.

</details>

<details>

<summary><strong>Can I edit after submission?</strong></summary>

Yes, if you verified ownership by signing a message with your deployer wallet. Click "Edit Project" on your project page.

</details>

<details>

<summary><strong>Free vs Premium difference?</strong></summary>

| Feature              | Free | Premium    |
| -------------------- | ---- | ---------- |
| Listed in directory  | ✅    | ✅          |
| All security signals | ✅    | ✅          |
| Community voting     | ✅    | ✅          |
| Featured placement   | ❌    | ✅ (7 days) |
| Premium badge        | ❌    | ✅          |
| Cost                 | $0   | 100 USDC   |

</details>

***

## 🪙 $SCORE Token

<details>

<summary><strong>What is $SCORE used for?</strong></summary>

* Governance voting on platform proposals
* Staking for passive rewards
* Payment for premium features (with discount vs USDC)
* Earned as rewards for contributing to the platform

</details>

<details>

<summary><strong>How do I earn $SCORE?</strong></summary>

* Vote on projects: 10 $SCORE per vote
* First vote on a new listing: 20 $SCORE
* Comment gets upvoted: 5 $SCORE per upvote
* Valid scam report: 100–500 $SCORE
* Stake tokens: 5–12% APY

</details>

<details>

<summary><strong>Where can I buy $SCORE?</strong></summary>

* Token sale at [dappscore.io](https://dappscore.io) (3-stage fair launch)
* DEX trading after launch (Aerodrome / Uniswap on Base)

</details>

<details>

<summary><strong>What's the total supply?</strong></summary>

100,000,000 $SCORE (fixed supply, no inflation).

</details>

***

## 🔒 Security

<details>

<summary><strong>Is DappScore audited?</strong></summary>

Smart contract audits are planned before mainnet launch. Reports will be published publicly when available.

</details>

<details>

<summary><strong>How do I report a scam project?</strong></summary>

Click "Report Project" at the bottom of any project page and provide evidence. Valid reports earn $SCORE rewards.

👉 [Scam Reporting Guide](platform/scam-reporting.md)

</details>

<details>

<summary><strong>Found a security bug?</strong></summary>

Contact us through official channels (Discord/Telegram — coming soon). Please do not disclose publicly.

</details>

***

## 📞 Contact

| Channel   | Status                               |
| --------- | ------------------------------------ |
| Website   | [dappscore.io](https://dappscore.io) |
| Discord   | Coming soon                          |
| Twitter/X | Coming soon                          |
| Telegram  | Coming soon                          |
