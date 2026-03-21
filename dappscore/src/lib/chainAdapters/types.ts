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
  /**
   * GoPlus Security numeric chain ID.
   * EVM chains only. Solana is handled via a separate endpoint
   * (check family === 'solana' in panel code).
   */
  goplusId?: number;
  /**
   * DexScreener chain slug (e.g. 'ethereum', 'bsc', 'solana').
   * Present on all chains where DexScreener indexes pairs.
   */
  dexscreenerId?: string;
  /**
   * Honeypot.is numeric chain ID.
   * Matches the EVM chainId for supported chains.
   */
  honeypotId?: number;
}
