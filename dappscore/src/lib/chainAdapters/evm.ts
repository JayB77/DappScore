import type { ContractInfo } from './types';

export async function fetchEvmContractInfo(
  apiBase: string,
  address: string,
): Promise<ContractInfo> {
  const [sourceRes, creationRes] = await Promise.all([
    fetch(`${apiBase}?module=contract&action=getsourcecode&address=${address}`),
    fetch(`${apiBase}?module=contract&action=getcontractcreation&contractaddresses=${address}`),
  ]);

  const [sourceData, creationData] = await Promise.all([
    sourceRes.json(),
    creationRes.json(),
  ]);

  const source = sourceData?.result?.[0];
  const creation = creationData?.result?.[0];

  const verified =
    source &&
    source.ABI !== 'Contract source code not verified' &&
    source.ABI !== '' &&
    source.ABI != null;

  return {
    verified: !!verified,
    contractName: source?.ContractName ?? '',
    isProxy: source?.IsProxy === '1',
    creator: creation?.contractCreator,
    chainFamily: 'evm',
  };
}
