import { defineString } from 'firebase-functions/params';

const subgraphUrl = defineString('SUBGRAPH_URL', {
  description: 'The Graph subgraph endpoint for DappScore',
});

export interface GqlResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

/** Minimal subgraph client — uses native fetch (Node 20). */
export async function gql<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const url = subgraphUrl.value();
  if (!url) throw new Error('SUBGRAPH_URL is not configured.');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);

  const json = (await res.json()) as GqlResponse<T>;
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}
