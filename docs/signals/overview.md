# Overview

DappScore automatically runs a suite of on-chain and off-chain checks on every listed project and surfaces the results as **Security Signal panels** on each project's detail page.

These panels are designed to give you the facts — no opinions, no paid promotions — so you can make an informed decision before voting or investing.

***

## How It Works

When you open a project's detail page, DappScore fetches live data from public APIs and on-chain sources:

| Panel                   | Data Source               |
| ----------------------- | ------------------------- |
| 🍯 Honeypot Detector    | honeypot.is               |
| 💧 DEX Liquidity        | DexScreener               |
| 🔒 Liquidity Lock       | Team Finance / PinkLock   |
| 🕵️ Deployer History    | Block explorer APIs       |
| 📊 Token Distribution   | Ethplorer / Moralis       |
| 🏅 Audit Badges         | 20-firm registry          |
| 👥 Social Proof         | Discord / Telegram        |
| 🐋 Whale Tracker        | Alchemy                   |
| 🔍 Contract Fingerprint | Etherscan-compatible APIs |

***

## Why These Signals?

Each signal targets a specific scam or quality indicator:

| Signal               | What It Catches                             |
| -------------------- | ------------------------------------------- |
| Honeypot             | Tokens you can buy but can't sell           |
| DEX Liquidity        | No real trading market, fake volume         |
| Liquidity Lock       | Devs can drain the pool at any time         |
| Deployer History     | Serial ruggers reusing wallets              |
| Token Distribution   | Whale concentration, insider control        |
| Audit Badges         | Unaudited contracts                         |
| Social Proof         | Ghost projects with no real community       |
| Whale Tracker        | Coordinated dumps, insider movements        |
| Contract Fingerprint | Hidden dangers baked into the contract code |

***

## Feature Flags

Each signal panel can be toggled independently in the admin panel at `/admin`.

{% hint style="info" %}
All signals are **informational only** — they complement community voting, they don't replace it. A project can pass all signal checks and still be a scam, or fail some checks for legitimate reasons.
{% endhint %}

***

## Signal Pages

* [🍯 Honeypot Detector](honeypot.md)
* [💧 DEX Liquidity](dex-liquidity.md)
* [🔒 Liquidity Lock](liquidity-lock.md)
* [🕵️ Deployer History](deployer-history.md)
* [📊 Token Distribution](token-distribution.md)
* [🏅 Audit Badges](audit-badges.md)
* [👥 Social Proof](social-proof.md)
* [🐋 Whale Tracker](whale-tracker.md)
* [🔍 Contract Fingerprint](contract-fingerprint.md)
