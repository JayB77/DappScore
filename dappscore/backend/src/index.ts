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
import { disputeRoutes } from './routes/disputes';
import b2bRoutes from './routes/b2b';
import adminB2bRoutes from './routes/admin-b2b';

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
  const wsPayload = JSON.stringify({ type: 'proxy_upgrade', event: {
    ...evt,
    blockNumber: evt.blockNumber.toString(),
  }});
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(wsPayload);
  }

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
      logger.warn(`[ProxyUpgrade] Alerted ${rows.length} user(s) for upgrade on ${evt.contractAddress}`);
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
app.use('/api/v1/projects',    projectRoutes);
app.use('/api/v1/users',       userRoutes);
app.use('/api/v1/stats',       statsRoutes);
app.use('/api/v1/alerts',      alertRoutes);
app.use('/api/v1/share',       shareRoutes);
app.use('/api/v1/scam-detection', scamDetectionRoutes);
app.use('/api/v1/whales',      whaleRoutes);
app.use('/api/v1/webhooks',    webhookRoutes);
app.use('/api/v1/api-keys',    apiKeyRoutes);
app.use('/api/v1/watchlist',   watchlistRoutes);
app.use('/api/v1/rug-monitor', rugMonitorRoutes);
app.use('/api/v1/tx-graph',    txGraphRoutes);
app.use('/api/v1/disputes',    disputeRoutes);
app.use('/api/v1/b2b',         b2bRoutes);
app.use('/api/v1/admin/b2b',   adminB2bRoutes);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Cron jobs
cron.schedule('0 * * * *', async () => {
  logger.info('Hourly scam pattern + event monitor sweep');
  runWatchlistMonitor().catch(err => logger.error('Watchlist monitor error', err as Error));
  void runAndAlert;
});

cron.schedule('0 0 * * *', async () => {
  logger.info('Updating whale wallet data...');
});

// ── Rug-in-Progress sweep — every 5 minutes ───────────────────────────────────
cron.schedule('*/5 * * * *', async () => {
  logger.info('[RugMonitor] Running 5-min rug detection sweep...');
  void runAndBroadcast;
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
  initProxyUpgradeWatcher().catch(err =>
    logger.error('[ProxyUpgrade] Init error', err as Error),
  );
});

export default app;
