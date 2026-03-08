/**
 * Alerts — fully Firestore-backed.
 *
 * Collections:
 *   user_alerts/{userId}/alerts/{alertId}
 *   alert_preferences/{userId}
 */

import { Router } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireUserId } from '../lib/auth';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const prefsSchema = z.object({
  enableEmail:          z.boolean().optional(),
  enableTelegram:       z.boolean().optional(),
  enableWebhook:        z.boolean().optional(),
  enablePush:           z.boolean().optional(),
  trustChangeAlerts:    z.boolean().optional(),
  scamFlagAlerts:       z.boolean().optional(),
  whaleActivityAlerts:  z.boolean().optional(),
  voteThresholdAlerts:  z.boolean().optional(),
  marketAlerts:         z.boolean().optional(),
  minSeverity:          z.enum(['low', 'medium', 'high', 'critical']).optional(),
  telegramChatId:       z.string().optional(),
  webhookUrl:           z.string().url().optional(),
  emailAddress:         z.string().email().optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/v1/alerts */
router.get('/', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const { unreadOnly, type, limit = '20', offset = '0' } = req.query;

    let query = getFirestore()
      .collection('user_alerts').doc(userId)
      .collection('alerts')
      .orderBy('createdAt', 'desc')
      .limit(Math.min(parseInt(limit as string) || 20, 100))
      .offset(parseInt(offset as string) || 0);

    if (unreadOnly === 'true')      query = query.where('read', '==', false);
    if (typeof type === 'string')  query = query.where('type', '==', type);

    const snap = await query.get();
    const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Total count (unfiltered)
    const totalSnap = await getFirestore()
      .collection('user_alerts').doc(userId)
      .collection('alerts').count().get();

    res.json({
      success: true,
      data: {
        alerts,
        total: totalSnap.data().count,
        hasMore: snap.size === parseInt(limit as string),
      },
    });
  } catch (err) {
    console.error('[alerts] GET /', err);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts.' });
  }
});

/** GET /api/v1/alerts/unread-count */
router.get('/unread-count', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const snap = await getFirestore()
      .collection('user_alerts').doc(userId)
      .collection('alerts')
      .where('read', '==', false)
      .count().get();

    res.json({ success: true, data: { count: snap.data().count } });
  } catch (err) {
    console.error('[alerts] unread-count', err);
    res.status(500).json({ success: false, error: 'Failed to get unread count.' });
  }
});

/** GET /api/v1/alerts/preferences */
router.get('/preferences', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const snap = await getFirestore().collection('alert_preferences').doc(userId).get();

    const defaults = {
      enableEmail: false, enableTelegram: false,
      enableWebhook: false, enablePush: false,
      trustChangeAlerts: true, scamFlagAlerts: true,
      whaleActivityAlerts: true, voteThresholdAlerts: false,
      marketAlerts: false, minSeverity: 'low',
    };

    res.json({
      success: true,
      data: snap.exists ? { ...defaults, ...snap.data(), userId } : { ...defaults, userId },
    });
  } catch (err) {
    console.error('[alerts] GET preferences', err);
    res.status(500).json({ success: false, error: 'Failed to get preferences.' });
  }
});

/** PUT /api/v1/alerts/preferences */
router.put('/preferences', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = prefsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, error: 'Invalid fields.', details: parsed.error.flatten() });
  }

  try {
    await getFirestore()
      .collection('alert_preferences').doc(userId)
      .set({ ...parsed.data, userId, updatedAt: Timestamp.now() }, { merge: true });

    res.json({ success: true, message: 'Preferences updated.' });
  } catch (err) {
    console.error('[alerts] PUT preferences', err);
    res.status(500).json({ success: false, error: 'Failed to update preferences.' });
  }
});

/** POST /api/v1/alerts/:alertId/read */
router.post('/:alertId/read', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const ref = getFirestore()
      .collection('user_alerts').doc(userId)
      .collection('alerts').doc(req.params.alertId);

    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Alert not found.' });

    await ref.update({ read: true, readAt: Timestamp.now() });
    res.json({ success: true, message: 'Marked as read.' });
  } catch (err) {
    console.error('[alerts] POST /:id/read', err);
    res.status(500).json({ success: false, error: 'Failed to mark as read.' });
  }
});

/** POST /api/v1/alerts/read-all */
router.post('/read-all', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const snap = await getFirestore()
      .collection('user_alerts').doc(userId)
      .collection('alerts')
      .where('read', '==', false)
      .get();

    const batch = getFirestore().batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true, readAt: Timestamp.now() }));
    await batch.commit();

    res.json({ success: true, data: { count: snap.size }, message: `Marked ${snap.size} alerts as read.` });
  } catch (err) {
    console.error('[alerts] POST /read-all', err);
    res.status(500).json({ success: false, error: 'Failed to mark all as read.' });
  }
});

/** DELETE /api/v1/alerts/:alertId */
router.delete('/:alertId', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const ref = getFirestore()
      .collection('user_alerts').doc(userId)
      .collection('alerts').doc(req.params.alertId);

    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Alert not found.' });

    await ref.delete();
    res.json({ success: true, message: 'Alert deleted.' });
  } catch (err) {
    console.error('[alerts] DELETE /:id', err);
    res.status(500).json({ success: false, error: 'Failed to delete alert.' });
  }
});

/** DELETE /api/v1/alerts — clear all alerts for user */
router.delete('/', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const snap = await getFirestore()
      .collection('user_alerts').doc(userId)
      .collection('alerts').get();

    const batch = getFirestore().batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    res.json({ success: true, data: { deleted: snap.size } });
  } catch (err) {
    console.error('[alerts] DELETE /', err);
    res.status(500).json({ success: false, error: 'Failed to clear alerts.' });
  }
});

/**
 * Internal helper — called by other functions/scheduler to push an alert to a user.
 * Not exposed as an HTTP route.
 */
export async function pushAlert(
  userId: string,
  alert: {
    type: string;
    title: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    data?: Record<string, unknown>;
  },
): Promise<string> {
  const ref = getFirestore()
    .collection('user_alerts').doc(userId)
    .collection('alerts').doc();

  await ref.set({
    ...alert,
    read: false,
    createdAt: Timestamp.now(),
  });

  return ref.id;
}

export default router;
