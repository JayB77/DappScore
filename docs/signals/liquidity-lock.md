# 🔒 Liquidity Lock

Checks whether the project's liquidity pool tokens (LP tokens) are locked, and for how long.

---

## Why It Matters

When a project adds liquidity to a DEX, they receive LP tokens representing their share of the pool. If those LP tokens are **not locked**, the team can withdraw the entire liquidity at any moment — a classic "rug pull."

| Scenario | Risk |
|----------|------|
| LP unlocked | 🚨 Team can rug-pull at any time |
| LP locked < 30 days | ⚠️ Short lock — watch the unlock date |
| LP locked 6–12 months | ✅ Reasonable commitment |
| LP locked > 1 year | ✅ Strong signal of long-term intent |
| LP burned | ✅ Permanently locked, maximum trust |

---

## Data Sources

DappScore checks the two most popular LP lock platforms:

| Platform | Chain Coverage |
|----------|---------------|
| **Team Finance** | Ethereum, BSC, Polygon, Arbitrum, Base |
| **PinkLock** | Ethereum, BSC, Polygon, Arbitrum, and more |

---

## What the Panel Shows

| Field | Description |
|-------|-------------|
| 🔒 **Status** | Locked / Unlocked / Burned |
| ⏰ **Unlock Date** | When the lock expires |
| ⏳ **Time Remaining** | Days until unlock |
| 💲 **Value Locked** | USD value of locked LP |
| 🏦 **Locker** | Team Finance, PinkLock, etc. |
| 🔗 **Verification** | Link to locker contract |

---

## Limitations

- Only detects locks on **supported locker platforms** — custom lock contracts are not detected
- LP may be locked on a platform not yet integrated — always check the project's official docs

{% hint style="warning" %}
A lock can expire! Always check the **unlock date** — a lock expiring in 3 days is not meaningful protection.
{% endhint %}
