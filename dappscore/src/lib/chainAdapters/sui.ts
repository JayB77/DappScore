import type { ContractInfo } from './types';

/**
 * SUI contract info — returns a minimal record.
 * Full object/package inspection is not yet integrated; security data
 * is fetched separately via the GoPlus SUI endpoint in TokenSecurityPanel.
 */
export async function fetchSuiContractInfo(_address: string): Promise<ContractInfo> {
  return {
    verified:     false,
    contractName: '',
    isProxy:      false,
    creator:      undefined,
    chainFamily:  'sui',
  };
}
