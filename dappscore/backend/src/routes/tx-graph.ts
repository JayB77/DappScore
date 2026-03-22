/**
 * GET /api/v1/tx-graph/:address?chain=base
 *
 * Builds a wallet-relationship graph from the first batch of ERC-20 Transfer
 * events for a token contract.  Returns nodes (wallets) and directed edges
 * (transfer relationships) so the frontend can render a force-directed graph.
 *
 * Graph construction rules:
 *  - Mint transfers (from = 0x0)  → recipient is labelled "deployer/owner"
 *  - Direct transfers from deployer → "insider" wallets
 *  - Known exchange addresses      → labelled accordingly
 *  - 0x000…dead / 0x000…000        → "burn"
 *  - Anything else in the first N transfers → "unknown"
 *
 * We limit to the first MAX_LOGS Transfer events so the query stays fast even
 * on heavily-traded tokens.
 */

import { Router } from 'express';
import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { logger } from '../services/logger';

const router = Router();

// ── On-chain constants ────────────────────────────────────────────────────────

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

const ZERO_ADDRESS   = '0x0000000000000000000000000000000000000000';
const DEAD_ADDRESS   = '0x000000000000000000000000000000000000dead';

const MAX_LOGS       = 150;   // caps RPC cost; enough to map early insiders
const RPC_TIMEOUT_MS = 15_000;

// ── Known-entity registry ─────────────────────────────────────────────────────

type NodeType = 'contract' | 'deployer' | 'insider' | 'exchange' | 'burn' | 'unknown';

interface KnownEntry { label: string; type: NodeType }

const KNOWN: Record<string, KnownEntry> = {
  [ZERO_ADDRESS]: { label: 'Zero/Mint',     type: 'burn'     },
  [DEAD_ADDRESS]: { label: 'Dead Burn',     type: 'burn'     },

  // ── Centralised exchanges ─────────────────────────────────────────────────
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': { label: 'Coinbase',      type: 'exchange' },
  '0x28c6c06298d514db089934071355e5743bf21d60': { label: 'Binance',       type: 'exchange' },
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': { label: 'Binance',       type: 'exchange' },
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': { label: 'Binance',       type: 'exchange' },
  '0x9696f59e4d72e237be84ffd425dcad154bf96976': { label: 'Bybit',         type: 'exchange' },
  '0xf89d7b9c864f589bbf53a82105107622b35eaa40': { label: 'Bybit',         type: 'exchange' },
  '0x4e9ce36e442e55ecd9025b9a6e0d88485d628a67': { label: 'OKX',           type: 'exchange' },
  '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b': { label: 'OKX',           type: 'exchange' },

  // ── DEX routers / contracts (Base) ───────────────────────────────────────
  '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24': { label: 'Uniswap V2',   type: 'exchange' },
  '0x2626664c2603336e57b271c5c0b26f421741e481': { label: 'Uniswap V3',   type: 'exchange' },
  '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43': { label: 'Aerodrome',    type: 'exchange' },
  '0x6cb442acf35158d68425b350ec745b9e3c2fdfc3': { label: 'Aerodrome',    type: 'exchange' },
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': { label: 'Uniswap UR',  type: 'exchange' },

  // ── Bridge contracts ──────────────────────────────────────────────────────
  '0x4200000000000000000000000000000000000010': { label: 'Base Bridge',   type: 'contract' },
  '0x49048044d57e1c92a77f2c86fb3e0d7dba600894': { label: 'Base Bridge',   type: 'contract' },
};

// ── Shared response types ─────────────────────────────────────────────────────

export interface TxGraphNode {
  id:        string;   // = address (lowercase)
  address:   string;
  label:     string;
  type:      NodeType;
  txCount:   number;   // transfers involving this address in the sample
}

export interface TxGraphEdge {
  id:     string;
  source: string;
  target: string;
  count:  number;      // how many transfers share this source→target pair
  isMint: boolean;
}

export interface TxGraphResponse {
  contract:    string;
  nodes:       TxGraphNode[];
  edges:       TxGraphEdge[];
  totalSampled: number;
  chain:       string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(address: string): string {
  return address.toLowerCase();
}

function shortLabel(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.get('/:address', async (req, res) => {
  const rawAddress = req.params.address;
  const chainParam = (req.query.chain as string | undefined)?.toLowerCase() ?? 'base';

  if (!/^0x[0-9a-fA-F]{40}$/.test(rawAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid contract address' });
  }

  const tokenAddress = normalize(rawAddress) as Address;

  // Pick RPC endpoint
  const rpcUrl = chainParam === 'baseSepolia' || chainParam === 'base-sepolia'
    ? (process.env.RPC_URL_TESTNET ?? 'https://sepolia.base.org')
    : (process.env.RPC_URL         ?? 'https://mainnet.base.org');

  const chain = chainParam.includes('sepolia') ? baseSepolia : base;

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: RPC_TIMEOUT_MS }),
  }) as ReturnType<typeof createPublicClient>;

  try {
    // ── 1. Fetch first MAX_LOGS Transfer events ──────────────────────────────
    const logs = await (client as any).getLogs({
      address:   tokenAddress,
      event:     TRANSFER_EVENT,
      fromBlock: 0n,
      toBlock:   'latest',
    });

    // Viem may return all logs — slice to MAX_LOGS earliest
    const sample = Array.isArray(logs) ? logs.slice(0, MAX_LOGS) : [];

    if (sample.length === 0) {
      const empty: TxGraphResponse = {
        contract: tokenAddress, nodes: [], edges: [], totalSampled: 0, chain: chainParam,
      };
      return res.json({ success: true, data: empty });
    }

    // ── 2. Extract raw transfers ──────────────────────────────────────────────
    interface RawTransfer {
      from: string;
      to:   string;
    }

    const transfers: RawTransfer[] = sample
      .filter((l: any) => l.args?.from && l.args?.to)
      .map((l: any) => ({
        from: normalize(l.args.from as string),
        to:   normalize(l.args.to   as string),
      }));

    // ── 3. Identify the deployer ──────────────────────────────────────────────
    // First mint (from=0x0) recipient is treated as deployer/owner.
    let deployerAddress: string | null = null;
    for (const t of transfers) {
      if (t.from === ZERO_ADDRESS && t.to !== tokenAddress) {
        deployerAddress = t.to;
        break;
      }
    }

    // ── 4. Build node + edge maps ─────────────────────────────────────────────
    const nodeMap   = new Map<string, TxGraphNode>();
    const edgeMap   = new Map<string, TxGraphEdge>();

    function upsertNode(address: string, hintType?: NodeType): TxGraphNode {
      if (!nodeMap.has(address)) {
        const known   = KNOWN[address];
        let type: NodeType = known?.type ?? hintType ?? 'unknown';
        let label          = known?.label ?? shortLabel(address);

        if (!known) {
          if (address === deployerAddress)   { type = 'deployer'; label = 'Deployer'; }
          else if (address === tokenAddress) { type = 'contract'; label = 'Token';    }
        }

        nodeMap.set(address, { id: address, address, label, type, txCount: 0 });
      }
      return nodeMap.get(address)!;
    }

    function upsertEdge(from: string, to: string, isMint: boolean): void {
      const key = `${from}->${to}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { id: key, source: from, target: to, count: 0, isMint });
      }
      edgeMap.get(key)!.count++;
    }

    // Always add the token contract node at center
    upsertNode(tokenAddress, 'contract');
    nodeMap.get(tokenAddress)!.label = 'Token Contract';

    const insiderSet = new Set<string>();

    for (const { from, to } of transfers) {
      const isMint = from === ZERO_ADDRESS;

      // Infer insider: direct transfer from deployer to a non-exchange wallet
      if (
        deployerAddress &&
        from === deployerAddress &&
        to !== tokenAddress &&
        !KNOWN[to]
      ) {
        insiderSet.add(to);
      }

      const fromNode = upsertNode(from);
      const toNode   = upsertNode(to);

      // Override type for identified insiders (before edge counting)
      if (insiderSet.has(fromNode.id) && fromNode.type === 'unknown') {
        fromNode.type  = 'insider';
        fromNode.label = `Insider ${shortLabel(fromNode.address)}`;
      }
      if (insiderSet.has(toNode.id) && toNode.type === 'unknown') {
        toNode.type  = 'insider';
        toNode.label = `Insider ${shortLabel(toNode.address)}`;
      }

      fromNode.txCount++;
      toNode.txCount++;

      // Only add edges that involve the contract, deployer, or insiders — keeps
      // the graph readable.  Unknown→unknown edges are skipped unless they come
      // from a known node.
      const fromIsKnown = fromNode.type !== 'unknown';
      const toIsKnown   = toNode.type   !== 'unknown';
      if (fromIsKnown || toIsKnown || isMint) {
        upsertEdge(from, to, isMint);
      }
    }

    // Promote any insider-set addresses whose type is still 'unknown'
    for (const addr of insiderSet) {
      const node = nodeMap.get(addr);
      if (node && node.type === 'unknown') {
        node.type  = 'insider';
        node.label = `Insider ${shortLabel(addr)}`;
      }
    }

    // Remove the zero-address node from the result (keep the edge, drop the node render)
    nodeMap.delete(ZERO_ADDRESS);

    const result: TxGraphResponse = {
      contract:     tokenAddress,
      nodes:        Array.from(nodeMap.values()),
      edges:        Array.from(edgeMap.values()),
      totalSampled: transfers.length,
      chain:        chainParam,
    };

    logger.info(
      `[TxGraph] ${tokenAddress} → ${result.nodes.length} nodes, ` +
      `${result.edges.length} edges (sampled ${transfers.length} transfers)`,
    );

    return res.json({ success: true, data: result });

  } catch (err) {
    logger.error('[TxGraph] Error building graph', err as Error);
    return res.status(500).json({ success: false, error: 'Failed to build transaction graph' });
  }
});

export default router;
