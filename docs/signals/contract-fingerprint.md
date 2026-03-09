# 🔍 Contract Fingerprint

The Contract Fingerprint signal inspects a project's smart contract code for patterns commonly found in scams, rugs, and exploits — surfacing potential dangers that aren't visible from a project's marketing or social presence.

---

## What It Checks

Rather than just looking at a contract's description, DappScore analyzes the actual on-chain bytecode and verified source code for known risk patterns:

| Pattern | Risk |
|---------|------|
| Hidden mint functions | Team can create unlimited tokens, diluting holders |
| Blacklist / whitelist controls | Team can freeze wallets and block selling |
| Fee manipulation | Buy/sell fees can be changed after launch |
| Ownership not renounced | Team retains full admin control of the contract |
| Proxy / upgradeable contract | Contract logic can be silently swapped out |
| Honeypot bytecode signature | Matches known patterns of unresellable tokens |
| Self-destruct capability | Contract can be wiped entirely |
| Pausable transfers | Team can halt all trading at will |

---

## How It Works

1. DappScore retrieves the contract address associated with the project
2. The contract is matched against a registry of known risk patterns and bytecode signatures
3. Any matches are surfaced as flagged items on the project's detail page
4. Each flag includes a plain-language explanation of the risk — no technical knowledge required

---

## What the Results Mean

### No Flags Detected

The contract does not match any known high-risk patterns. This is a good sign, but not a guarantee — novel scam techniques may not yet be in the registry.

### Flags Detected

One or more risk patterns were found. This doesn't automatically mean the project is a scam — some patterns (like upgradeable contracts) are used legitimately — but they warrant extra scrutiny.

{% hint style="warning" %}
**Flags are informational, not verdicts.** A flagged contract may be a legitimate project with a non-standard structure. Always combine Contract Fingerprint results with community votes, comments, and the other signal panels.
{% endhint %}

---

## Supported Chains

Contract Fingerprint analysis is available on all chains with publicly verified contract source code, including:

- Ethereum
- Base
- BSC
- Polygon
- Arbitrum
- Optimism
- Avalanche

Chains without public source verification will show "source not verified" rather than a fingerprint result.

---

## Limitations

- Unverified contracts cannot be fully analysed — source code must be publicly submitted to the block explorer
- Obfuscated or compiled-only contracts may produce partial results
- New scam patterns take time to be added to the registry — a clean result is not a guarantee of safety

{% hint style="info" %}
Contract Fingerprint is one layer of a multi-signal approach. Use it alongside Honeypot detection, Deployer History, and community consensus for the clearest picture.
{% endhint %}
