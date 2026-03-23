/**
 * Proxy Upgrade Watcher — real-time EIP-1967 Upgraded(address) detection.
 *
 * Uses viem's watchContractEvent, which internally:
 *   • Uses eth_subscribe (push) when a WebSocket transport is configured.
 *   • Falls back to getLogs polling (configurable interval) over HTTP.
 *
 * Set WS_RPC_URL / WS_RPC_URL_TESTNET for true push. Without them the service
 * polls every 12 s — still far faster than the previous hourly cron.
 *
 * Usage:
 *   proxyUpgradeWatcher.watchMany(contracts);   // call at server startup
 *   proxyUpgradeWatcher.watch(address, network); // call when user adds watchlist entry
 *   proxyUpgradeWatcher.unwatch(address, network);// call when last subscriber removes entry
 *
 *   proxyUpgradeEvents.on('upgrade', handler);   // receive events in index.ts
 */

import EventEmitter from 'events';
import {
  createPublicClient, http, webSocket, parseAbiItem,
  type Address,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { logger } from './logger';

// ── EIP-1967 Upgraded event ───────────────────────────────────────────────────

const EV_UPGRADED = parseAbiItem(
  'event Upgraded(address indexed implementation)',
);

// ── Public event payload ──────────────────────────────────────────────────────

export interface ProxyUpgradeEvent {
  contractAddress:   string;
  newImplementation: string;
  transactionHash:   string;
  blockNumber:       bigint;
  network:           'mainnet' | 'testnet';
  detectedAt:        Date;
}

// ── EventEmitter ──────────────────────────────────────────────────────────────

export const proxyUpgradeEvents = new EventEmitter();
// proxyUpgradeEvents.on('upgrade', (evt: ProxyUpgradeEvent) => { ... })

// ── Watcher ───────────────────────────────────────────────────────────────────

const HTTP_POLL_INTERVAL_MS = 12_000; // ~6 Base blocks — still real-time enough
const RECONNECT_DELAY_MS    = 30_000;

type Network = 'mainnet' | 'testnet';

interface SubscriptionKey { address: string; network: Network }

class ProxyUpgradeWatcher {
  // Map key: "mainnet:0xabc..." → unsubscribe function
  private readonly subs = new Map<string, () => void>();

  // Lazily-created viem clients (one per network).
  // Typed as `any` because Base/BaseSepolia include OP Stack "deposit" tx types
  // that are incompatible with viem's generic Chain type parameter.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clients: Partial<Record<Network, any>> = {};

  // ── Client factory ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getClient(network: Network): any {
    if (this.clients[network]) return this.clients[network]!;

    const wsUrl  = network === 'mainnet'
      ? process.env.WS_RPC_URL
      : process.env.WS_RPC_URL_TESTNET;

    const httpUrl = network === 'mainnet'
      ? (process.env.RPC_URL ?? 'https://mainnet.base.org')
      : 'https://sepolia.base.org';

    if (wsUrl) {
      logger.info(`[ProxyUpgrade] Using WebSocket transport for ${network}`);
      this.clients[network] = createPublicClient({
        chain:     network === 'mainnet' ? base : baseSepolia,
        transport: webSocket(wsUrl),
      });
    } else {
      logger.warn(
        `[ProxyUpgrade] WS_RPC_URL${network === 'testnet' ? '_TESTNET' : ''} not set — ` +
        `falling back to HTTP polling every ${HTTP_POLL_INTERVAL_MS / 1000}s`,
      );
      this.clients[network] = createPublicClient({
        chain:           network === 'mainnet' ? base : baseSepolia,
        transport:       http(httpUrl),
        pollingInterval: HTTP_POLL_INTERVAL_MS,
      });
    }

    return this.clients[network]!;
  }

  // ── Internal subscribe ──────────────────────────────────────────────────────

  private subscribe(address: string, network: Network): void {
    const key = `${network}:${address.toLowerCase()}`;
    if (this.subs.has(key)) return; // already subscribed

    const client = this.getClient(network);

    const unwatch = client.watchContractEvent({
      address:   address as Address,
      abi:       [EV_UPGRADED],
      eventName: 'Upgraded',

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const args = (log as unknown as { args: { implementation?: string } }).args;
          const evt: ProxyUpgradeEvent = {
            contractAddress:   address.toLowerCase(),
            newImplementation: (args.implementation ?? '') as string,
            transactionHash:   log.transactionHash ?? '',
            blockNumber:       log.blockNumber ?? 0n,
            network,
            detectedAt:        new Date(),
          };

          logger.warn(
            `[ProxyUpgrade] CRITICAL — ${address} upgraded to ${evt.newImplementation} ` +
            `(tx: ${evt.transactionHash})`,
          );

          proxyUpgradeEvents.emit('upgrade', evt);
        }
      },

      onError: (error: unknown) => {
        logger.warn('[ProxyUpgrade] Subscription error — will re-subscribe in 30 s', {
          address, network, error,
        });
        // Remove stale sub entry so the retry can re-register
        this.subs.delete(key);
        setTimeout(() => this.subscribe(address, network), RECONNECT_DELAY_MS);
      },
    });

    this.subs.set(key, unwatch);
    logger.info(`[ProxyUpgrade] Watching ${address} on ${network} (${this.subs.size} total)`);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Subscribe to proxy upgrade events for one contract. Idempotent. */
  watch(address: string, network: Network = 'mainnet'): void {
    this.subscribe(address, network);
  }

  /** Subscribe to multiple contracts (e.g. loaded from DB at startup). */
  watchMany(contracts: Array<{ address: string; network?: Network }>): void {
    for (const c of contracts) {
      this.subscribe(c.address, c.network ?? 'mainnet');
    }
  }

  /** Unsubscribe from a contract (call when no users are watching it). */
  unwatch(address: string, network: Network = 'mainnet'): void {
    const key = `${network}:${address.toLowerCase()}`;
    const unsubFn = this.subs.get(key);
    if (unsubFn) {
      unsubFn();
      this.subs.delete(key);
      logger.info(`[ProxyUpgrade] Unwatched ${address} on ${network} (${this.subs.size} remaining)`);
    }
  }

  /** Number of active subscriptions. */
  get watchedCount(): number { return this.subs.size; }
}

export const proxyUpgradeWatcher = new ProxyUpgradeWatcher();
