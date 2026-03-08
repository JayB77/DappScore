# 📊 Token Distribution

Shows how a token's supply is distributed among holders — critical for identifying insider concentration and whale risk.

---

## What It Shows

| Metric | Description |
|--------|-------------|
| 🏆 **Top 10 holders** | Addresses holding the most tokens, with % of supply |
| 🐳 **Concentration score** | How much of supply is held by the top 10 |
| 🔥 **Burn address** | Whether any supply has been permanently burned |
| 📊 **Distribution chart** | Visual breakdown of holder spread |

---

## Risk Thresholds

| Top-10 Concentration | Risk Level |
|----------------------|------------|
| < 30% | ✅ Well distributed |
| 30–50% | ⚠️ Moderate concentration |
| 50–70% | 🟠 High concentration |
| > 70% | 🚨 Extreme concentration — whale risk |

{% hint style="warning" %}
High concentration means a small number of wallets can crash the price at any time. Exchanges and locked liquidity contracts typically appear in top holders — filter these out when assessing real concentration.
{% endhint %}

---

## Recognized Address Types

Known addresses are labelled automatically:

| Label | Meaning |
|-------|---------|
| 🔥 Burn | Tokens permanently destroyed |
| 🏦 Exchange | CEX hot/cold wallet |
| 🔒 Lock Contract | Team Finance, PinkLock, etc. |
| 📜 Contract | Generic smart contract |

---

## Multi-Chain Support

Token distribution data is fetched from:

| Chain | Source |
|-------|--------|
| Ethereum | Ethplorer (free API key) |
| Base, Polygon, BSC, Arbitrum, Optimism, Avalanche, Fantom, Linea, and more | Moralis Token API |
| Solana | Moralis Solana API |
| Tron | TronGrid |
| TON | TON Center |
| NEAR | NearBlocks |

---

## Limitations

- Very new tokens may have incomplete holder data
- Ethplorer free tier covers Ethereum only; Moralis covers 15+ EVM chains
- Holder data is a snapshot — it changes constantly as tokens trade
