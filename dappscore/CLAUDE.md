# DappScore — Claude Code Notes

## Key Rule: Contract → ABI Sync
**Whenever a Solidity contract in `contracts/src/` is edited, the corresponding
ABI file in `subgraph/abis/` must be regenerated.**

To regenerate after editing contracts:
```bash
cd dappscore/contracts
forge build
# Then copy the relevant ABI from out/<ContractName>.sol/<ContractName>.json
# into subgraph/abis/<ContractName>.json (events + any view functions used by handlers)
```

Affected files:
| Contract | ABI file | Subgraph handler |
|---|---|---|
| `contracts/src/ScoreToken.sol` | `subgraph/abis/ScoreToken.json` | `subgraph/src/score-token.ts` |
| `contracts/src/ProjectRegistry.sol` | `subgraph/abis/ProjectRegistry.json` | `subgraph/src/project-registry.ts` |
| `contracts/src/VotingEngine.sol` | `subgraph/abis/VotingEngine.json` | `subgraph/src/voting-engine.ts` |
| `contracts/src/PredictionMarket.sol` | `subgraph/abis/PredictionMarket.json` | `subgraph/src/prediction-market.ts` |
| `contracts/src/BountySystem.sol` | `subgraph/abis/BountySystem.json` | `subgraph/src/bounty-system.ts` |
| `contracts/src/InsurancePool.sol` | `subgraph/abis/InsurancePool.json` | `subgraph/src/insurance-pool.ts` |
| `contracts/src/ReputationSystem.sol` | `subgraph/abis/ReputationSystem.json` | `subgraph/src/reputation-system.ts` |
| `contracts/src/AffiliateProgram.sol` | `subgraph/abis/AffiliateProgram.json` | `subgraph/src/affiliate-program.ts` |

Also check `subgraph/subgraph.yaml` — event signatures in `eventHandlers` must
exactly match what the updated contract emits (name + param types + indexed flags).

---

## Environment Variables

### Firebase Functions (`functions/`)
| Variable | Where it comes from |
|---|---|
| `SUBGRAPH_WEBHOOK_SECRET` | Self-generated — you set it in both Firebase and your webhook provider config (see below) |
| `ALCHEMY_SIGNING_KEY` | Alchemy dashboard → Webhooks → your webhook → "Signing Key" |

#### SUBGRAPH_WEBHOOK_SECRET
This is a secret **you create**. Generate a random string, then:
1. Set it in Firebase: `firebase functions:secrets:set SUBGRAPH_WEBHOOK_SECRET`
2. Set it in your Graph webhook provider (Notifi, Goldsky, etc.) as the value
   they should send in the `x-webhook-secret` header on every push.

---

## Branch convention
Feature branches follow: `claude/<feature-name>-<SESSION_ID>`
