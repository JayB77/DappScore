# 🍯 Honeypot Detector

Honeypots are tokens designed so you can buy them freely — but can never sell.

---

## What It Checks

DappScore runs every EVM token address through **[honeypot.is](https://honeypot.is)** — a public API that simulates buy and sell transactions against the token's contract to detect sell restrictions.

| Check | Result |
|-------|--------|
| ✅ Buy simulation | Can you buy? |
| ✅ Sell simulation | Can you sell? |
| ✅ Tax analysis | Buy/sell tax percentages |
| ✅ Max transaction | Is there a hidden max sell? |

---

## Possible Results

| Result | Meaning |
|--------|---------|
| ✅ **Safe** | Buy and sell both succeed at reasonable tax |
| ⚠️ **High Tax** | Sell tax > 10% — potentially exploitative |
| 🚨 **Honeypot** | Sell simulation fails — you can't sell |
| ❓ **Unknown** | Contract not yet in honeypot.is database |

---

## Understanding the Tax Display

The panel shows:
- **Buy Tax** — percentage deducted when buying
- **Sell Tax** — percentage deducted when selling

{% hint style="warning" %}
Taxes above 10% are a yellow flag. Some meme tokens run 10–25% but legitimate DeFi protocols should have 0–3%.
{% endhint %}

---

## Supported Chains

The honeypot check runs on all chains where honeypot.is has coverage, including Ethereum, Base, BSC, Polygon, Arbitrum, and more.

---

## Limitations

- Does **not** catch all scam patterns — only sell-restriction honeypots
- Token must be deployed (not just listed) for a result
- Very new tokens may return "Unknown" before indexing

{% hint style="info" %}
Honeypot detection runs automatically on all supported chains with no additional setup.
{% endhint %}
