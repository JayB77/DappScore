# Deployer History

Traces the wallet that deployed the project's smart contract and checks for a history of other deployments — a key signal for serial scammers.

***

## What It Checks

Using block explorer APIs (Etherscan-compatible), DappScore:

1. **Identifies the deployer wallet** — the address that created the contract
2. **Checks wallet age** — how long ago the wallet made its first transaction
3. **Lists other contract deployments** — how many other contracts this wallet has deployed

***

## What to Look For

| Signal                            | Meaning                                         |
| --------------------------------- | ----------------------------------------------- |
| Fresh wallet (0 history)          | New wallet — neutral, not inherently suspicious |
| 1–4 other contracts               | Normal — developer may have other projects      |
| 5+ other contracts                | Pattern deployer — worth researching each       |
| Multiple contracts + scam reports | 🚨 Serial rugger                                |

{% hint style="info" %}
**New wallets are not a red flag.** Many security-conscious developers use fresh wallets deliberately to protect their identity. Wallet age alone is never penalised — it's a data point, not a verdict.
{% endhint %}

***

## Linked Contracts

The panel lists up to 10 other contracts deployed from the same wallet, with:

* Contract address (linked to block explorer)
* Date deployed
* Quick access to research each one

***

## Supported Chains

Works on any EVM chain with an Etherscan-compatible block explorer API:

Ethereum, Base, BSC, Polygon, Arbitrum, Optimism, Avalanche, Fantom, Linea, Scroll, Blast, Gnosis, Cronos, and more.

***

## Limitations

* Non-EVM chains (Solana, TON, Tron) are not currently supported
* Chains without a public explorer API will show "data unavailable"
* Does not automatically flag contracts as scams — manual research is required

{% hint style="info" %}
Deployer history is fetched automatically across all supported chains using public block explorer data.
{% endhint %}
