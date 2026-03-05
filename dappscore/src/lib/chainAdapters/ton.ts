import type { ContractInfo } from './types';

export async function fetchTonContractInfo(address: string): Promise<ContractInfo> {
  // TonCenter v2 — free public API, CORS-enabled
  const res = await fetch(
    `https://toncenter.com/api/v2/getAddressInformation?address=${encodeURIComponent(address)}`,
    { headers: { Accept: 'application/json' } },
  );

  if (!res.ok) throw new Error('TonCenter API error');

  const data = await res.json() as {
    ok: boolean;
    result?: {
      state?: string;    // 'active' | 'uninitialized' | 'frozen'
      code?: string;     // base64 contract code (present if deployed)
    };
  };

  if (!data.ok || !data.result) throw new Error('Address not found');

  const isActive = data.result.state === 'active';
  const hasCode = !!(data.result.code && data.result.code.length > 0);

  // TON doesn't have a centralised source verification registry yet
  return {
    verified: false,
    contractName: isActive && hasCode ? 'Smart Contract' : '',
    isProxy: false,
    creator: undefined,
    chainFamily: 'ton',
  };
}
