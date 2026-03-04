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
}

export const SUPPORTED_CHAINS: ChainInfo[] = [
  { name: 'Ethereum',   abbr: 'ETH',    color: '#627EEA', isEVM: true,  nativeCurrency: 'ETH'  },
  { name: 'Arbitrum',   abbr: 'Arb',    color: '#28A0F0', isEVM: true,  nativeCurrency: 'ETH'  },
  { name: 'Optimism',   abbr: 'OP',     color: '#FF0420', isEVM: true,  nativeCurrency: 'ETH'  },
  { name: 'Base',       abbr: 'Base',   color: '#0052FF', isEVM: true,  nativeCurrency: 'ETH'  },
  { name: 'Polygon',    abbr: 'Pol',    color: '#8247E5', isEVM: true,  nativeCurrency: 'MATIC' },
  { name: 'BNB Chain',  abbr: 'BNB',    color: '#F0B90B', isEVM: true,  nativeCurrency: 'BNB'  },
  { name: 'Avalanche',  abbr: 'AVAX',   color: '#E84142', isEVM: true,  nativeCurrency: 'AVAX' },
  { name: 'Solana',     abbr: 'Sol',    color: '#9945FF', isEVM: false, nativeCurrency: 'SOL'  },
  { name: 'Sui',        abbr: 'Sui',    color: '#6FBCF0', isEVM: false, nativeCurrency: 'SUI'  },
  { name: 'Tron',       abbr: 'TRX',    color: '#FF060A', isEVM: false, nativeCurrency: 'TRX'  },
  { name: 'TON',        abbr: 'TON',    color: '#0088CC', isEVM: false, nativeCurrency: 'TON'  },
  { name: 'NEAR',       abbr: 'NEAR',   color: '#00C08B', isEVM: false, nativeCurrency: 'NEAR' },
  { name: 'zkSync Era', abbr: 'zkSync', color: '#4E529A', isEVM: true,  nativeCurrency: 'ETH'  },
  { name: 'Linea',      abbr: 'Linea',  color: '#61DFFF', isEVM: true,  nativeCurrency: 'ETH'  },
  { name: 'Scroll',     abbr: 'Scroll', color: '#EFB88B', isEVM: true,  nativeCurrency: 'ETH'  },
  { name: 'Fantom',     abbr: 'FTM',    color: '#1969FF', isEVM: true,  nativeCurrency: 'FTM'  },
  { name: 'Other',      abbr: 'Other',  color: '#6B7280', isEVM: false, nativeCurrency: ''     },
];

/** Lookup by full name (matches project.chain field) */
export const CHAIN_BY_NAME = new Map<string, ChainInfo>(
  SUPPORTED_CHAINS.map((c) => [c.name, c])
);

/** Just the chain names, for use in form <select> options */
export const CHAIN_NAMES = SUPPORTED_CHAINS.map((c) => c.name);
