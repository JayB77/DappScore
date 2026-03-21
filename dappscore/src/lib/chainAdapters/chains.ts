import type { ChainConfig } from './types';

/**
 * Master chain registry — single source of truth for all chain API identifiers.
 *
 * Keys are lowercase chain name / ticker aliases.  Panels call
 * `getChainConfig(chain)` where `chain` is the canonical project chain name
 * (e.g. "BNB Chain", "Ethereum") and this function lowercases the input.
 *
 * Fields:
 *   apiBase        — Etherscan-compatible block-explorer API root
 *   explorerBase   — human-facing explorer URL root
 *   family         — chain family: 'evm' | 'solana' | 'tron' | 'ton'
 *   goplusId       — GoPlus Security numeric chain ID (EVM only)
 *   dexscreenerId  — DexScreener chain slug
 *   honeypotId     — Honeypot.is numeric chain ID (EVM chainId)
 *
 * To add a new chain: add a canonical entry (lowercase name) here.
 * Aliases (tickers, alternate names) can share the same config object literal.
 */
export const CHAINS: Record<string, ChainConfig> = {

  // ── Ethereum ──────────────────────────────────────────────────────────────
  ethereum:           { apiBase: 'https://api.etherscan.io/api',                  explorerBase: 'https://etherscan.io',               family: 'evm', goplusId: 1,          dexscreenerId: 'ethereum',      honeypotId: 1          },
  eth:                { apiBase: 'https://api.etherscan.io/api',                  explorerBase: 'https://etherscan.io',               family: 'evm', goplusId: 1,          dexscreenerId: 'ethereum',      honeypotId: 1          },

  // ── BNB Chain ─────────────────────────────────────────────────────────────
  'bnb chain':        { apiBase: 'https://api.bscscan.com/api',                   explorerBase: 'https://bscscan.com',                family: 'evm', goplusId: 56,         dexscreenerId: 'bsc',           honeypotId: 56         },
  bsc:                { apiBase: 'https://api.bscscan.com/api',                   explorerBase: 'https://bscscan.com',                family: 'evm', goplusId: 56,         dexscreenerId: 'bsc',           honeypotId: 56         },
  'bnb smart chain':  { apiBase: 'https://api.bscscan.com/api',                   explorerBase: 'https://bscscan.com',                family: 'evm', goplusId: 56,         dexscreenerId: 'bsc',           honeypotId: 56         },
  bnb:                { apiBase: 'https://api.bscscan.com/api',                   explorerBase: 'https://bscscan.com',                family: 'evm', goplusId: 56,         dexscreenerId: 'bsc',           honeypotId: 56         },

  // ── opBNB ─────────────────────────────────────────────────────────────────
  opbnb:              { apiBase: 'https://api-opbnb.bscscan.com/api',             explorerBase: 'https://opbnb.bscscan.com',          family: 'evm', goplusId: 204,        dexscreenerId: 'opbnb',         honeypotId: 204        },

  // ── Polygon ───────────────────────────────────────────────────────────────
  polygon:            { apiBase: 'https://api.polygonscan.com/api',               explorerBase: 'https://polygonscan.com',            family: 'evm', goplusId: 137,        dexscreenerId: 'polygon',       honeypotId: 137        },
  matic:              { apiBase: 'https://api.polygonscan.com/api',               explorerBase: 'https://polygonscan.com',            family: 'evm', goplusId: 137,        dexscreenerId: 'polygon',       honeypotId: 137        },

  // ── Polygon zkEVM ─────────────────────────────────────────────────────────
  'polygon zkevm':    { apiBase: 'https://api-zkevm.polygonscan.com/api',         explorerBase: 'https://zkevm.polygonscan.com',      family: 'evm', goplusId: 1101,       dexscreenerId: 'polygonzkevm',  honeypotId: 1101       },

  // ── Arbitrum ──────────────────────────────────────────────────────────────
  arbitrum:           { apiBase: 'https://api.arbiscan.io/api',                   explorerBase: 'https://arbiscan.io',                family: 'evm', goplusId: 42161,      dexscreenerId: 'arbitrum',      honeypotId: 42161      },
  'arbitrum one':     { apiBase: 'https://api.arbiscan.io/api',                   explorerBase: 'https://arbiscan.io',                family: 'evm', goplusId: 42161,      dexscreenerId: 'arbitrum',      honeypotId: 42161      },
  'arbitrum nova':    { apiBase: 'https://api-nova.arbiscan.io/api',              explorerBase: 'https://nova.arbiscan.io',           family: 'evm', goplusId: 42170,      dexscreenerId: 'arbitrumnova'                          },

  // ── Optimism ──────────────────────────────────────────────────────────────
  optimism:           { apiBase: 'https://api-optimistic.etherscan.io/api',       explorerBase: 'https://optimistic.etherscan.io',    family: 'evm', goplusId: 10,         dexscreenerId: 'optimism',      honeypotId: 10         },
  'op mainnet':       { apiBase: 'https://api-optimistic.etherscan.io/api',       explorerBase: 'https://optimistic.etherscan.io',    family: 'evm', goplusId: 10,         dexscreenerId: 'optimism',      honeypotId: 10         },

  // ── Base ──────────────────────────────────────────────────────────────────
  base:               { apiBase: 'https://api.basescan.org/api',                  explorerBase: 'https://basescan.org',               family: 'evm', goplusId: 8453,       dexscreenerId: 'base',          honeypotId: 8453       },

  // ── Blast ─────────────────────────────────────────────────────────────────
  blast:              { apiBase: 'https://api.blastscan.io/api',                  explorerBase: 'https://blastscan.io',               family: 'evm', goplusId: 81457,      dexscreenerId: 'blast',         honeypotId: 81457      },

  // ── Linea ─────────────────────────────────────────────────────────────────
  linea:              { apiBase: 'https://api.lineascan.build/api',               explorerBase: 'https://lineascan.build',            family: 'evm', goplusId: 59144,      dexscreenerId: 'linea',         honeypotId: 59144      },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll:             { apiBase: 'https://api.scrollscan.com/api',                explorerBase: 'https://scrollscan.com',             family: 'evm', goplusId: 534352,     dexscreenerId: 'scroll',        honeypotId: 534352     },

  // ── zkSync Era ────────────────────────────────────────────────────────────
  'zksync era':       { apiBase: 'https://api-era.zksync.network/api',            explorerBase: 'https://era.zksync.network',         family: 'evm', goplusId: 324,        dexscreenerId: 'zksync',        honeypotId: 324        },
  zksync:             { apiBase: 'https://api-era.zksync.network/api',            explorerBase: 'https://era.zksync.network',         family: 'evm', goplusId: 324,        dexscreenerId: 'zksync',        honeypotId: 324        },

  // ── Mantle ────────────────────────────────────────────────────────────────
  mantle:             { apiBase: 'https://api.mantlescan.xyz/api',                explorerBase: 'https://mantlescan.xyz',             family: 'evm', goplusId: 5000,       dexscreenerId: 'mantle',        honeypotId: 5000       },

  // ── Mode ──────────────────────────────────────────────────────────────────
  mode:               { apiBase: 'https://api.modescan.io/api',                   explorerBase: 'https://modescan.io',                family: 'evm', goplusId: 34443,      dexscreenerId: 'mode',          honeypotId: 34443      },

  // ── Taiko ─────────────────────────────────────────────────────────────────
  taiko:              { apiBase: 'https://api.taikoscan.io/api',                  explorerBase: 'https://taikoscan.io',               family: 'evm', goplusId: 167000,     dexscreenerId: 'taiko',         honeypotId: 167000     },

  // ── Fraxtal ───────────────────────────────────────────────────────────────
  fraxtal:            { apiBase: 'https://api.fraxscan.com/api',                  explorerBase: 'https://fraxscan.com',               family: 'evm', goplusId: 252,        dexscreenerId: 'fraxtal',       honeypotId: 252        },

  // ── Manta Pacific ─────────────────────────────────────────────────────────
  'manta pacific':    { apiBase: 'https://pacific-explorer.manta.network/api',    explorerBase: 'https://pacific-explorer.manta.network', family: 'evm', goplusId: 169,   dexscreenerId: 'manta',         honeypotId: 169        },
  manta:              { apiBase: 'https://pacific-explorer.manta.network/api',    explorerBase: 'https://pacific-explorer.manta.network', family: 'evm', goplusId: 169,   dexscreenerId: 'manta',         honeypotId: 169        },

  // ── Metis ─────────────────────────────────────────────────────────────────
  metis:              { apiBase: 'https://andromeda-explorer.metis.io/api',       explorerBase: 'https://andromeda-explorer.metis.io',    family: 'evm', goplusId: 1088,  dexscreenerId: 'metis'                                 },

  // ── Unichain ──────────────────────────────────────────────────────────────
  unichain:           { apiBase: 'https://api.uniscan.xyz/api',                   explorerBase: 'https://uniscan.xyz',                family: 'evm', goplusId: 1301,       dexscreenerId: 'unichain'                              },

  // ── Zora ──────────────────────────────────────────────────────────────────
  zora:               { apiBase: 'https://explorer.zora.energy/api/v2',           explorerBase: 'https://explorer.zora.energy',       family: 'evm', goplusId: 7777777,    dexscreenerId: 'zora'                                  },

  // ── Bob ───────────────────────────────────────────────────────────────────
  bob:                { apiBase: 'https://explorer.gobob.xyz/api/v2',             explorerBase: 'https://explorer.gobob.xyz',         family: 'evm', goplusId: 60808,      dexscreenerId: 'bob'                                   },
  'build on bitcoin': { apiBase: 'https://explorer.gobob.xyz/api/v2',             explorerBase: 'https://explorer.gobob.xyz',         family: 'evm', goplusId: 60808,      dexscreenerId: 'bob'                                   },

  // ── World Chain ───────────────────────────────────────────────────────────
  'world chain':      { apiBase: 'https://worldchain-mainnet.explorer.alchemy.com/api/v2', explorerBase: 'https://worldscan.org',       family: 'evm', goplusId: 480,       dexscreenerId: 'worldchain'                            },
  worldchain:         { apiBase: 'https://worldchain-mainnet.explorer.alchemy.com/api/v2', explorerBase: 'https://worldscan.org',       family: 'evm', goplusId: 480,       dexscreenerId: 'worldchain'                            },

  // ── Soneium ───────────────────────────────────────────────────────────────
  soneium:            { apiBase: 'https://soneium.blockscout.com/api/v2',         explorerBase: 'https://soneium.blockscout.com',     family: 'evm', goplusId: 1868,       dexscreenerId: 'soneium'                               },

  // ── Immutable zkEVM ───────────────────────────────────────────────────────
  'immutable zkevm':  { apiBase: 'https://explorer.immutable.com/api/v2',         explorerBase: 'https://explorer.immutable.com',     family: 'evm', goplusId: 13371,      dexscreenerId: 'immutablezkevm'                        },
  immutable:          { apiBase: 'https://explorer.immutable.com/api/v2',         explorerBase: 'https://explorer.immutable.com',     family: 'evm', goplusId: 13371,      dexscreenerId: 'immutablezkevm'                        },

  // ── Avalanche ─────────────────────────────────────────────────────────────
  avalanche:          { apiBase: 'https://api.snowtrace.io/api',                  explorerBase: 'https://snowtrace.io',               family: 'evm', goplusId: 43114,      dexscreenerId: 'avalanche',     honeypotId: 43114      },
  avax:               { apiBase: 'https://api.snowtrace.io/api',                  explorerBase: 'https://snowtrace.io',               family: 'evm', goplusId: 43114,      dexscreenerId: 'avalanche',     honeypotId: 43114      },

  // ── Fantom ────────────────────────────────────────────────────────────────
  fantom:             { apiBase: 'https://api.ftmscan.com/api',                   explorerBase: 'https://ftmscan.com',                family: 'evm', goplusId: 250,        dexscreenerId: 'fantom',        honeypotId: 250        },
  ftm:                { apiBase: 'https://api.ftmscan.com/api',                   explorerBase: 'https://ftmscan.com',                family: 'evm', goplusId: 250,        dexscreenerId: 'fantom',        honeypotId: 250        },

  // ── Sonic ─────────────────────────────────────────────────────────────────
  sonic:              { apiBase: 'https://api.sonicscan.org/api',                 explorerBase: 'https://sonicscan.org',              family: 'evm', goplusId: 146,        dexscreenerId: 'sonic',         honeypotId: 146        },

  // ── Celo ──────────────────────────────────────────────────────────────────
  celo:               { apiBase: 'https://api.celoscan.io/api',                   explorerBase: 'https://celoscan.io',                family: 'evm', goplusId: 42220,      dexscreenerId: 'celo',          honeypotId: 42220      },

  // ── Gnosis ────────────────────────────────────────────────────────────────
  gnosis:             { apiBase: 'https://api.gnosisscan.io/api',                 explorerBase: 'https://gnosisscan.io',              family: 'evm', goplusId: 100,        dexscreenerId: 'gnosis',        honeypotId: 100        },
  xdai:               { apiBase: 'https://api.gnosisscan.io/api',                 explorerBase: 'https://gnosisscan.io',              family: 'evm', goplusId: 100,        dexscreenerId: 'gnosis',        honeypotId: 100        },

  // ── Cronos ────────────────────────────────────────────────────────────────
  cronos:             { apiBase: 'https://api.cronoscan.com/api',                 explorerBase: 'https://cronoscan.com',              family: 'evm', goplusId: 25,         dexscreenerId: 'cronos',        honeypotId: 25         },
  cro:                { apiBase: 'https://api.cronoscan.com/api',                 explorerBase: 'https://cronoscan.com',              family: 'evm', goplusId: 25,         dexscreenerId: 'cronos',        honeypotId: 25         },

  // ── Kaia (formerly Klaytn) ────────────────────────────────────────────────
  kaia:               { apiBase: 'https://api-cypress.klaytnscope.com/api',       explorerBase: 'https://kaiascan.io',                family: 'evm', goplusId: 8217,       dexscreenerId: 'kaia',          honeypotId: 8217       },
  klaytn:             { apiBase: 'https://api-cypress.klaytnscope.com/api',       explorerBase: 'https://kaiascan.io',                family: 'evm', goplusId: 8217,       dexscreenerId: 'kaia',          honeypotId: 8217       },

  // ── Moonbeam ──────────────────────────────────────────────────────────────
  moonbeam:           { apiBase: 'https://api.moonscan.io/api',                   explorerBase: 'https://moonscan.io',                family: 'evm', goplusId: 1284,       dexscreenerId: 'moonbeam',      honeypotId: 1284       },
  glmr:               { apiBase: 'https://api.moonscan.io/api',                   explorerBase: 'https://moonscan.io',                family: 'evm', goplusId: 1284,       dexscreenerId: 'moonbeam',      honeypotId: 1284       },

  // ── Moonriver ─────────────────────────────────────────────────────────────
  moonriver:          { apiBase: 'https://api-moonriver.moonscan.io/api',         explorerBase: 'https://moonriver.moonscan.io',      family: 'evm', goplusId: 1285,       dexscreenerId: 'moonriver',     honeypotId: 1285       },
  movr:               { apiBase: 'https://api-moonriver.moonscan.io/api',         explorerBase: 'https://moonriver.moonscan.io',      family: 'evm', goplusId: 1285,       dexscreenerId: 'moonriver',     honeypotId: 1285       },

  // ── Kava ──────────────────────────────────────────────────────────────────
  kava:               { apiBase: 'https://kavascan.com/api',                      explorerBase: 'https://kavascan.com',               family: 'evm', goplusId: 2222,       dexscreenerId: 'kava',          honeypotId: 2222       },

  // ── Aurora ────────────────────────────────────────────────────────────────
  aurora:             { apiBase: 'https://explorer.aurora.dev/api',               explorerBase: 'https://explorer.aurora.dev',        family: 'evm', goplusId: 1313161554, dexscreenerId: 'aurora',        honeypotId: 1313161554 },
  'aurora evm':       { apiBase: 'https://explorer.aurora.dev/api',               explorerBase: 'https://explorer.aurora.dev',        family: 'evm', goplusId: 1313161554, dexscreenerId: 'aurora',        honeypotId: 1313161554 },

  // ── Core ──────────────────────────────────────────────────────────────────
  core:               { apiBase: 'https://openapi.coredao.org/api',               explorerBase: 'https://scan.coredao.org',           family: 'evm', goplusId: 1116,       dexscreenerId: 'core',          honeypotId: 1116       },
  'core dao':         { apiBase: 'https://openapi.coredao.org/api',               explorerBase: 'https://scan.coredao.org',           family: 'evm', goplusId: 1116,       dexscreenerId: 'core',          honeypotId: 1116       },

  // ── Ronin ─────────────────────────────────────────────────────────────────
  ronin:              { apiBase: 'https://app.roninchain.com/api',                explorerBase: 'https://app.roninchain.com',         family: 'evm', goplusId: 2020,       dexscreenerId: 'ronin'                                 },

  // ── SEI ───────────────────────────────────────────────────────────────────
  sei:                { apiBase: 'https://seitrace.com/api',                      explorerBase: 'https://seitrace.com',               family: 'evm', goplusId: 1329,       dexscreenerId: 'sei'                                   },
  'sei evm':          { apiBase: 'https://seitrace.com/api',                      explorerBase: 'https://seitrace.com',               family: 'evm', goplusId: 1329,       dexscreenerId: 'sei'                                   },

  // ── ZetaChain ─────────────────────────────────────────────────────────────
  zetachain:          { apiBase: 'https://zetachain.blockscout.com/api/v2',       explorerBase: 'https://zetachain.blockscout.com',   family: 'evm', goplusId: 7000,       dexscreenerId: 'zetachain'                             },

  // ── Rootstock ─────────────────────────────────────────────────────────────
  rootstock:          { apiBase: 'https://rootstock.blockscout.com/api/v2',       explorerBase: 'https://rootstock.blockscout.com',   family: 'evm', goplusId: 30,         dexscreenerId: 'rootstock'                             },
  rsk:                { apiBase: 'https://rootstock.blockscout.com/api/v2',       explorerBase: 'https://rootstock.blockscout.com',   family: 'evm', goplusId: 30,         dexscreenerId: 'rootstock'                             },

  // ── Berachain ─────────────────────────────────────────────────────────────
  berachain:          {                                                            explorerBase: 'https://berascan.com',               family: 'evm', goplusId: 80094,      dexscreenerId: 'berachain',     honeypotId: 80094      },
  bera:               {                                                            explorerBase: 'https://berascan.com',               family: 'evm', goplusId: 80094,      dexscreenerId: 'berachain',     honeypotId: 80094      },

  // ── Monad ─────────────────────────────────────────────────────────────────
  monad:              {                                                            explorerBase: 'https://explorer.monad.xyz',         family: 'evm', goplusId: 41454,      dexscreenerId: 'monad'                                 },

  // ── HyperEVM ──────────────────────────────────────────────────────────────
  hyperevm:           {                                                            explorerBase: 'https://explorer.hyperliquid.xyz',   family: 'evm', goplusId: 998,        dexscreenerId: 'hyperevm'                              },

  // ── Merlin ────────────────────────────────────────────────────────────────
  merlin:             { apiBase: 'https://scan.merlinchain.io/api',               explorerBase: 'https://scan.merlinchain.io',        family: 'evm', goplusId: 4200,       dexscreenerId: 'merlin'                                },
  'merlin chain':     { apiBase: 'https://scan.merlinchain.io/api',               explorerBase: 'https://scan.merlinchain.io',        family: 'evm', goplusId: 4200,       dexscreenerId: 'merlin'                                },

  // ── Neon EVM ──────────────────────────────────────────────────────────────
  'neon evm':         { apiBase: 'https://neonscan.org/api',                      explorerBase: 'https://neonscan.org',               family: 'evm'                                                                                  },
  neon:               { apiBase: 'https://neonscan.org/api',                      explorerBase: 'https://neonscan.org',               family: 'evm'                                                                                  },

  // ── Wemix ─────────────────────────────────────────────────────────────────
  wemix:              { apiBase: 'https://api.wemixscan.com/api',                 explorerBase: 'https://wemixscan.com',              family: 'evm'                                                                                  },

  // ── X Layer ───────────────────────────────────────────────────────────────
  'x layer':          { apiBase: 'https://www.xlayerscan.com/api',                explorerBase: 'https://www.xlayerscan.com',         family: 'evm'                                                                                  },
  xlayer:             { apiBase: 'https://www.xlayerscan.com/api',                explorerBase: 'https://www.xlayerscan.com',         family: 'evm'                                                                                  },

  // ── Boba ──────────────────────────────────────────────────────────────────
  boba:               { apiBase: 'https://api.bobascan.com/api',                  explorerBase: 'https://bobascan.com',               family: 'evm'                                                                                  },

  // ── Solana ────────────────────────────────────────────────────────────────
  solana:             {                                                            explorerBase: 'https://solscan.io',                 family: 'solana', dexscreenerId: 'solana'                                                    },
  sol:                {                                                            explorerBase: 'https://solscan.io',                 family: 'solana', dexscreenerId: 'solana'                                                    },

  // ── Tron ──────────────────────────────────────────────────────────────────
  tron:               {                                                            explorerBase: 'https://tronscan.org',               family: 'tron',   dexscreenerId: 'tron'                                                      },
  trx:                {                                                            explorerBase: 'https://tronscan.org',               family: 'tron',   dexscreenerId: 'tron'                                                      },

  // ── TON ───────────────────────────────────────────────────────────────────
  ton:                {                                                            explorerBase: 'https://tonscan.org',                family: 'ton',    dexscreenerId: 'ton'                                                       },

  // ── Starknet ──────────────────────────────────────────────────────────────
  starknet:           {                                                            explorerBase: 'https://voyager.online',             family: 'evm'                                                                                  },
  stark:              {                                                            explorerBase: 'https://voyager.online',             family: 'evm'                                                                                  },

  // ── SUI ───────────────────────────────────────────────────────────────────
  sui:                {                                                            explorerBase: 'https://suiscan.xyz',                family: 'sui',    dexscreenerId: 'sui'                                                       },

  // ── Non-EVM (explorer links only) ─────────────────────────────────────────
  near:               {                                                            explorerBase: 'https://nearblocks.io',              family: 'evm'                                                                                  },
  aptos:              {                                                            explorerBase: 'https://aptoscan.com',               family: 'evm'                                                                                  },
  cardano:            {                                                            explorerBase: 'https://cardanoscan.io',             family: 'evm'                                                                                  },
};

export function getChainConfig(chain: string): ChainConfig | null {
  return CHAINS[chain.toLowerCase()] ?? null;
}
