import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

import { projectRoutes } from './routes/projects';
import { userRoutes } from './routes/users';
import { statsRoutes } from './routes/stats';
import { alertRoutes } from './routes/alerts';
import { shareRoutes } from './routes/share';
import { scamDetectionRoutes } from './routes/scam-detection';
import whaleRoutes from './routes/whales';
import { webhookRoutes } from './routes/webhooks';
import apiKeyRoutes from './routes/api-keys';
import { watchlistRoutes } from './routes/watchlist';
import { rugMonitorRoutes } from './routes/rug-monitor';
import txGraphRoutes from './routes/tx-graph';

import whaleTrackingService from './services/whale-tracking';
import { runAndAlert } from './services/event-monitor';
import { runWatchlistMonitor } from './services/watchlist-monitor';
import { rugDetectorEvents, runAndBroadcast } from './services/rug-detector';
import { proxyUpgradeWatcher, proxyUpgradeEvents, type ProxyUpgradeEvent } from './services/proxy-upgrade-watcher';
import { alertService } from './services/alerts';
import { db } from './lib/db';
import { logger } from './services/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const httpServer = createServer(app);

// ── WebSocket server (ws://host:3001/ws) ──────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws) => {
  logger.info('[WS] Client connected');
  ws.send(JSON.stringify({ type: 'connected', message: 'DappScore real-time feed active' }));

  ws.on('error', (err) => logger.warn('[WS] Client error:', err));
  ws.on('close', () => logger.info('[WS] Client disconnected'));
});

// Broadcast every rug alert to all connected WS clients
rugDetectorEvents.on('rug_alert', (signal) => {
  const payload = JSON.stringify({ type: 'rug_alert', signal });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
});

// ── Real-time proxy upgrade alerts ────────────────────────────────────────────
proxyUpgradeEvents.on('upgrade', async (evt: ProxyUpgradeEvent) => {
  // 1. Broadcast to all connected WS clients immediately
  const wsPayload = JSON.stringify({ type: 'proxy_upgrade', event: {
    ...evt,
    blockNumber: evt.blockNumber.toString(), // bigint → string for JSON
  }});
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(wsPayload);
  }

  // 2. Persist + deliver alert to every user who is watching this contract
  try {
    const { rows } = await db.query<{ user_id: string; project_id: string }>(
      `SELECT DISTINCT user_id, project_id
       FROM user_watchlist
       WHERE token_address ILIKE $1`,
      [evt.contractAddress],
    );

    for (const row of rows) {
      await alertService.createAlert({
        userId:    row.user_id,
        type:      'contract_event',
        projectId: row.project_id,
        title:     'Proxy upgrade detected',
        message:
          `Contract ${evt.contractAddress} implementation upgraded to ` +
          `${evt.newImplementation} — all contract logic may have changed.`,
        severity: 'critical',
        metadata: {
          eventType:         'proxy-upgraded',
          contractAddress:   evt.contractAddress,
          newImplementation: evt.newImplementation,
          transactionHash:   evt.transactionHash,
          blockNumber:       evt.blockNumber.toString(),
          network:           evt.network,
        },
      });
    }

    if (rows.length > 0) {
      logger.warn(
        `[ProxyUpgrade] Alerted ${rows.length} user(s) for upgrade on ${evt.contractAddress}`,
      );
    }
  } catch (err) {
    logger.error('[ProxyUpgrade] Alert delivery error', err as Error);
  }
});

// Middleware
app.use(helmet());
const ALLOWED_ORIGINS = new Set(
  (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
);
app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server calls (no Origin header) and listed origins
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/share', shareRoutes);
app.use('/api/v1/scam-detection', scamDetectionRoutes);
app.use('/api/v1/whales', whaleRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/watchlist', watchlistRoutes);
app.use('/api/v1/rug-monitor', rugMonitorRoutes);
app.use('/api/v1/tx-graph',   txGraphRoutes);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Cron jobs
// Scam pattern + event monitoring — runs every hour.
// To activate event monitoring for a project, call runAndAlert() with the
// contract address, project ID, and subscribed user IDs.  The watched
// address list should come from a DB/cache layer once that is in place;
// for now the route GET /api/scam-detection/events handles on-demand checks.
cron.schedule('0 * * * *', async () => {
  logger.info('Hourly scam pattern + event monitor sweep');
  // Run LP-drop checks for all watchlisted tokens
  runWatchlistMonitor().catch(err =>
    logger.error('Watchlist monitor error', err as Error),
  );
  // Proxy Upgraded events are now handled in real-time by proxyUpgradeWatcher.
  // The cron here handles other event types (ownership transfers, LP events).
  // TODO: load watched contract addresses from DB for ownership/LP event monitoring:
  //   const contracts = await db.getWatchedContracts();
  //   for (const c of contracts) {
  //     await runAndAlert(c.address, c.projectId, c.subscribedUserIds, c.pairAddress);
  //   }
  void runAndAlert; // imported — linter suppression until DB integration
});

// Update whale wallets daily
cron.schedule('0 0 * * *', async () => {
  logger.info('Updating whale wallet data...');
  // Whale tracking service runs on-demand via API
});

// ── Rug-in-Progress sweep — every 5 minutes ───────────────────────────────────
// Loads all watchlisted tokens from DB and runs combined rug detection.
// Any token scoring ≥ 25 is broadcast to WS clients automatically.
cron.schedule('*/5 * * * *', async () => {
  logger.info('[RugMonitor] Running 5-min rug detection sweep...');
  // TODO: load watchlisted tokens from DB once watchlist stores pair/deployer addresses:
  //   const tokens = await db.getWatchlistTokensWithMeta();
  //   for (const t of tokens) {
  //     await runAndBroadcast({
  //       tokenAddress:    t.tokenAddress,
  //       pairAddress:     t.pairAddress,
  //       deployerAddress: t.deployerAddress,
  //       explorerApiBase: t.explorerApiBase,
  //       chainId:         t.chainId,
  //     });
  //   }
  void runAndBroadcast; // imported — linter suppression until DB integration
});

// ── Startup: subscribe to proxy upgrades for all currently-watched contracts ──
async function initProxyUpgradeWatcher(): Promise<void> {
  try {
    const { rows } = await db.query<{ token_address: string; network: string }>(
      `SELECT DISTINCT token_address, network
       FROM user_watchlist
       WHERE token_address IS NOT NULL`,
    );
    proxyUpgradeWatcher.watchMany(
      rows.map(r => ({
        address: r.token_address,
        network: (r.network === 'testnet' ? 'testnet' : 'mainnet') as 'mainnet' | 'testnet',
      })),
    );
    logger.info(
      `[ProxyUpgrade] Real-time watcher started — ` +
      `${proxyUpgradeWatcher.watchedCount} contract(s) subscribed`,
    );
  } catch (err) {
    logger.error('[ProxyUpgrade] Failed to load watched contracts from DB', err as Error);
  }
}

httpServer.listen(PORT, () => {
  logger.info(`DappScore Backend running on port ${PORT}`);
  logger.info(`WebSocket server listening at ws://localhost:${PORT}/ws`);
  // Start real-time proxy upgrade subscriptions after the event loop is ready
  initProxyUpgradeWatcher().catch(err =>
    logger.error('[ProxyUpgrade] Init error', err as Error),
  );
});

export default app;
