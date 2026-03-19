import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cron from 'node-cron';

import { projectRoutes } from './routes/projects';
import { userRoutes } from './routes/users';
import { statsRoutes } from './routes/stats';
import { alertRoutes } from './routes/alerts';
import { shareRoutes } from './routes/share';
import { scamDetectionRoutes } from './routes/scam-detection';
import whaleRoutes from './routes/whales';
import { webhookRoutes } from './routes/webhooks';
import apiKeyRoutes from './routes/api-keys';

import whaleTrackingService from './services/whale-tracking';
import { runAndAlert } from './services/event-monitor';
import { logger } from './services/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
  logger.info('Hourly scam pattern + event monitor sweep ready');
  // TODO: load watched contract addresses from DB, then:
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

app.listen(PORT, () => {
  logger.info(`DappScore Backend running on port ${PORT}`);
});

export default app;
