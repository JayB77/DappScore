import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import saleRoutes     from './routes/sale';
import projectRoutes  from './routes/projects';
import userRoutes     from './routes/users';
import statsRoutes    from './routes/stats';
import alertRoutes    from './routes/alerts';
import webhookRoutes  from './routes/webhooks';
import scamRoutes     from './routes/scam';
import whaleRoutes    from './routes/whales';
import adminRoutes    from './routes/admin';
import airdropRoutes  from './routes/airdrop';
import claimRoutes    from './routes/claim';
import apiKeyRoutes   from './routes/api-keys';

initializeApp();

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: '256kb' }));

// ── Health (unauthenticated, used by Firebase Hosting health checks) ──────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Public / user-authenticated routes ───────────────────────────────────────
app.use('/api/v1/projects',      projectRoutes);   // GET search/detail/votes/trust-history/similar/trending
app.use('/api/v1/projects',      saleRoutes);       // GET+POST /:id/sale
app.use('/api/v1/users',         userRoutes);       // GET profile/votes/accuracy/earnings/reputation/referrals/leaderboard
app.use('/api/v1/stats',         statsRoutes);      // GET global/daily/token/insurance/predictions/bounties
app.use('/api/v1/alerts',        alertRoutes);      // GET/POST/DELETE alerts + preferences (x-user-id)
app.use('/api/v1/webhooks',      webhookRoutes);    // GET/POST/PUT/DELETE webhooks + incoming (x-user-id)
app.use('/api/v1/scam',          scamRoutes);       // POST analyze/tokenomics/batch/report  GET patterns
app.use('/api/v1/whales',        whaleRoutes);      // GET whale data + wallet labels

// ── API key management (x-user-id required) ──────────────────────────────────
app.use('/api/v1/api-keys',      apiKeyRoutes);     // POST/GET/PATCH/DELETE + rotate

// ── Admin routes (ADMIN_API_KEY required) ─────────────────────────────────────
app.use('/api/v1/admin',         adminRoutes);      // flags, overrides, sales, cache, reports, audit, health

// ── Claim routes (CLAIM_ADMIN_KEY required) ───────────────────────────────────
app.use('/api/v1/claim',         claimRoutes);      // pre-launch $SCORE claim allocation management

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ── Export as single Cloud Function ──────────────────────────────────────────
// minInstances: 1 keeps it warm; adjust based on traffic / cost tolerance.
export const api = onRequest(
  { region: 'us-central1', minInstances: 1, memory: '256MiB', timeoutSeconds: 60 },
  app,
);
