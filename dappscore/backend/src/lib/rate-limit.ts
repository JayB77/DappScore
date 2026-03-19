import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const tooManyRequests = (_req: Request, res: Response) => {
  res.status(429).json({ error: 'Too many requests. Please slow down and try again later.' });
};

/**
 * Rate limit for API key management endpoints.
 * Keyed by x-user-id (wallet address) so each user has their own bucket.
 * Falls back to IP if header is absent.
 * 30 requests per 15-minute window.
 */
export const apiKeyMgmtLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req: Request) => (req.headers['x-user-id'] as string) || req.ip || 'unknown',
  handler: tooManyRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Stricter limit for key creation / rotation — destructive actions.
 * 10 requests per 15 minutes.
 */
export const apiKeyMutateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req: Request) => (req.headers['x-user-id'] as string) || req.ip || 'unknown',
  handler: tooManyRequests,
  standardHeaders: true,
  legacyHeaders: false,
});
