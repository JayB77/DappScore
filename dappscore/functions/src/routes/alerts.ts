/**
 * Alerts — PostgreSQL-backed.
 *
 * Tables:
 *   alerts            (replaces user_alerts/{userId}/alerts/{alertId})
 *   alert_preferences (replaces alert_preferences/{userId})
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
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
    const { unreadOnly, type } = req.query;
    const limit  = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const conditions: string[] = ['user_id = $1'];
    const params: unknown[]    = [userId];

    if (unreadOnly === 'true') {
      conditions.push(`read = FALSE`);
    }
    if (typeof type === 'string') {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }

    const where = conditions.join(' AND ');

    const [alertsRes, countRes] = await Promise.all([
      db.query(
        `SELECT id, user_id, type, title, message, severity, data, read, created_at, read_at
         FROM alerts
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) FROM alerts WHERE user_id = $1`,
        [userId],
      ),
    ]);

    res.json({
      success: true,
      data: {
        alerts:  alertsRes.rows,
        total:   parseInt(countRes.rows[0].count, 10),
        hasMore: alertsRes.rows.length === limit,
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
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*) FROM alerts WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );

    res.json({ success: true, data: { count: parseInt(rows[0].count, 10) } });
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
    const { rows } = await db.query(
      `SELECT enable_email, enable_telegram, enable_webhook, enable_push,
              trust_change_alerts, scam_flag_alerts, whale_activity_alerts,
              vote_threshold_alerts, market_alerts, min_severity,
              telegram_chat_id, webhook_url, email_address
       FROM alert_preferences
       WHERE user_id = $1`,
      [userId],
    );

    const defaults = {
      enableEmail: false, enableTelegram: false,
      enableWebhook: false, enablePush: false,
      trustChangeAlerts: true, scamFlagAlerts: true,
      whaleActivityAlerts: true, voteThresholdAlerts: false,
      marketAlerts: false, minSeverity: 'low',
    };

    if (rows.length === 0) {
      return res.json({ success: true, data: { ...defaults, userId } });
    }

    const row = rows[0];
    res.json({
      success: true,
      data: {
        userId,
        enableEmail:          row.enable_email,
        enableTelegram:       row.enable_telegram,
        enableWebhook:        row.enable_webhook,
        enablePush:           row.enable_push,
        trustChangeAlerts:    row.trust_change_alerts,
        scamFlagAlerts:       row.scam_flag_alerts,
        whaleActivityAlerts:  row.whale_activity_alerts,
        voteThresholdAlerts:  row.vote_threshold_alerts,
        marketAlerts:         row.market_alerts,
        minSeverity:          row.min_severity,
        telegramChatId:       row.telegram_chat_id ?? undefined,
        webhookUrl:           row.webhook_url ?? undefined,
        emailAddress:         row.email_address ?? undefined,
      },
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

  const d = parsed.data;

  try {
    await db.query(
      `INSERT INTO alert_preferences
         (user_id, enable_email, enable_telegram, enable_webhook, enable_push,
          trust_change_alerts, scam_flag_alerts, whale_activity_alerts,
          vote_threshold_alerts, market_alerts, min_severity,
          telegram_chat_id, webhook_url, email_address, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         enable_email          = COALESCE($2, alert_preferences.enable_email),
         enable_telegram       = COALESCE($3, alert_preferences.enable_telegram),
         enable_webhook        = COALESCE($4, alert_preferences.enable_webhook),
         enable_push           = COALESCE($5, alert_preferences.enable_push),
         trust_change_alerts   = COALESCE($6, alert_preferences.trust_change_alerts),
         scam_flag_alerts      = COALESCE($7, alert_preferences.scam_flag_alerts),
         whale_activity_alerts = COALESCE($8, alert_preferences.whale_activity_alerts),
         vote_threshold_alerts = COALESCE($9, alert_preferences.vote_threshold_alerts),
         market_alerts         = COALESCE($10, alert_preferences.market_alerts),
         min_severity          = COALESCE($11, alert_preferences.min_severity),
         telegram_chat_id      = COALESCE($12, alert_preferences.telegram_chat_id),
         webhook_url           = COALESCE($13, alert_preferences.webhook_url),
         email_address         = COALESCE($14, alert_preferences.email_address),
         updated_at            = NOW()`,
      [
        userId,
        d.enableEmail ?? null, d.enableTelegram ?? null,
        d.enableWebhook ?? null, d.enablePush ?? null,
        d.trustChangeAlerts ?? null, d.scamFlagAlerts ?? null,
        d.whaleActivityAlerts ?? null, d.voteThresholdAlerts ?? null,
        d.marketAlerts ?? null, d.minSeverity ?? null,
        d.telegramChatId ?? null, d.webhookUrl ?? null,
        d.emailAddress ?? null,
      ],
    );

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
    const { rowCount } = await db.query(
      `UPDATE alerts SET read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND read = FALSE`,
      [req.params.alertId, userId],
    );

    if (rowCount === 0) {
      // Check if it exists at all
      const { rows } = await db.query(
        'SELECT id FROM alerts WHERE id = $1 AND user_id = $2',
        [req.params.alertId, userId],
      );
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Alert not found.' });
      }
    }

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
    const { rowCount } = await db.query(
      `UPDATE alerts SET read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );

    res.json({
      success: true,
      data: { count: rowCount },
      message: `Marked ${rowCount} alerts as read.`,
    });
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
    const { rowCount } = await db.query(
      'DELETE FROM alerts WHERE id = $1 AND user_id = $2',
      [req.params.alertId, userId],
    );

    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Alert not found.' });
    }

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
    const { rowCount } = await db.query(
      'DELETE FROM alerts WHERE user_id = $1',
      [userId],
    );

    res.json({ success: true, data: { deleted: rowCount } });
  } catch (err) {
    console.error('[alerts] DELETE /', err);
    res.status(500).json({ success: false, error: 'Failed to clear alerts.' });
  }
});

/**
 * Internal helper — called by other modules to push an alert to a user.
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
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO alerts (user_id, type, title, message, severity, data, read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, FALSE, NOW())
     RETURNING id`,
    [userId, alert.type, alert.title, alert.message, alert.severity,
     alert.data ? JSON.stringify(alert.data) : null],
  );

  return rows[0].id;
}

export default router;
