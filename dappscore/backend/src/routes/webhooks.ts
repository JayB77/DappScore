/**
 * Webhooks API Routes
 *
 * Handles incoming webhooks from external services and allows
 * users to register their own webhook endpoints.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../services/logger';

const router = Router();

// Types
interface WebhookConfig {
  id: string;
  userId: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  failureCount: number;
}

// In-memory storage (use database in production)
const webhooks: Map<string, WebhookConfig> = new Map();
const webhookLogs: Map<string, any[]> = new Map();

/**
 * Verify webhook signature
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSig}`)
  );
}

/**
 * Generate webhook secret
 */
function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/webhooks/register
 * Register a new webhook endpoint
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const { url, events } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    // Check user webhook limit (max 5 per user)
    const userWebhooks = Array.from(webhooks.values()).filter(w => w.userId === userId);
    if (userWebhooks.length >= 5) {
      return res.status(400).json({ success: false, error: 'Maximum 5 webhooks per user' });
    }

    const id = `wh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const secret = generateSecret();

    const config: WebhookConfig = {
      id,
      userId,
      url,
      secret,
      events: events || ['all'],
      active: true,
      createdAt: new Date(),
      failureCount: 0,
    };

    webhooks.set(id, config);

    logger.info(`Webhook registered: ${id} for user ${userId}`);

    res.json({
      success: true,
      data: {
        id,
        url,
        secret,
        events: config.events,
        message: 'Webhook registered. Use the secret to verify incoming requests.',
      },
    });
  } catch (error: any) {
    console.error('[Webhooks API] Register error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to register webhook',
    });
  }
});

/**
 * GET /api/webhooks
 * List user's webhooks
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const userWebhooks = Array.from(webhooks.values())
      .filter(w => w.userId === userId)
      .map(w => ({
        id: w.id,
        url: w.url,
        events: w.events,
        active: w.active,
        createdAt: w.createdAt,
        lastTriggered: w.lastTriggered,
        failureCount: w.failureCount,
      }));

    res.json({
      success: true,
      data: { webhooks: userWebhooks },
    });
  } catch (error: any) {
    console.error('[Webhooks API] List error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list webhooks',
    });
  }
});

/**
 * PUT /api/webhooks/:id
 * Update webhook configuration
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const { id } = req.params;
    const webhook = webhooks.get(id);

    if (!webhook || webhook.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    const { url, events, active } = req.body;

    if (url) {
      try {
        new URL(url);
        webhook.url = url;
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid URL' });
      }
    }

    if (events) webhook.events = events;
    if (typeof active === 'boolean') webhook.active = active;

    res.json({
      success: true,
      message: 'Webhook updated',
    });
  } catch (error: any) {
    console.error('[Webhooks API] Update error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update webhook',
    });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const { id } = req.params;
    const webhook = webhooks.get(id);

    if (!webhook || webhook.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    webhooks.delete(id);

    res.json({
      success: true,
      message: 'Webhook deleted',
    });
  } catch (error: any) {
    console.error('[Webhooks API] Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete webhook',
    });
  }
});

/**
 * POST /api/webhooks/:id/test
 * Test a webhook
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const { id } = req.params;
    const webhook = webhooks.get(id);

    if (!webhook || webhook.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from DappScore',
        webhookId: id,
      },
    };

    const payloadStr = JSON.stringify(testPayload);
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(payloadStr)
      .digest('hex');

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DappScore-Signature': `sha256=${signature}`,
          'X-DappScore-Webhook-Id': id,
        },
        body: payloadStr,
      });

      webhook.lastTriggered = new Date();

      if (response.ok) {
        webhook.failureCount = 0;
        res.json({
          success: true,
          message: 'Test webhook sent successfully',
          data: { statusCode: response.status },
        });
      } else {
        webhook.failureCount++;
        res.json({
          success: false,
          message: 'Webhook endpoint returned error',
          data: { statusCode: response.status },
        });
      }
    } catch (fetchError: any) {
      webhook.failureCount++;
      res.status(500).json({
        success: false,
        error: `Failed to reach webhook URL: ${fetchError.message}`,
      });
    }
  } catch (error: any) {
    console.error('[Webhooks API] Test error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test webhook',
    });
  }
});

/**
 * GET /api/webhooks/:id/logs
 * Get webhook delivery logs
 */
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const { id } = req.params;
    const webhook = webhooks.get(id);

    if (!webhook || webhook.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    const logs = webhookLogs.get(id) || [];

    res.json({
      success: true,
      data: { logs: logs.slice(-50) }, // Last 50 logs
    });
  } catch (error: any) {
    console.error('[Webhooks API] Logs error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get logs',
    });
  }
});

/**
 * POST /api/webhooks/:id/rotate-secret
 * Rotate webhook secret
 */
router.post('/:id/rotate-secret', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const { id } = req.params;
    const webhook = webhooks.get(id);

    if (!webhook || webhook.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    webhook.secret = generateSecret();

    res.json({
      success: true,
      data: {
        secret: webhook.secret,
        message: 'Secret rotated. Update your webhook verification.',
      },
    });
  } catch (error: any) {
    console.error('[Webhooks API] Rotate error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to rotate secret',
    });
  }
});

/**
 * Incoming webhook handlers for external services
 */

/**
 * POST /api/webhooks/incoming/graph
 * Handle The Graph webhooks
 */
router.post('/incoming/graph', async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;

    logger.info('Received Graph webhook:', { event });

    // Process graph events (new projects, votes, etc.)
    switch (event) {
      case 'ProjectCreated':
        // Handle new project
        break;
      case 'VoteCast':
        // Handle new vote
        break;
      case 'TrustLevelUpdated':
        // Handle trust level change
        break;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Webhooks API] Graph webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/webhooks/incoming/alchemy
 * Handle Alchemy webhooks (for whale tracking)
 */
router.post('/incoming/alchemy', async (req: Request, res: Response) => {
  try {
    const { webhookId, event, data } = req.body;

    logger.info('Received Alchemy webhook:', { event });

    // Process Alchemy address activity notifications
    // Used for whale wallet tracking

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Webhooks API] Alchemy webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Utility function to send webhook to registered endpoints
 */
export async function sendWebhook(event: string, data: any): Promise<void> {
  const activeWebhooks = Array.from(webhooks.values()).filter(
    w => w.active && (w.events.includes('all') || w.events.includes(event))
  );

  for (const webhook of activeWebhooks) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const payloadStr = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(payloadStr)
      .digest('hex');

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DappScore-Signature': `sha256=${signature}`,
          'X-DappScore-Webhook-Id': webhook.id,
          'X-DappScore-Event': event,
        },
        body: payloadStr,
      });

      webhook.lastTriggered = new Date();

      // Log delivery
      const logs = webhookLogs.get(webhook.id) || [];
      logs.push({
        event,
        status: response.status,
        timestamp: new Date(),
        success: response.ok,
      });
      webhookLogs.set(webhook.id, logs.slice(-100)); // Keep last 100

      if (!response.ok) {
        webhook.failureCount++;
        if (webhook.failureCount >= 10) {
          webhook.active = false;
          logger.warn(`Webhook ${webhook.id} disabled after 10 failures`);
        }
      } else {
        webhook.failureCount = 0;
      }
    } catch (error) {
      webhook.failureCount++;
      logger.error(`Webhook delivery failed: ${webhook.id}`, error as Error);
    }
  }
}

export const webhookRoutes = router;
export default router;
