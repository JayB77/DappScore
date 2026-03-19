/**
 * Webhooks — PostgreSQL-backed.
 *
 * Tables:
 *   webhooks      (replaces Firestore webhooks/{webhookId})
 *   webhook_logs  (replaces Firestore webhooks/{webhookId}/logs/{logId})
 */

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../lib/db';
import { requireUserId } from '../lib/auth';
import { notifyUsersForEvent } from '../lib/notify';

const router = Router();

const EVENTS = [
  'all',
  'project.trust_changed', 'project.scam_flagged', 'project.created',
  'vote.cast', 'whale.activity', 'alert.triggered',
  'market.resolved', 'bounty.completed',
] as const;

const registerSchema = z.object({
  url:    z.string().url(),
  events: z.array(z.enum(EVENTS)).default(['all']),
});

const updateSchema = z.object({
  url:    z.string().url().optional(),
  events: z.array(z.enum(EVENTS)).optional(),
  active: z.boolean().optional(),
});

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/v1/webhooks */
router.get('/', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const { rows } = await db.query(
      `SELECT id, user_id, url, events, active, failure_count,
              created_at, updated_at, last_triggered
       FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );

    res.json({ success: true, data: { webhooks: rows } });
  } catch (err) {
    console.error('[webhooks] GET /', err);
    res.status(500).json({ success: false, error: 'Failed to list webhooks.' });
  }
});

/** POST /api/v1/webhooks/register */
router.post('/register', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, error: 'Invalid fields.', details: parsed.error.flatten() });
  }

  try {
    const { rows: countRows } = await db.query<{ count: string }>(
      'SELECT COUNT(*) FROM webhooks WHERE user_id = $1',
      [userId],
    );

    if (parseInt(countRows[0].count, 10) >= 5) {
      return res.status(400).json({ success: false, error: 'Maximum 5 webhooks per user.' });
    }

    const secret = generateSecret();
    const eventsArray = `{${parsed.data.events.join(',')}}`;

    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO webhooks (user_id, url, events, secret, active, failure_count, created_at)
       VALUES ($1, $2, $3::text[], $4, TRUE, 0, NOW())
       RETURNING id`,
      [userId, parsed.data.url, eventsArray, secret],
    );

    res.json({
      success: true,
      data: {
        id:      rows[0].id,
        url:     parsed.data.url,
        events:  parsed.data.events,
        secret,
        message: 'Webhook registered. Store the secret — it will not be shown again.',
      },
    });
  } catch (err) {
    console.error('[webhooks] register', err);
    res.status(500).json({ success: false, error: 'Failed to register webhook.' });
  }
});

/** PUT /api/v1/webhooks/:id */
router.put('/:id', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, error: 'Invalid fields.', details: parsed.error.flatten() });
  }

  try {
    const { rows } = await db.query<{ user_id: string }>(
      'SELECT user_id FROM webhooks WHERE id = $1',
      [req.params.id],
    );

    if (rows.length === 0 || rows[0].user_id !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found.' });
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [req.params.id];

    if (parsed.data.url !== undefined) {
      params.push(parsed.data.url);
      updates.push(`url = $${params.length}`);
    }
    if (parsed.data.events !== undefined) {
      params.push(`{${parsed.data.events.join(',')}}`);
      updates.push(`events = $${params.length}::text[]`);
    }
    if (parsed.data.active !== undefined) {
      params.push(parsed.data.active);
      updates.push(`active = $${params.length}`);
    }

    await db.query(
      `UPDATE webhooks SET ${updates.join(', ')} WHERE id = $1`,
      params,
    );

    res.json({ success: true, message: 'Webhook updated.' });
  } catch (err) {
    console.error('[webhooks] PUT /:id', err);
    res.status(500).json({ success: false, error: 'Failed to update webhook.' });
  }
});

/** DELETE /api/v1/webhooks/:id */
router.delete('/:id', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const { rows } = await db.query<{ user_id: string }>(
      'SELECT user_id FROM webhooks WHERE id = $1',
      [req.params.id],
    );

    if (rows.length === 0 || rows[0].user_id !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found.' });
    }

    await db.query('DELETE FROM webhooks WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Webhook deleted.' });
  } catch (err) {
    console.error('[webhooks] DELETE /:id', err);
    res.status(500).json({ success: false, error: 'Failed to delete webhook.' });
  }
});

/** POST /api/v1/webhooks/:id/test */
router.post('/:id/test', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const { rows } = await db.query<{ user_id: string; url: string; secret: string }>(
      'SELECT user_id, url, secret FROM webhooks WHERE id = $1',
      [req.params.id],
    );

    if (rows.length === 0 || rows[0].user_id !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found.' });
    }

    const { url, secret } = rows[0];
    const payload = {
      event:     'webhook.test',
      timestamp: new Date().toISOString(),
      data:      { message: 'Test from DappScore', webhookId: req.params.id },
    };

    const body      = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    const httpRes = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':             'application/json',
        'X-DappScore-Signature':    `sha256=${signature}`,
        'X-DappScore-Webhook-Id':   req.params.id,
        'X-DappScore-Event':        'webhook.test',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    await db.query(
      `UPDATE webhooks
       SET last_triggered = NOW(),
           failure_count  = CASE WHEN $1 THEN 0 ELSE failure_count + 1 END
       WHERE id = $2`,
      [httpRes.ok, req.params.id],
    );

    res.json({
      success: httpRes.ok,
      data:    { statusCode: httpRes.status },
      message: httpRes.ok ? 'Test delivered.' : 'Endpoint returned an error.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhooks] test', err);
    res.status(500).json({ success: false, error: `Delivery failed: ${msg}` });
  }
});

/** GET /api/v1/webhooks/:id/logs */
router.get('/:id/logs', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const { rows: wh } = await db.query<{ user_id: string }>(
      'SELECT user_id FROM webhooks WHERE id = $1',
      [req.params.id],
    );

    if (wh.length === 0 || wh[0].user_id !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found.' });
    }

    const { rows } = await db.query(
      `SELECT id, event, status, ok, timestamp
       FROM webhook_logs WHERE webhook_id = $1
       ORDER BY timestamp DESC LIMIT 50`,
      [req.params.id],
    );

    res.json({ success: true, data: { logs: rows } });
  } catch (err) {
    console.error('[webhooks] GET /:id/logs', err);
    res.status(500).json({ success: false, error: 'Failed to get logs.' });
  }
});

/** POST /api/v1/webhooks/:id/rotate-secret */
router.post('/:id/rotate-secret', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const { rows } = await db.query<{ user_id: string }>(
      'SELECT user_id FROM webhooks WHERE id = $1',
      [req.params.id],
    );

    if (rows.length === 0 || rows[0].user_id !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found.' });
    }

    const secret = generateSecret();
    await db.query(
      'UPDATE webhooks SET secret = $1, updated_at = NOW() WHERE id = $2',
      [secret, req.params.id],
    );

    res.json({
      success: true,
      data:    { secret },
      message: 'Secret rotated. Update your webhook verification.',
    });
  } catch (err) {
    console.error('[webhooks] rotate-secret', err);
    res.status(500).json({ success: false, error: 'Failed to rotate secret.' });
  }
});

// ── Incoming webhook handlers ─────────────────────────────────────────────────

/** POST /api/v1/webhooks/incoming/graph — The Graph / Notifi event push */
router.post('/incoming/graph', async (req, res) => {
  try {
    const secret = process.env.SUBGRAPH_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers['x-webhook-secret'] as string | undefined;
      if (provided !== secret) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
    }

    const body      = req.body as Record<string, unknown>;
    const eventType = (body.event as string) || '';

    console.info('[webhooks] incoming/graph', { event: eventType });

    const eventMap: Record<string, string> = {
      'ProjectSubmitted':         'project.created',
      'ProjectStatusChanged':     'project.trust_changed',
      'ProjectTrustLevelChanged': 'project.trust_changed',
      'ProjectMarkedScam':        'project.scam_flagged',
      'ProjectFlagged':           'project.scam_flagged',
      'MarketResolved':           'market.resolved',
      'BountyCompleted':          'bounty.completed',
      'Voted':                    'vote.cast',
    };

    const dispatchEvent = eventMap[eventType];
    const data = body.data as Record<string, unknown> | undefined;

    if (dispatchEvent && data) {
      await dispatchGlobalWebhook(dispatchEvent, data);
      await notifyUsersForEvent(dispatchEvent, data);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[webhooks] incoming/graph', err);
    res.status(500).json({ success: false });
  }
});

/** POST /api/v1/webhooks/incoming/alchemy — Alchemy address activity (whale tracking) */
router.post('/incoming/alchemy', async (req, res) => {
  try {
    const signingKey = process.env.ALCHEMY_SIGNING_KEY;
    if (signingKey) {
      const signature = req.headers['x-alchemy-signature'] as string | undefined;
      const rawBody   = JSON.stringify(req.body);
      const expected  = crypto.createHmac('sha256', signingKey).update(rawBody).digest('hex');
      if (signature !== expected) {
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }
    }

    const payload = req.body as {
      type?: string;
      event?: {
        network?: string;
        activity?: Array<{
          fromAddress?: string; toAddress?: string;
          value?: number; asset?: string; hash?: string;
        }>;
      };
    };

    if (payload.type !== 'ADDRESS_ACTIVITY' || !payload.event?.activity) {
      return res.json({ success: true });
    }

    const WHALE_THRESHOLD = 100_000;

    for (const activity of payload.event.activity) {
      const value = activity.value ?? 0;
      if (value < WHALE_THRESHOLD) continue;

      const whaleData = {
        fromAddress: activity.fromAddress,
        toAddress:   activity.toAddress,
        value,
        asset:       activity.asset,
        txHash:      activity.hash,
        network:     payload.event.network,
        timestamp:   new Date().toISOString(),
      };

      console.info('[webhooks] whale activity detected', whaleData);
      await dispatchGlobalWebhook('whale.activity', whaleData);
      await notifyUsersForEvent('whale.activity', whaleData);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[webhooks] incoming/alchemy', err);
    res.status(500).json({ success: false });
  }
});

// ── Internal delivery helpers ─────────────────────────────────────────────────

async function deliverWebhook(
  webhookId: string,
  url: string,
  secret: string,
  event: string,
  data: unknown,
): Promise<void> {
  const payload = { event, timestamp: new Date().toISOString(), data };
  const body    = JSON.stringify(payload);
  const sig     = crypto.createHmac('sha256', secret).update(body).digest('hex');

  let status = 0;
  let ok     = false;

  try {
    const httpRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':           'application/json',
        'X-DappScore-Signature':  `sha256=${sig}`,
        'X-DappScore-Event':      event,
        'X-DappScore-Webhook-Id': webhookId,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    status = httpRes.status;
    ok     = httpRes.ok;
  } catch { /* network failure */ }

  // Write delivery log + update stats in a single round-trip
  await db.query(
    `WITH log_insert AS (
       INSERT INTO webhook_logs (webhook_id, event, status, ok, timestamp)
       VALUES ($1, $2, $3, $4, NOW())
     )
     UPDATE webhooks
     SET last_triggered = NOW(),
         failure_count  = CASE WHEN $4 THEN 0 ELSE failure_count + 1 END
     WHERE id = $1`,
    [webhookId, event, status, ok],
  );

  // Disable after 10 consecutive failures
  if (!ok) {
    await db.query(
      `UPDATE webhooks SET active = FALSE
       WHERE id = $1 AND failure_count >= 10`,
      [webhookId],
    );
  }
}

/**
 * Fan out an event to all active registered webhooks for a given userId.
 */
export async function dispatchWebhook(
  userId: string,
  event: string,
  data: unknown,
): Promise<void> {
  const { rows } = await db.query<{ id: string; url: string; secret: string; events: string[] }>(
    `SELECT id, url, secret, events
     FROM webhooks WHERE user_id = $1 AND active = TRUE`,
    [userId],
  );

  await Promise.allSettled(
    rows
      .filter(wh => wh.events.includes('all') || wh.events.includes(event))
      .map(wh => deliverWebhook(wh.id, wh.url, wh.secret, event, data)),
  );
}

/**
 * Fan out an event to ALL active webhooks subscribed to the event (platform-wide).
 */
export async function dispatchGlobalWebhook(
  event: string,
  data: unknown,
): Promise<void> {
  const { rows } = await db.query<{ id: string; url: string; secret: string; events: string[] }>(
    `SELECT id, url, secret, events FROM webhooks WHERE active = TRUE`,
  );

  await Promise.allSettled(
    rows
      .filter(wh => wh.events.includes('all') || wh.events.includes(event))
      .map(wh => deliverWebhook(wh.id, wh.url, wh.secret, event, data)),
  );
}

export default router;
