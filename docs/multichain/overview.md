# ⛓️ Supported Chains

DappScore supports **50+ blockchains** for project listings and security signal analysis. Projects can list contract addresses on any supported chain and the platform will automatically run the appropriate checks.

---

## EVM Chains

Full security signal coverage (honeypot, deployer history, contract fingerprint, DEX liquidity, whale tracking):

### Tier 1 — Full Coverage

| Chain | Explorer | Alchemy |
|-------|----------|---------|
| Ethereum | Etherscan | ✅ |
| Base | BaseScan | ✅ |
| Polygon | PolygonScan | ✅ |
| BSC (BNB) | BscScan | ✅ |
| Arbitrum One | Arbiscan | ✅ |
| Optimism | OP Etherscan | ✅ |
| Avalanche C-Chain | Snowtrace | ✅ |
| Linea | LineaScan | ✅ |

### Tier 2 — Explorer + Partial

| Chain | Explorer | Notes |
|-------|----------|-------|
| Blast | BlastScan | ✅ |
| Scroll | ScrollScan | ✅ |
| Gnosis | GnosisScan | ✅ |
| Fantom | FtmScan | ✅ |
| Mantle | MantleScan | ✅ |
| Mode | ModeScan | ✅ |
| Taiko | TaikoScan | ✅ |
| Sonic | SonicScan | ✅ |
| Cronos | CronosScan | ✅ |
| zkSync Era | zkSyncScan | ✅ |
| Zora | ZoraScan | ✅ |
| Celo | CeloScan | ✅ |
| Aurora | AuroraScan | Explorer only |
| Moonbeam | MoonScan | Explorer only |
| Moonriver | MoonScan | Explorer only |
| Telos | TelosScan | Explorer only |
| Metis | MetisScan | Explorer only |
| Kava | KavaScan | Explorer only |
| Filecoin EVM | FilFox | Explorer only |
| Polygon zkEVM | zkEVM Scan | Explorer only |

---

## Non-EVM Chains

Listed projects can include non-EVM contract addresses. Token distribution and holder data is supported where APIs are available:

| Chain | Holder Data | Scam Detection |
|-------|-------------|----------------|
| Solana | ✅ Moralis + Solscan | GoPlus Security |
| Tron | ✅ TronGrid | GoPlus Security |
| TON | ✅ TON Center | — |
| NEAR | ✅ NearBlocks + FastNEAR | — |
| Starknet | — | Starkscan address validation |

---

## Scam Detection — GoPlus Security

For EVM chains, DappScore integrates **GoPlus Security API** for additional risk signals:

| GoPlus Check | Description |
|--------------|-------------|
| Is honeypot | Can the token be sold? |
| Buy/sell tax | Tax percentages |
| Is mintable | Can new tokens be minted? |
| Is proxy | Is the contract upgradeable? |
| Is blacklisted | Can users be blacklisted? |
| Slippage modifiable | Can the owner change tax at any time? |
| Anti-whale | Is there a max transaction limit? |
| Trading cooldown | Is there a mandatory wait between trades? |
| Owner can take all fees | Can the owner drain the contract? |

GoPlus covers Ethereum, Base, BSC, Polygon, Arbitrum, Optimism, and all major EVM chains.

---

## Adding a Contract Address

When submitting or editing a project, you can add contract addresses for **multiple chains simultaneously**. Each address is independently analysed and displayed on the project detail page.

See [Submitting Projects](../platform/submitting-projects.md) for full instructions.

---

## Chain Not Listed?

If your project is on a chain not yet supported, you can still list it on DappScore. The contract address will be displayed but automated signals won't be available for that chain. We regularly add new chains — check back or reach out through official channels.
