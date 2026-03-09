# 🐋 Whale Tracker

Monitors the largest token transfers in the past 24 hours — revealing insider activity, coordinated dumps, and unusual whale movements.

---

## What It Shows

### 24h Summary Stats

| Metric | Description |
|--------|-------------|
| 📊 **Transfers 24h** | Total number of ERC-20 transfers |
| 💲 **Volume 24h** | Total token volume moved |
| 📏 **Avg Size** | Average transfer amount |

### Activity Trend

| Trend | Meaning |
|-------|---------|
| 🟢 Low activity | Normal background transfer activity |
| 🟡 Moderate activity | Elevated transfers — worth monitoring |
| 🟠 High activity | Unusual spike — potential coordinated action (`WATCH` alert) |

### Top 10 Transfers

The largest transfers in the last 24 hours, showing:

- **From** wallet → **To** wallet (linked to block explorer)
- Token **amount** moved
- Transaction link for verification
- 🔥 **Burn** label for transfers to dead/zero addresses

---

## What to Watch For

| Pattern | Concern |
|---------|---------|
| Large transfers from team/dev wallet | Team preparing to sell |
| Multiple large transfers in quick succession | Coordinated dump in progress |
| Transfers to CEX deposit addresses | Whales moving to exchange to sell |
| 🔥 Burn transfers | Supply reduction — can be positive |

---

## Data Source

Powered by **Alchemy Asset Transfers API** — real-time ERC-20 transfer data with full transaction metadata.

---

## Supported Chains

Works on all EVM chains with Alchemy coverage:

Ethereum, Base, Polygon, BSC, Arbitrum, Optimism, Avalanche, Blast, Gnosis, Linea, Scroll, Mantle, Mode, and more.

---

## Limitations

- 24h window only — historical whale analysis not currently available
- Non-EVM chains (Solana, TON, Tron) are not yet supported

{% hint style="info" %}
The Whale Tracker can be toggled independently in the admin panel.
{% endhint %}
