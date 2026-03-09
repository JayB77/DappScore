# 🔍 Project Detail Page

Every project on DappScore has a dedicated detail page that surfaces all available information, security signals, and community data in one place.

---

## Page Layout

### Top Section — Project Overview

| Element | Description |
|---------|-------------|
| **Name & Symbol** | Project name and token ticker |
| **Category & Chain** | Type (DeFi, Gaming, AI...) and primary chain |
| **Description** | Project description |
| **Trust Badge** | Community trust level (Trusted / Neutral / Suspicious / Suspected Scam) |
| **Website & Social Links** | Direct links to all official channels |
| **Whitepaper** | Link to whitepaper or pitch deck |
| **Team** | Team members with roles and LinkedIn profiles |
| **Contract Addresses** | All deployed contracts by chain |

---

### Voting Section

Cast your vote and see the current community consensus:

| Element | Description |
|---------|-------------|
| 👍 **Trust** | Vote that you believe this project is legitimate |
| 👎 **Distrust** | Vote that you have concerns |
| **Vote count** | Total trust and distrust votes |
| **Trust ratio** | % of weighted votes that are Trust |
| **Your SCORE reward** | $SCORE earned for voting |

Your vote is recorded on-chain via the VotingEngine contract.

---

### DappScore Composite Panel

The **DappScore** (0–100) is a composite safety score combining:

- Community vote ratio and volume
- Domain age signal
- GitHub activity (commit recency, repo health)
- Social proof (community size)

| Score Range | Rating |
|-------------|--------|
| 80–100 | 🟢 Highly Trusted |
| 60–79 | 🟡 Generally Trusted |
| 40–59 | 🟠 Neutral / DYOR |
| 20–39 | 🔴 Suspicious |
| 0–19 | 🚨 High Risk |

---

### Token Sale Panel

If the project has an active or past token sale, the Token Sale panel shows:

- Sale progress (amount raised vs hard cap)
- Current stage (Stage 1 / 2 / 3 for 3-stage fair launches)
- Token price and payment methods accepted
- Time remaining until sale ends
- Link to participate

This data is provided by the project owner — DappScore never holds or processes sale funds.

---

### Security Signal Panels

Nine automated on-chain signal panels are displayed for every project with a contract address:

| Panel | Data |
|-------|------|
| 🍯 **Honeypot** | Can the token be sold? Tax analysis |
| 💧 **DEX Liquidity** | Price, volume, liquidity, buy/sell pressure |
| 🔒 **Liquidity Lock** | LP lock status, platform, expiry date |
| 🕵️ **Deployer History** | Other contracts from the same deployer wallet |
| 📊 **Token Distribution** | Top 10 holders, concentration %, burn detection |
| 🏅 **Audit Badges** | Verified security audit records |
| 👥 **Social Proof** | Discord members, online count, Telegram link |
| 🐋 **Whale Tracker** | 24h transfer volume, trend, top movements |
| 🔍 **Contract Fingerprint** | Source verification, proxy detection, 20+ chains |

Each panel can be toggled by the platform admin. See [Security Signals](../signals/overview.md) for detailed documentation on each.

---

### External Signals Panel

Shows domain age (RDAP lookup) and GitHub activity (last commit date, star count, open issues) — free public APIs, no key required.

---

### Comments & Discussion

Community members can:
- Leave comments explaining their vote rationale
- Upvote or downvote others' comments
- Share evidence (links, transaction hashes)
- Get $SCORE rewards when their comments are upvoted

---

### Report Button

At the bottom of every project page is a **"Report Project"** button. Use this if you have evidence that a project is a scam or violates platform rules.

See [Scam Reporting](scam-reporting.md) for how reports work.
