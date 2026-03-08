/**
 * Webhooks — Firestore-backed (replaces in-memory Map from the Express backend).
 *
 * Collections:
 *   webhooks/{webhookId}
 *   webhooks/{webhookId}/logs/{logId}
 */

import { Router } from 'express';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import crypto from 'crypto';
import { requireUserId } from '../lib/auth';

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
    const snap = await getFirestore()
      .collection('webhooks')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const webhooks = snap.docs.map(d => {
      const { secret: _s, ...safe } = d.data() as Record<string, unknown>;
      return { id: d.id, ...safe };
    });

    res.json({ success: true, data: { webhooks } });
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
    // Max 5 per user
    const existing = await getFirestore()
      .collection('webhooks').where('userId', '==', userId).count().get();

    if (existing.data().count >= 5) {
      return res.status(400).json({ success: false, error: 'Maximum 5 webhooks per user.' });
    }

    const secret = generateSecret();
    const ref = getFirestore().collection('webhooks').doc();

    await ref.set({
      userId,
      url: parsed.data.url,
      events: parsed.data.events,
      secret,
      active: true,
      failureCount: 0,
      createdAt: Timestamp.now(),
      lastTriggered: null,
    });

    res.json({
      success: true,
      data: {
        id: ref.id,
        url: parsed.data.url,
        events: parsed.data.events,
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
    const ref  = getFirestore().collection('webhooks').doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists || (snap.data() as Record<string, unknown>).userId !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found.' });
    }

    await ref.update({ ...parsed.data, updatedAt: Timestamp.now() });
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
    const ref  = getFirestore().collection('webhooks').doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists || (snap.data() as Record<string, unknown>).userId !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found.' });
    }

    await ref.delete();
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
    const ref  = getFirestore().collection('webhooks').doc(req.params.id);
    const snap = await ref.get();
    const data = snap.data() as Record<string, unknown> | undefined;

    if (!snap.exists || data?.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found.' });
    }

    const payload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'Test from DappScore', webhookId: req.params.id },
    };

    const body      = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', data.secret as string).update(body).digest('hex');

    const httpRes = await fetch(data.url as string, {
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

    await ref.update({
      lastTriggered: Timestamp.now(),
      failureCount: httpRes.ok ? 0 : FieldValue.increment(1),
    });

    res.json({
      success: httpRes.ok,
      data: { statusCode: httpRes.status },
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
    const ref  = getFirestore().collection('webhooks').doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists || (snap.data() as Record<string, unknown>).userId !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found.' });
    }

    const logs = await ref.collection('logs')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    res.json({ success: true, data: { logs: logs.docs.map(d => ({ id: d.id, ...d.data() })) } });
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
    const ref  = getFirestore().collection('webhooks').doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists || (snap.data() as Record<string, unknown>).userId !== userId) {
      return res.status(404).json({ success: false, error: 'Webhook not found.' });
    }

    const secret = generateSecret();
    await ref.update({ secret, updatedAt: Timestamp.now() });

    res.json({
      success: true,
      data: { secret },
      message: 'Secret rotated. Update your webhook verification.',
    });
  } catch (err) {
    console.error('[webhooks] rotate-secret', err);
    res.status(500).json({ success: false, error: 'Failed to rotate secret.' });
  }
});

// ── Incoming webhook handlers ─────────────────────────────────────────────────

/** POST /api/v1/webhooks/incoming/graph — The Graph event push */
router.post('/incoming/graph', async (req, res) => {
  try {
    console.info('[webhooks] incoming/graph', { event: req.body?.event });
    // TODO: verify Hasura/Graph webhook secret header, then dispatch alerts
    res.json({ success: true });
  } catch (err) {
    console.error('[webhooks] incoming/graph', err);
    res.status(500).json({ success: false });
  }
});

/** POST /api/v1/webhooks/incoming/alchemy — Alchemy address activity */
router.post('/incoming/alchemy', async (req, res) => {
  try {
    console.info('[webhooks] incoming/alchemy', { event: req.body?.event });
    // TODO: process address activity notifications for whale tracking
    res.json({ success: true });
  } catch (err) {
    console.error('[webhooks] incoming/alchemy', err);
    res.status(500).json({ success: false });
  }
});

// ── Internal send helper ──────────────────────────────────────────────────────

/**
 * Fan out an event to all active registered webhooks for a given userId.
 * Called internally from other route handlers.
 */
export async function dispatchWebhook(
  userId: string,
  event: string,
  data: unknown,
): Promise<void> {
  const snap = await getFirestore()
    .collection('webhooks')
    .where('userId', '==', userId)
    .where('active', '==', true)
    .get();

  await Promise.allSettled(snap.docs.map(async doc => {
    const wh = doc.data() as Record<string, unknown>;
    if (!Array.isArray(wh.events)) return;
    const events = wh.events as string[];
    if (!events.includes('all') && !events.includes(event)) return;

    const payload = { event, timestamp: new Date().toISOString(), data };
    const body    = JSON.stringify(payload);
    const sig     = crypto.createHmac('sha256', wh.secret as string).update(body).digest('hex');

    let status = 0;
    let ok     = false;

    try {
      const httpRes = await fetch(wh.url as string, {
        method: 'POST',
        headers: {
          'Content-Type':           'application/json',
          'X-DappScore-Signature':  `sha256=${sig}`,
          'X-DappScore-Event':      event,
          'X-DappScore-Webhook-Id': doc.id,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      status = httpRes.status;
      ok     = httpRes.ok;
    } catch { /* network failure */ }

    // Write delivery log
    const ref = doc.ref;
    await ref.collection('logs').add({ event, status, ok, timestamp: Timestamp.now() });
    await ref.update({
      lastTriggered: Timestamp.now(),
      failureCount: ok ? 0 : FieldValue.increment(1),
      // Disable after 10 consecutive failures
      ...(ok ? {} : {}),
    });

    if (!ok) {
      // Re-read to check failureCount and possibly disable
      const updated = await ref.get();
      if ((updated.data()?.failureCount as number) >= 10) {
        await ref.update({ active: false });
      }
    }
  }));
}

export default router;
