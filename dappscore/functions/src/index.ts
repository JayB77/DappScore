import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import saleRoutes from './routes/sale';

initializeApp();

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true })); // Firebase Hosting same-origin; CORS needed for local dev
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/projects', saleRoutes);
// Add more route groups here as the API grows:
// app.use('/api/v1/risk',    riskRoutes);
// app.use('/api/v1/holders', holderRoutes);

// ── Catch-all 404 ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Exported as a single Cloud Function — minInstances keeps it warm (no cold starts)
export const api = onRequest(
  { region: 'us-central1', minInstances: 1, memory: '256MiB' },
  app,
);
