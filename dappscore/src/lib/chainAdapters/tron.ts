import type { ContractInfo } from './types';

export async function fetchTronContractInfo(address: string): Promise<ContractInfo> {
  const res = await fetch(
    `https://apilist.tronscanapi.com/api/contract?contract=${address}`,
    { headers: { Accept: 'application/json' } },
  );

  if (!res.ok) throw new Error('Tronscan API error');

  const data = await res.json() as {
    data?: {
      name?: string;
      abi?: string;
      creator?: { address?: string };
    }[];
  };

  const contract = data?.data?.[0];
  if (!contract) throw new Error('Contract not found');

  // Tron considers a contract "verified" if it has a published ABI + source
  const verified = !!(contract.abi && contract.abi.trim() !== '[]' && contract.abi.trim() !== '');

  return {
    verified,
    contractName: contract.name ?? '',
    isProxy: false, // Tron doesn't have an upgradeable proxy standard like EVM
    creator: contract.creator?.address,
    chainFamily: 'tron',
  };
}
