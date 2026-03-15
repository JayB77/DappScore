# Deep Analysis

The **Deep Analysis** page gives you a dedicated, full-screen view of every automated security signal for a project — broken into focused sections with a sticky navigation bar so you can jump between them instantly.

Access it from any project detail page by clicking **"Deep Analysis →"**.

---

## Navigation

The sticky header at the top of the page shows:

* A back link to the project detail page
* The page title ("Deep Analysis")
* The chain the project is deployed on

Below the header, pill buttons let you jump to any section without scrolling:

| Pill | Section |
|------|---------|
| 🛡️ Security | Honeypot + GoPlus risk flags |
| 💧 Liquidity | DEX price, volume, and buy/sell pressure |
| 🔒 LP Locks | Liquidity lock status and expiry |
| 📊 Holders | Token distribution and top holders |
| 🕵️ Deployer | Deployer wallet history |
| 🐋 Whales | Large 24h transfers and trends |
| 📅 Events | Recent on-chain activity |

The active pill highlights automatically as you scroll through sections.

---

## Sections

### 🛡️ Security

Combines the **Honeypot Detector** and **GoPlus Security API** results:

* Can the token be sold?
* Buy / sell tax percentages
* Risk flags: ownership not renounced, proxy contract, modifiable taxes, blacklist function detected

See [Honeypot Detector](../signals/honeypot.md) for full details.

---

### 💧 Liquidity

Live data from DexScreener:

* Token price (USD) and 24h change
* 24h volume and liquidity depth
* Buy vs sell transaction pressure
* Price chart (5m, 1h, 6h, 24h)

See [DEX Liquidity](../signals/dex-liquidity.md) for full details.

---

### 🔒 LP Locks

Checks Team Finance and PinkLock for locked liquidity positions:

* Lock status (Locked / Unlocked / No data)
* Locked amount and percentage of total LP
* Unlock date and time remaining
* Locking platform

See [Liquidity Lock](../signals/liquidity-lock.md) for full details.

---

### 📊 Holders

Token distribution data from Moralis / Ethplorer:

* Total holder count
* Top 10 holder addresses and percentages
* Whale concentration warning if top-10 hold > 50%
* Burn address detection (tokens sent to 0x000…)

See [Token Distribution](../signals/token-distribution.md) for full details.

---

### 🕵️ Deployer

History of the wallet that deployed the contract:

* All contracts deployed from the same address
* Age of each contract
* Flagged if deployer has a history of short-lived contracts (rug pattern)

See [Deployer History](../signals/deployer-history.md) for full details.

---

### 🐋 Whales

24-hour large transfer analysis via Alchemy:

* Total volume moved by wallets over the threshold
* Number of whale transactions
* Trend: accumulating or distributing
* Top individual movements (wallet → wallet, amount)

See [Whale Tracker](../signals/whale-tracker.md) for full details.

---

### 📅 Events

Recent on-chain events from the token contract:

* Transfer, Approval, and custom events
* Transaction hash links to block explorer
* Timestamp and block number

---

## URL Structure

Deep Analysis pages follow the pattern:

```
https://dappscore.io/projects/{contractAddress}/analysis
```

This URL is bookmarkable and shareable — it loads the same live data every time.
