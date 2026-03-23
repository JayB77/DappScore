/**
 * DappScore API — VPS/standalone Express server.
 * Replaces the Firebase Cloud Functions wrapper.
 *
 * Start with:   node dist/index.js
 * Dev:          ts-node --transpile-only src/index.ts
 * Production:   pm2 start ecosystem.config.js
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import saleRoutes    from './routes/sale';
import projectRoutes from './routes/projects';
import userRoutes    from './routes/users';
import statsRoutes   from './routes/stats';
import alertRoutes   from './routes/alerts';
import webhookRoutes from './routes/webhooks';
import scamRoutes    from './routes/scam';
import whaleRoutes   from './routes/whales';
import adminRoutes   from './routes/admin';
import airdropRoutes from './routes/airdrop';
import claimRoutes   from './routes/claim';
import apiKeyRoutes  from './routes/api-keys';
import statusRoutes  from './routes/status';
import walletRoutes  from './routes/wallet';
import verifyRoutes   from './routes/verify';
import disputeRoutes  from './routes/disputes';
import { globalLimit } from './lib/rate-limit';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN ?? true }));
app.use(express.json({ limit: '256kb' }));
app.set('trust proxy', 1);
app.use(globalLimit);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/status',    statusRoutes);
app.use('/api/v1/projects',  projectRoutes);
app.use('/api/v1/projects',  saleRoutes);
app.use('/api/v1/users',     userRoutes);
app.use('/api/v1/stats',     statsRoutes);
app.use('/api/v1/alerts',    alertRoutes);
app.use('/api/v1/webhooks',  webhookRoutes);
app.use('/api/v1/scam',      scamRoutes);
app.use('/api/v1/whales',    whaleRoutes);
app.use('/api/v1/wallet',    walletRoutes);
app.use('/api/v1/verify',    verifyRoutes);
app.use('/api/v1/disputes',  disputeRoutes);
app.use('/api/v1/api-keys',  apiKeyRoutes);
app.use('/api/v1/admin',     adminRoutes);
app.use('/api/v1/claim',     claimRoutes);
app.use('/api/v1/airdrop',   airdropRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, () => {
  console.info(`[api] DappScore API listening on port ${PORT}`);
});

export default app;
