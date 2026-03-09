# 💧 DEX Liquidity

Shows the real trading activity for a token across decentralized exchanges.

---

## What It Shows

DappScore queries **[DexScreener](https://dexscreener.com)** for all trading pairs associated with the token contract.

| Metric | Description |
|--------|-------------|
| 💲 **Price** | Current token price in USD |
| 🏊 **Liquidity** | Total USD value in the liquidity pool |
| 📊 **24h Volume** | Total buy + sell volume in the last 24 hours |
| 📈 **Price Change** | 5m / 1h / 6h / 24h % change |
| 🟢 **Buys / Sells** | Number of buy vs sell transactions (24h) |
| 🔗 **DEX** | Which exchange the pair trades on |

---

## What to Look For

| Signal | Good | Concerning |
|--------|------|------------|
| Liquidity | > $50,000 | < $5,000 (easily manipulated) |
| Volume | Consistent 24h activity | Sudden spike then nothing |
| Buy/Sell ratio | Balanced | 90%+ buys (bot activity) |
| Price change | Gradual movement | ±90% in an hour |

---

## Multiple Pairs

If a token is listed on multiple DEXs or chains, all pairs are shown. The panel will indicate the exchange name (Uniswap, PancakeSwap, Aerodrome, etc.) alongside each pair.

---

## No Liquidity Found

If DexScreener returns no pairs, the panel shows **"No trading pairs found"**. This is normal for:

- Pre-launch tokens
- Projects that only trade on CEXs
- Very new listings not yet indexed

{% hint style="info" %}
DexScreener data is fetched in real time with no additional setup required.
{% endhint %}
