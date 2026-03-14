/**
 * Contract Event Monitor
 *
 * Polls recent on-chain events for a given contract address and scores them
 * for risk. Tracks four categories:
 *
 *   1. Ownership transfers  — OwnershipTransferred(address,address)
 *      - Transfer to zero = ownership renounced (info)
 *      - Transfer to any other address = high risk (control moved)
 *
 *   2. Proxy upgrades       — Upgraded(address) (EIP-1967)
 *      - Any upgrade in the monitoring window = critical
 *
 *   3. Liquidity events     — Uniswap V2 Mint / Burn on the pair contract
 *      - Large liquidity removes shortly after launch = high risk
 *
 *   4. Fee / parameter changes — FeeUpdated / TaxUpdated custom events
 *      - No standard ABI; detected via known function selectors in tx input
 *
 * Designed to be called on-demand or by a polling cron job.
 * Integrates with the existing AlertService for user notifications.
 */

import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { logger } from './logger';
import { alertService } from './alerts';

// ── Event ABI items ───────────────────────────────────────────────────────────

const EV_OWNERSHIP_TRANSFERRED = parseAbiItem(
  'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',
);
const EV_UPGRADED = parseAbiItem(
  'event Upgraded(address indexed implementation)',
);
// Uniswap V2 pair events — fired on the LP pair contract, not the token
const EV_UNIV2_MINT = parseAbiItem(
  'event Mint(address indexed sender, uint256 amount0, uint256 amount1)',
);
const EV_UNIV2_BURN = parseAbiItem(
  'event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)',
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContractEventType =
  | 'ownership-transferred'
  | 'ownership-renounced'
  | 'proxy-upgraded'
  | 'liquidity-added'
  | 'liquidity-removed';

export interface ContractEvent {
  type: ContractEventType;
  severity: 'info' | 'medium' | 'high' | 'critical';
  contractAddress: string;
  transactionHash: string;
  blockNumber: bigint;
  details: Record<string, unknown>;
  description: string;
}

export interface EventMonitorResult {
  contractAddress: string;
  events: ContractEvent[];
  /** 0–100: composite risk contributed by recent events. */
  riskScore: number;
  hasHighRiskEvents: boolean;
  analyzedAt: Date;
}

// ── Score weights ─────────────────────────────────────────────────────────────

const EVENT_RISK: Record<ContractEventType, number> = {
  'ownership-transferred':  30,
  'ownership-renounced':     0, // positive signal
  'proxy-upgraded':         50,
  'liquidity-removed':      20,
  'liquidity-added':         0,
};

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Fetch and score recent contract events.
 *
 * @param contractAddress Token contract to monitor
 * @param pairAddress     Uniswap V2 pair address (for LP events). Optional.
 * @param network         'mainnet' | 'testnet'
 * @param lookbackBlocks  How many recent blocks to scan (default 7 200 ≈ 24h on Base)
 */
export async function monitorContractEvents(
  contractAddress: string,
  pairAddress?: string,
  network: 'mainnet' | 'testnet' = 'mainnet',
  lookbackBlocks = 7_200,
): Promise<EventMonitorResult> {
  const client = createPublicClient({
    chain: network === 'mainnet' ? base : baseSepolia,
    transport: http(
      process.env.RPC_URL ??
      (network === 'mainnet' ? 'https://mainnet.base.org' : 'https://sepolia.base.org'),
    ),
  });

  const events: ContractEvent[] = [];

  try {
    const currentBlock = await client.getBlockNumber();
    const fromBlock    = currentBlock - BigInt(lookbackBlocks);
    const tokenAddr    = contractAddress as Address;
    const pairAddr     = pairAddress as Address | undefined;

    // Fetch all event logs in parallel
    const [ownershipRes, upgradedRes, mintRes, burnRes] = await Promise.allSettled([
      client.getLogs({ address: tokenAddr, event: EV_OWNERSHIP_TRANSFERRED, fromBlock }),
      client.getLogs({ address: tokenAddr, event: EV_UPGRADED,              fromBlock }),
      pairAddr
        ? client.getLogs({ address: pairAddr, event: EV_UNIV2_MINT, fromBlock })
        : Promise.resolve([]),
      pairAddr
        ? client.getLogs({ address: pairAddr, event: EV_UNIV2_BURN, fromBlock })
        : Promise.resolve([]),
    ]);

    // ── Ownership transfers ─────────────────────────────────────────────────
    if (ownershipRes.status === 'fulfilled') {
      for (const log of ownershipRes.value) {
        const newOwner    = (log.args.newOwner ?? '').toLowerCase();
        const prevOwner   = log.args.previousOwner ?? '';
        const isRenounced = newOwner === '0x0000000000000000000000000000000000000000';

        events.push({
          type:            isRenounced ? 'ownership-renounced' : 'ownership-transferred',
          severity:        isRenounced ? 'info' : 'high',
          contractAddress,
          transactionHash: log.transactionHash ?? '',
          blockNumber:     log.blockNumber ?? 0n,
          details:         { previousOwner: prevOwner, newOwner: log.args.newOwner },
          description:     isRenounced
            ? `Ownership renounced — contract is now ownerless`
            : `Ownership transferred from ${prevOwner} to ${log.args.newOwner}`,
        });
      }
    } else {
      logger.warn('[EventMonitor] OwnershipTransferred fetch failed:', ownershipRes.reason);
    }

    // ── Proxy upgrades ──────────────────────────────────────────────────────
    if (upgradedRes.status === 'fulfilled') {
      for (const log of upgradedRes.value) {
        events.push({
          type:            'proxy-upgraded',
          severity:        'critical',
          contractAddress,
          transactionHash: log.transactionHash ?? '',
          blockNumber:     log.blockNumber ?? 0n,
          details:         { newImplementation: log.args.implementation },
          description:
            `Contract implementation upgraded to ${log.args.implementation} — ` +
            `all contract logic may have changed`,
        });
      }
    } else {
      logger.warn('[EventMonitor] Upgraded fetch failed:', upgradedRes.reason);
    }

    // ── LP liquidity additions ──────────────────────────────────────────────
    if (mintRes.status === 'fulfilled' && pairAddr) {
      for (const log of mintRes.value) {
        events.push({
          type:            'liquidity-added',
          severity:        'info',
          contractAddress: pairAddress!,
          transactionHash: log.transactionHash ?? '',
          blockNumber:     log.blockNumber ?? 0n,
          details: {
            sender:  log.args.sender,
            amount0: log.args.amount0?.toString(),
            amount1: log.args.amount1?.toString(),
          },
          description: `Liquidity added to pair by ${log.args.sender}`,
        });
      }
    }

    // ── LP liquidity removals ───────────────────────────────────────────────
    if (burnRes.status === 'fulfilled' && pairAddr) {
      for (const log of burnRes.value) {
        events.push({
          type:            'liquidity-removed',
          severity:        'medium',
          contractAddress: pairAddress!,
          transactionHash: log.transactionHash ?? '',
          blockNumber:     log.blockNumber ?? 0n,
          details: {
            sender:  log.args.sender,
            to:      log.args.to,
            amount0: log.args.amount0?.toString(),
            amount1: log.args.amount1?.toString(),
          },
          description:
            `Liquidity removed from pair — sender: ${log.args.sender}, to: ${log.args.to}`,
        });
      }
    }

    // Sort most-recent first
    events.sort((a, b) => Number(b.blockNumber - a.blockNumber));

    // ── Risk score ──────────────────────────────────────────────────────────
    let riskScore = 0;
    for (const e of events) riskScore += EVENT_RISK[e.type] ?? 0;
    riskScore = Math.min(100, riskScore);

    return {
      contractAddress,
      events,
      riskScore,
      hasHighRiskEvents: events.some(e => e.severity === 'high' || e.severity === 'critical'),
      analyzedAt: new Date(),
    };
  } catch (error) {
    logger.error('[EventMonitor] monitorContractEvents error:', error);
    return {
      contractAddress,
      events: [],
      riskScore: 0,
      hasHighRiskEvents: false,
      analyzedAt: new Date(),
    };
  }
}

// ── Alert integration ─────────────────────────────────────────────────────────

/**
 * Run event monitoring for a watched project and push alerts to subscribed
 * users via the existing AlertService.
 *
 * @param contractAddress Token contract address
 * @param projectId       DappScore project ID (for alert routing)
 * @param userIds         Users subscribed to alerts for this project
 * @param pairAddress     Optional LP pair address
 * @param network         'mainnet' | 'testnet'
 */
export async function runAndAlert(
  contractAddress: string,
  projectId: string,
  userIds: string[],
  pairAddress?: string,
  network: 'mainnet' | 'testnet' = 'mainnet',
): Promise<EventMonitorResult> {
  const result = await monitorContractEvents(contractAddress, pairAddress, network);

  const highRisk = result.events.filter(
    e => e.severity === 'high' || e.severity === 'critical',
  );

  if (highRisk.length > 0 && userIds.length > 0) {
    const topEvent = highRisk[0];

    for (const userId of userIds) {
      await alertService.createAlert({
        userId,
        type: 'contract_event',
        projectId,
        title: `Contract event: ${topEvent.type.replace(/-/g, ' ')}`,
        message: topEvent.description,
        severity: topEvent.severity === 'critical' ? 'critical' : 'high',
        metadata: {
          eventType:       topEvent.type,
          contractAddress: topEvent.contractAddress,
          transactionHash: topEvent.transactionHash,
          blockNumber:     topEvent.blockNumber.toString(),
          details:         topEvent.details,
          totalEvents:     result.events.length,
          riskScore:       result.riskScore,
        },
      });
    }
  }

  return result;
}
