export interface ChainInfo {
  /** Matches the string stored in project.chain */
  name: string;
  /** Short label for filter UI (Arb, Sol, OP, …) */
  abbr: string;
  /** Brand hex color for the colored dot / badge */
  color: string;
  /** Whether this chain is EVM-compatible */
  isEVM: boolean;
  /** Native currency ticker */
  nativeCurrency: string;
  /** EVM chain ID (undefined for non-EVM chains) */
  chainId?: number;
}

export const SUPPORTED_CHAINS: ChainInfo[] = [
  // ── Established L1s ──────────────────────────────────────────────────────
  { name: 'Ethereum',        abbr: 'ETH',     color: '#627EEA', isEVM: true,  nativeCurrency: 'ETH',   chainId: 1          },
  { name: 'BNB Chain',       abbr: 'BNB',     color: '#F0B90B', isEVM: true,  nativeCurrency: 'BNB',   chainId: 56         },
  { name: 'Avalanche',       abbr: 'AVAX',    color: '#E84142', isEVM: true,  nativeCurrency: 'AVAX',  chainId: 43114      },
  { name: 'Fantom',          abbr: 'FTM',     color: '#1969FF', isEVM: true,  nativeCurrency: 'FTM',   chainId: 250        },
  { name: 'Sonic',           abbr: 'SONIC',   color: '#FFF400', isEVM: true,  nativeCurrency: 'S',     chainId: 146        },
  { name: 'Celo',            abbr: 'CELO',    color: '#35D07F', isEVM: true,  nativeCurrency: 'CELO',  chainId: 42220      },
  { name: 'Gnosis',          abbr: 'GNO',     color: '#04795B', isEVM: true,  nativeCurrency: 'xDAI',  chainId: 100        },
  { name: 'Cronos',          abbr: 'CRO',     color: '#002D74', isEVM: true,  nativeCurrency: 'CRO',   chainId: 25         },
  { name: 'Kaia',            abbr: 'KAIA',    color: '#FF6B00', isEVM: true,  nativeCurrency: 'KAIA',  chainId: 8217       },
  { name: 'Moonbeam',        abbr: 'GLMR',    color: '#E1147B', isEVM: true,  nativeCurrency: 'GLMR',  chainId: 1284       },
  { name: 'Moonriver',       abbr: 'MOVR',    color: '#F2A007', isEVM: true,  nativeCurrency: 'MOVR',  chainId: 1285       },
  { name: 'Kava',            abbr: 'KAVA',    color: '#FF564F', isEVM: true,  nativeCurrency: 'KAVA',  chainId: 2222       },
  { name: 'Aurora',          abbr: 'AURORA',  color: '#78D64B', isEVM: true,  nativeCurrency: 'ETH',   chainId: 1313161554 },
  { name: 'Core',            abbr: 'CORE',    color: '#FF7A00', isEVM: true,  nativeCurrency: 'CORE',  chainId: 1116       },
  { name: 'Ronin',           abbr: 'RON',     color: '#1273EA', isEVM: true,  nativeCurrency: 'RON',   chainId: 2020       },
  { name: 'ZetaChain',       abbr: 'ZETA',    color: '#00BC8C', isEVM: true,  nativeCurrency: 'ZETA',  chainId: 7000       },
  { name: 'SEI',             abbr: 'SEI',     color: '#9D1DF5', isEVM: true,  nativeCurrency: 'SEI',   chainId: 1329       },
  { name: 'Rootstock',       abbr: 'RSK',     color: '#FF9931', isEVM: true,  nativeCurrency: 'RBTC',  chainId: 30         },
  { name: 'Neon EVM',        abbr: 'NEON',    color: '#7B4FCF', isEVM: true,  nativeCurrency: 'NEON',  chainId: 245022934  },

  // ── Ethereum L2s ─────────────────────────────────────────────────────────
  { name: 'Arbitrum',        abbr: 'Arb',     color: '#28A0F0', isEVM: true,  nativeCurrency: 'ETH',   chainId: 42161      },
  { name: 'Optimism',        abbr: 'OP',      color: '#FF0420', isEVM: true,  nativeCurrency: 'ETH',   chainId: 10         },
  { name: 'Base',            abbr: 'Base',    color: '#0052FF', isEVM: true,  nativeCurrency: 'ETH',   chainId: 8453       },
  { name: 'Blast',           abbr: 'Blast',   color: '#FCFC03', isEVM: true,  nativeCurrency: 'ETH',   chainId: 81457      },
  { name: 'Polygon',         abbr: 'Pol',     color: '#8247E5', isEVM: true,  nativeCurrency: 'MATIC', chainId: 137        },
  { name: 'zkSync Era',      abbr: 'zkSync',  color: '#4E529A', isEVM: true,  nativeCurrency: 'ETH',   chainId: 324        },
  { name: 'Linea',           abbr: 'Linea',   color: '#61DFFF', isEVM: true,  nativeCurrency: 'ETH',   chainId: 59144      },
  { name: 'Scroll',          abbr: 'Scroll',  color: '#EFB88B', isEVM: true,  nativeCurrency: 'ETH',   chainId: 534352     },
  { name: 'Polygon zkEVM',   abbr: 'zkEVM',   color: '#7B3FE4', isEVM: true,  nativeCurrency: 'ETH',   chainId: 1101       },
  { name: 'Zora',            abbr: 'Zora',    color: '#2B5DF0', isEVM: true,  nativeCurrency: 'ETH',   chainId: 7777777    },
  { name: 'Unichain',        abbr: 'UNI',     color: '#FF007A', isEVM: true,  nativeCurrency: 'ETH',   chainId: 1301       },
  { name: 'Mantle',          abbr: 'MNT',     color: '#6FC8FF', isEVM: true,  nativeCurrency: 'MNT',   chainId: 5000       },
  { name: 'opBNB',           abbr: 'opBNB',   color: '#F0B90B', isEVM: true,  nativeCurrency: 'BNB',   chainId: 204        },
  { name: 'Mode',            abbr: 'Mode',    color: '#DFFE00', isEVM: true,  nativeCurrency: 'ETH',   chainId: 34443      },
  { name: 'Taiko',           abbr: 'Taiko',   color: '#E81899', isEVM: true,  nativeCurrency: 'ETH',   chainId: 167000     },
  { name: 'Fraxtal',         abbr: 'FRAX',    color: '#000000', isEVM: true,  nativeCurrency: 'frxETH', chainId: 252       },
  { name: 'Manta Pacific',   abbr: 'Manta',   color: '#2774F0', isEVM: true,  nativeCurrency: 'ETH',   chainId: 169        },
  { name: 'Metis',           abbr: 'Metis',   color: '#00DACC', isEVM: true,  nativeCurrency: 'METIS', chainId: 1088       },
  { name: 'Bob',             abbr: 'BOB',     color: '#F05A28', isEVM: true,  nativeCurrency: 'ETH',   chainId: 60808      },
  { name: 'World Chain',     abbr: 'WLD',     color: '#000000', isEVM: true,  nativeCurrency: 'ETH',   chainId: 480        },
  { name: 'Soneium',         abbr: 'SONE',    color: '#0C0C0C', isEVM: true,  nativeCurrency: 'ETH',   chainId: 1868       },
  { name: 'Immutable zkEVM', abbr: 'IMX',     color: '#00BBFF', isEVM: true,  nativeCurrency: 'IMX',   chainId: 13371      },

  // ── Newer / emerging EVM chains ──────────────────────────────────────────
  { name: 'Berachain',       abbr: 'Bera',    color: '#FF9A44', isEVM: true,  nativeCurrency: 'BERA',  chainId: 80094      },
  { name: 'Monad',           abbr: 'MON',     color: '#6B2BF7', isEVM: true,  nativeCurrency: 'MON',   chainId: 41454      },
  { name: 'HyperEVM',        abbr: 'HYPE',    color: '#00F5A0', isEVM: true,  nativeCurrency: 'HYPE',  chainId: 998        },

  // ── Bitcoin L2s ───────────────────────────────────────────────────────────
  { name: 'Merlin',          abbr: 'MERL',    color: '#0A85FF', isEVM: true,  nativeCurrency: 'BTC',   chainId: 4200       },

  // ── Non-EVM ──────────────────────────────────────────────────────────────
  { name: 'Solana',          abbr: 'Sol',     color: '#9945FF', isEVM: false, nativeCurrency: 'SOL'                        },
  { name: 'Starknet',        abbr: 'Stark',   color: '#EC796B', isEVM: false, nativeCurrency: 'ETH'                        },
  { name: 'Sui',             abbr: 'Sui',     color: '#6FBCF0', isEVM: false, nativeCurrency: 'SUI'                        },
  { name: 'Tron',            abbr: 'TRX',     color: '#FF060A', isEVM: false, nativeCurrency: 'TRX'                        },
  { name: 'TON',             abbr: 'TON',     color: '#0088CC', isEVM: false, nativeCurrency: 'TON'                        },
  { name: 'NEAR',            abbr: 'NEAR',    color: '#00C08B', isEVM: false, nativeCurrency: 'NEAR'                       },
  { name: 'Aptos',           abbr: 'APT',     color: '#2CD4AF', isEVM: false, nativeCurrency: 'APT'                        },
  { name: 'Cardano',         abbr: 'ADA',     color: '#0033AD', isEVM: false, nativeCurrency: 'ADA'                        },

  { name: 'Other',           abbr: 'Other',   color: '#6B7280', isEVM: false, nativeCurrency: ''                           },
];

/** Lookup by full name (matches project.chain field) */
export const CHAIN_BY_NAME = new Map<string, ChainInfo>(
  SUPPORTED_CHAINS.map((c) => [c.name, c])
);

/** Just the chain names, for use in form <select> options */
export const CHAIN_NAMES = SUPPORTED_CHAINS.map((c) => c.name);
