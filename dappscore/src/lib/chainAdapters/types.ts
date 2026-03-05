export type ChainFamily = 'evm' | 'solana' | 'tron' | 'ton';

export interface ContractInfo {
  /** Source verified on-chain (EVM: Etherscan; Solana: Anchor IDL present) */
  verified: boolean;
  contractName: string;
  /** Upgradeable proxy (EVM) or upgradeable program (Solana) */
  isProxy: boolean;
  creator?: string;
  chainFamily: ChainFamily;
}

export interface ChainConfig {
  /** Block explorer API base (undefined = no programmatic lookup) */
  apiBase?: string;
  /** Human-facing explorer URL root */
  explorerBase: string;
  family: ChainFamily;
}
