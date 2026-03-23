export type { ContractInfo, ChainFamily, ChainConfig } from './types';
export { getChainConfig } from './chains';

import type { ContractInfo } from './types';
import { getChainConfig } from './chains';
import { fetchEvmContractInfo } from './evm';
import { fetchSolanaContractInfo } from './solana';
import { fetchTronContractInfo } from './tron';
import { fetchTonContractInfo } from './ton';
import { fetchSuiContractInfo } from './sui';

/**
 * Fetch contract/program info for any supported chain.
 * Dispatches to the correct adapter based on chain family.
 */
export async function fetchContractInfo(
  chain: string,
  address: string,
): Promise<ContractInfo> {
  const config = getChainConfig(chain);
  if (!config) throw new Error(`Unsupported chain: ${chain}`);

  switch (config.family) {
    case 'evm':
      if (!config.apiBase) throw new Error(`No API configured for ${chain}`);
      return fetchEvmContractInfo(config.apiBase, address);
    case 'solana':
      return fetchSolanaContractInfo(address);
    case 'tron':
      return fetchTronContractInfo(address);
    case 'ton':
      return fetchTonContractInfo(address);
    case 'sui':
      return fetchSuiContractInfo(address);
  }
}

/**
 * Returns the block explorer URL for a given address on the given chain.
 * Returns null for unknown chains.
 */
export function getExplorerUrl(chain: string, address: string): string | null {
  const config = getChainConfig(chain);
  if (!config) return null;
  switch (config.family) {
    case 'evm':
      return `${config.explorerBase}/address/${address}`;
    case 'solana':
      return `${config.explorerBase}/account/${address}`;
    case 'tron':
      return `${config.explorerBase}/#/contract/${address}`;
    case 'ton':
      return `${config.explorerBase}/address/${address}`;
    case 'sui':
      return `${config.explorerBase}/object/${address}`;
  }
}

/** True if the chain has programmatic lookup support (not just an explorer link). */
export function hasApiSupport(chain: string): boolean {
  const config = getChainConfig(chain);
  if (!config) return false;
  // SUI contract info not yet supported (security via GoPlus only)
  if (config.family === 'sui') return false;
  // Non-EVM families always have their own fetchers; EVM needs apiBase
  return config.family !== 'evm' || !!config.apiBase;
}
