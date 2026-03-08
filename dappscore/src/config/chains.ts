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
  { name: 'Ethereum',      abbr: 'ETH',    color: '#627EEA', isEVM: true,  nativeCurrency: 'ETH',  chainId: 1        },
  { name: 'BNB Chain',     abbr: 'BNB',    color: '#F0B90B', isEVM: true,  nativeCurrency: 'BNB',  chainId: 56       },
  { name: 'Avalanche',     abbr: 'AVAX',   color: '#E84142', isEVM: true,  nativeCurrency: 'AVAX', chainId: 43114    },
  { name: 'Fantom',        abbr: 'FTM',    color: '#1969FF', isEVM: true,  nativeCurrency: 'FTM',  chainId: 250      },
  { name: 'Celo',          abbr: 'CELO',   color: '#35D07F', isEVM: true,  nativeCurrency: 'CELO', chainId: 42220    },
  { name: 'Ronin',         abbr: 'RON',    color: '#1273EA', isEVM: true,  nativeCurrency: 'RON',  chainId: 2020     },
  { name: 'ZetaChain',     abbr: 'ZETA',   color: '#00BC8C', isEVM: true,  nativeCurrency: 'ZETA', chainId: 7000     },
  { name: 'SEI',           abbr: 'SEI',    color: '#9D1DF5', isEVM: true,  nativeCurrency: 'SEI',  chainId: 1329     },

  // ── Ethereum L2s ─────────────────────────────────────────────────────────
  { name: 'Arbitrum',      abbr: 'Arb',    color: '#28A0F0', isEVM: true,  nativeCurrency: 'ETH',  chainId: 42161    },
  { name: 'Optimism',      abbr: 'OP',     color: '#FF0420', isEVM: true,  nativeCurrency: 'ETH',  chainId: 10       },
  { name: 'Base',          abbr: 'Base',   color: '#0052FF', isEVM: true,  nativeCurrency: 'ETH',  chainId: 8453     },
  { name: 'Polygon',       abbr: 'Pol',    color: '#8247E5', isEVM: true,  nativeCurrency: 'MATIC', chainId: 137     },
  { name: 'zkSync Era',    abbr: 'zkSync', color: '#4E529A', isEVM: true,  nativeCurrency: 'ETH',  chainId: 324      },
  { name: 'Linea',         abbr: 'Linea',  color: '#61DFFF', isEVM: true,  nativeCurrency: 'ETH',  chainId: 59144    },
  { name: 'Scroll',        abbr: 'Scroll', color: '#EFB88B', isEVM: true,  nativeCurrency: 'ETH',  chainId: 534352   },
  { name: 'Polygon zkEVM', abbr: 'zkEVM',  color: '#7B3FE4', isEVM: true,  nativeCurrency: 'ETH',  chainId: 1101     },
  { name: 'Zora',          abbr: 'Zora',   color: '#2B5DF0', isEVM: true,  nativeCurrency: 'ETH',  chainId: 7777777  },
  { name: 'Unichain',      abbr: 'UNI',    color: '#FF007A', isEVM: true,  nativeCurrency: 'ETH',  chainId: 1301     },
  { name: 'Mantle',        abbr: 'MNT',    color: '#6FC8FF', isEVM: true,  nativeCurrency: 'MNT',  chainId: 5000     },
  { name: 'opBNB',         abbr: 'opBNB',  color: '#F0B90B', isEVM: true,  nativeCurrency: 'BNB',  chainId: 204      },

  // ── Newer / emerging EVM chains ──────────────────────────────────────────
  { name: 'Berachain',     abbr: 'Bera',   color: '#FF9A44', isEVM: true,  nativeCurrency: 'BERA', chainId: 80094    },
  { name: 'Monad',         abbr: 'MON',    color: '#6B2BF7', isEVM: true,  nativeCurrency: 'MON',  chainId: 41454    },
  { name: 'HyperEVM',      abbr: 'HYPE',   color: '#00F5A0', isEVM: true,  nativeCurrency: 'HYPE', chainId: 998      },

  // ── Non-EVM ──────────────────────────────────────────────────────────────
  { name: 'Solana',        abbr: 'Sol',    color: '#9945FF', isEVM: false, nativeCurrency: 'SOL'                     },
  { name: 'Starknet',      abbr: 'Stark',  color: '#EC796B', isEVM: false, nativeCurrency: 'ETH'                     },
  { name: 'Sui',           abbr: 'Sui',    color: '#6FBCF0', isEVM: false, nativeCurrency: 'SUI'                     },
  { name: 'Tron',          abbr: 'TRX',    color: '#FF060A', isEVM: false, nativeCurrency: 'TRX'                     },
  { name: 'TON',           abbr: 'TON',    color: '#0088CC', isEVM: false, nativeCurrency: 'TON'                     },
  { name: 'NEAR',          abbr: 'NEAR',   color: '#00C08B', isEVM: false, nativeCurrency: 'NEAR'                    },

  { name: 'Other',         abbr: 'Other',  color: '#6B7280', isEVM: false, nativeCurrency: ''                        },
];

/** Lookup by full name (matches project.chain field) */
export const CHAIN_BY_NAME = new Map<string, ChainInfo>(
  SUPPORTED_CHAINS.map((c) => [c.name, c])
);

/** Just the chain names, for use in form <select> options */
export const CHAIN_NAMES = SUPPORTED_CHAINS.map((c) => c.name);
