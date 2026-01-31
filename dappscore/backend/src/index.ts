import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cron from 'node-cron';

import projectRoutes from './routes/projects';
import userRoutes from './routes/users';
import statsRoutes from './routes/stats';
import { alertRoutes } from './routes/alerts';
import shareRoutes from './routes/share';
import { scamDetectionRoutes } from './routes/scam-detection';
import whaleRoutes from './routes/whales';
import { webhookRoutes } from './routes/webhooks';

import scamPatternService from './services/scam-patterns';
import whaleTrackingService from './services/whale-tracking';
import { alertService } from './services/alerts';
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
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/scam-detection', scamDetectionRoutes);
app.use('/api/whales', whaleRoutes);
app.use('/api/webhooks', webhookRoutes);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Cron jobs
// Check for scam patterns every hour
cron.schedule('0 * * * *', async () => {
  logger.info('Running scam pattern detection...');
  // Scam pattern service runs on-demand via API
});

// Update whale wallets daily
cron.schedule('0 0 * * *', async () => {
  logger.info('Updating whale wallet data...');
  // Whale tracking service runs on-demand via API
});

// Process pending alerts every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  await alertService.processPendingAlerts();
});

app.listen(PORT, () => {
  logger.info(`DappScore Backend running on port ${PORT}`);
});

export default app;
