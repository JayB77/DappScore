/**
 * Alert Service
 *
 * PostgreSQL-backed alert storage with immediate delivery via Telegram and
 * user-configured webhooks. No batching or queuing — each alert is persisted
 * and dispatched as soon as it is created.
 *
 * Previously alerts were queued and delivered in a 5-minute cron batch (capped
 * at 50) to limit Firebase read/write costs. That constraint no longer applies.
 */

import { logger } from './logger';
import { db } from '../lib/db';

export interface Alert {
  id: string;
  userId: string;
  type: 'trust_change' | 'scam_flag' | 'whale_activity' | 'vote_threshold' | 'premium_expiry' | 'market_resolution' | 'contract_event';
  projectId?: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface AlertPreferences {
  userId: string;
  email?: string;
  telegram?: string;
  webhook?: string;
  enableEmail: boolean;
  enableTelegram: boolean;
  enableWebhook: boolean;
  enablePush: boolean;
  trustChangeAlerts: boolean;
  scamFlagAlerts: boolean;
  whaleActivityAlerts: boolean;
  voteThresholdAlerts: boolean;
  marketAlerts: boolean;
  minSeverity: 'low' | 'medium' | 'high' | 'critical';
}

const SEVERITY_RANK: Record<Alert['severity'], number> = {
  low: 0, medium: 1, high: 2, critical: 3,
};

function rowToAlert(row: Record<string, any>): Alert {
  const data = row.data ?? {};
  return {
    id:        row.id,
    userId:    row.user_id,
    type:      row.type,
    projectId: data.projectId ?? undefined,
    title:     row.title,
    message:   row.message,
    severity:  row.severity,
    read:      row.read,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    metadata:  data.metadata ?? undefined,
  };
}

function rowToPrefs(row: Record<string, any>): AlertPreferences {
  return {
    userId:              row.user_id,
    email:               row.email_address ?? undefined,
    telegram:            row.telegram_chat_id ?? undefined,
    webhook:             row.webhook_url ?? undefined,
    enableEmail:         row.enable_email,
    enableTelegram:      row.enable_telegram,
    enableWebhook:       row.enable_webhook,
    enablePush:          row.enable_push,
    trustChangeAlerts:   row.trust_change_alerts,
    scamFlagAlerts:      row.scam_flag_alerts,
    whaleActivityAlerts: row.whale_activity_alerts,
    voteThresholdAlerts: row.vote_threshold_alerts,
    marketAlerts:        row.market_alerts,
    minSeverity:         row.min_severity,
  };
}

export class AlertService {
  /**
   * Persist an alert to PostgreSQL and immediately dispatch it through any
   * enabled delivery channels (Telegram, webhook).
   */
  async createAlert(alert: Omit<Alert, 'id' | 'read' | 'createdAt'>): Promise<Alert> {
    const data = {
      projectId: alert.projectId,
      metadata:  alert.metadata,
    };

    const { rows } = await db.query<{ id: string; created_at: Date }>(
      `INSERT INTO alerts (user_id, type, title, message, severity, data, read)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       RETURNING id, created_at`,
      [alert.userId, alert.type, alert.title, alert.message, alert.severity,
       JSON.stringify(data)],
    );

    const newAlert: Alert = {
      ...alert,
      id:        rows[0].id,
      read:      false,
      createdAt: rows[0].created_at,
    };

    logger.info(`Alert created for user ${alert.userId}`, {
      type: alert.type, severity: alert.severity,
    });

    // Deliver immediately — fire-and-forget so callers are never blocked.
    this.deliver(newAlert).catch(err =>
      logger.error('Alert delivery error', err as Error),
    );

    return newAlert;
  }

  /**
   * Deliver a single alert through all channels the user has enabled.
   * Called immediately after DB insert — no delay, no batching.
   */
  private async deliver(alert: Alert): Promise<void> {
    let prefs: AlertPreferences | null;
    try {
      prefs = await this.getPreferences(alert.userId);
    } catch {
      return; // No prefs row = user hasn't configured notifications
    }
    if (!prefs) return;

    // Severity gate
    if (SEVERITY_RANK[alert.severity] < SEVERITY_RANK[prefs.minSeverity]) return;

    // Alert type gate
    const shouldSend =
      (alert.type === 'trust_change'      && prefs.trustChangeAlerts) ||
      (alert.type === 'scam_flag'         && prefs.scamFlagAlerts) ||
      (alert.type === 'whale_activity'    && prefs.whaleActivityAlerts) ||
      (alert.type === 'vote_threshold'    && prefs.voteThresholdAlerts) ||
      (alert.type === 'market_resolution' && prefs.marketAlerts) ||
      (alert.type === 'contract_event'    && prefs.scamFlagAlerts) ||
       alert.type === 'premium_expiry';

    if (!shouldSend) return;

    const jobs: Promise<void>[] = [];
    if (prefs.enableTelegram && prefs.telegram) {
      jobs.push(this.sendTelegram(prefs.telegram, alert));
    }
    if (prefs.enableWebhook && prefs.webhook) {
      jobs.push(this.sendWebhook(prefs.webhook, alert));
    }
    // Email: placeholder — integrate SendGrid/SES when ready
    if (prefs.enableEmail && prefs.email) {
      jobs.push(this.sendEmail(prefs.email, alert));
    }

    await Promise.allSettled(jobs);
  }

  // ── Read operations ────────────────────────────────────────────────────────

  async getAlerts(
    userId: string,
    options: { unreadOnly?: boolean; type?: string; limit?: number; offset?: number } = {},
  ): Promise<{ alerts: Alert[]; total: number }> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];
    let p = 2;

    if (options.unreadOnly) {
      conditions.push(`read = FALSE`);
    }
    if (options.type) {
      conditions.push(`type = $${p++}`);
      params.push(options.type);
    }

    const where = conditions.join(' AND ');
    const limit  = options.limit  ?? 20;
    const offset = options.offset ?? 0;

    const [dataRes, countRes] = await Promise.all([
      db.query(
        `SELECT id, user_id, type, title, message, severity, data, read, created_at
         FROM alerts WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        [...params, limit, offset],
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) FROM alerts WHERE ${where}`,
        params,
      ),
    ]);

    return {
      alerts: dataRes.rows.map(rowToAlert),
      total:  parseInt(countRes.rows[0].count, 10),
    };
  }

  async markAsRead(userId: string, alertId: string): Promise<boolean> {
    const { rowCount } = await db.query(
      `UPDATE alerts SET read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2 AND read = FALSE`,
      [alertId, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const { rowCount } = await db.query(
      `UPDATE alerts SET read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );
    return rowCount ?? 0;
  }

  async deleteAlert(userId: string, alertId: string): Promise<boolean> {
    const { rowCount } = await db.query(
      `DELETE FROM alerts WHERE id = $1 AND user_id = $2`,
      [alertId, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*) FROM alerts WHERE user_id = $1 AND read = FALSE`,
      [userId],
    );
    return parseInt(rows[0].count, 10);
  }

  // ── Preferences ────────────────────────────────────────────────────────────

  async setPreferences(prefs: AlertPreferences): Promise<void> {
    await db.query(
      `INSERT INTO alert_preferences
         (user_id, enable_email, enable_telegram, enable_webhook, enable_push,
          trust_change_alerts, scam_flag_alerts, whale_activity_alerts,
          vote_threshold_alerts, market_alerts, min_severity,
          telegram_chat_id, webhook_url, email_address, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         enable_email          = EXCLUDED.enable_email,
         enable_telegram       = EXCLUDED.enable_telegram,
         enable_webhook        = EXCLUDED.enable_webhook,
         enable_push           = EXCLUDED.enable_push,
         trust_change_alerts   = EXCLUDED.trust_change_alerts,
         scam_flag_alerts      = EXCLUDED.scam_flag_alerts,
         whale_activity_alerts = EXCLUDED.whale_activity_alerts,
         vote_threshold_alerts = EXCLUDED.vote_threshold_alerts,
         market_alerts         = EXCLUDED.market_alerts,
         min_severity          = EXCLUDED.min_severity,
         telegram_chat_id      = EXCLUDED.telegram_chat_id,
         webhook_url           = EXCLUDED.webhook_url,
         email_address         = EXCLUDED.email_address,
         updated_at            = NOW()`,
      [
        prefs.userId,
        prefs.enableEmail,   prefs.enableTelegram,
        prefs.enableWebhook, prefs.enablePush,
        prefs.trustChangeAlerts,   prefs.scamFlagAlerts,
        prefs.whaleActivityAlerts, prefs.voteThresholdAlerts,
        prefs.marketAlerts,        prefs.minSeverity,
        prefs.telegram ?? null,    prefs.webhook ?? null,
        prefs.email ?? null,
      ],
    );
    logger.info(`Alert preferences updated for user ${prefs.userId}`);
  }

  async getPreferences(userId: string): Promise<AlertPreferences | null> {
    const { rows } = await db.query(
      `SELECT * FROM alert_preferences WHERE user_id = $1`,
      [userId],
    );
    return rows.length > 0 ? rowToPrefs(rows[0]) : null;
  }

  // ── Delivery channels ──────────────────────────────────────────────────────

  private async sendTelegram(chatId: string, alert: Alert): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    const emoji: Record<Alert['type'], string> = {
      trust_change:      '📊',
      scam_flag:         '🚨',
      whale_activity:    '🐋',
      vote_threshold:    '🗳️',
      premium_expiry:    '⏰',
      market_resolution: '🎲',
      contract_event:    '⛓️',
    };
    const severityEmoji: Record<Alert['severity'], string> = {
      low: '🟢', medium: '🟡', high: '🟠', critical: '🔴',
    };

    const text = `${emoji[alert.type]} ${severityEmoji[alert.severity]} *${alert.title}*\n\n${alert.message}`;

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      });
      if (!res.ok) {
        logger.warn(`Telegram delivery failed (${res.status})`, { alertId: alert.id });
      } else {
        logger.info(`Telegram alert sent to ${chatId}`, { alertId: alert.id });
      }
    } catch (error) {
      logger.error('Failed to send Telegram alert', error as Error);
    }
  }

  private async sendWebhook(url: string, alert: Alert): Promise<void> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event:     'dappscore.alert',
          timestamp: alert.createdAt.toISOString(),
          data:      alert,
        }),
      });
      if (!res.ok) {
        logger.warn(`Webhook delivery failed (${res.status})`, { alertId: alert.id, url });
      } else {
        logger.info(`Webhook alert sent to ${url}`, { alertId: alert.id });
      }
    } catch (error) {
      logger.error('Failed to send webhook', error as Error);
    }
  }

  private async sendEmail(_email: string, _alert: Alert): Promise<void> {
    // TODO: integrate SendGrid / AWS SES
    logger.info(`Email delivery not yet configured`, { alertId: _alert.id });
  }

  // ── Convenience helpers ────────────────────────────────────────────────────

  async alertTrustChange(
    userId: string, projectId: string, projectName: string,
    oldLevel: number, newLevel: number,
  ): Promise<Alert> {
    const levelNames = ['New Listing', 'Trusted', 'Neutral', 'Suspicious', 'Suspected Scam', 'Probable Scam'];
    const severity: Alert['severity'] = newLevel >= 4 ? 'high' : newLevel >= 3 ? 'medium' : 'low';
    return this.createAlert({
      userId, type: 'trust_change', projectId, severity,
      title:   `Trust Level Changed: ${projectName}`,
      message: `${projectName} trust level changed from ${levelNames[oldLevel]} to ${levelNames[newLevel]}`,
      metadata: { oldLevel, newLevel },
    });
  }

  async alertScamFlag(
    userId: string, projectId: string, projectName: string, reason: string,
  ): Promise<Alert> {
    return this.createAlert({
      userId, type: 'scam_flag', projectId, severity: 'critical',
      title:   `Scam Alert: ${projectName}`,
      message: `${projectName} has been flagged as a potential scam. Reason: ${reason}`,
      metadata: { reason },
    });
  }

  async alertWhaleActivity(
    userId: string, projectId: string, projectName: string,
    activityType: string, details: Record<string, any>,
  ): Promise<Alert> {
    return this.createAlert({
      userId, type: 'whale_activity', projectId, severity: 'medium',
      title:   `Whale Activity: ${projectName}`,
      message: `Large ${activityType} detected for ${projectName}`,
      metadata: details,
    });
  }

  /**
   * No-op — kept for interface compatibility. Delivery is now instant.
   * @deprecated
   */
  async processPendingAlerts(): Promise<void> {
    // Delivery happens immediately in createAlert(). Nothing to process here.
  }
}

export const alertService = new AlertService();
export default alertService;
