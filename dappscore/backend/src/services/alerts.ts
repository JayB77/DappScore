/**
 * Alert Service
 *
 * Manages user alerts for watchlist items, scam detections, and whale activity
 */

import { logger } from './logger';

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

// In-memory storage (use Redis/DB in production)
const alerts: Map<string, Alert[]> = new Map();
const preferences: Map<string, AlertPreferences> = new Map();
const pendingAlerts: Alert[] = [];

export class AlertService {
  /**
   * Create a new alert for a user
   */
  async createAlert(alert: Omit<Alert, 'id' | 'read' | 'createdAt'>): Promise<Alert> {
    const newAlert: Alert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      createdAt: new Date(),
    };

    // Add to user's alerts
    const userAlerts = alerts.get(alert.userId) || [];
    userAlerts.unshift(newAlert);

    // Keep only last 100 alerts
    if (userAlerts.length > 100) {
      userAlerts.pop();
    }

    alerts.set(alert.userId, userAlerts);

    // Queue for delivery
    pendingAlerts.push(newAlert);

    logger.info(`Alert created for user ${alert.userId}`, {
      type: alert.type,
      severity: alert.severity,
    });

    return newAlert;
  }

  /**
   * Get alerts for a user
   */
  async getAlerts(
    userId: string,
    options: { unreadOnly?: boolean; type?: string; limit?: number; offset?: number } = {}
  ): Promise<{ alerts: Alert[]; total: number }> {
    let userAlerts = alerts.get(userId) || [];

    if (options.unreadOnly) {
      userAlerts = userAlerts.filter(a => !a.read);
    }

    if (options.type) {
      userAlerts = userAlerts.filter(a => a.type === options.type);
    }

    const total = userAlerts.length;
    const offset = options.offset || 0;
    const limit = options.limit || 20;

    return {
      alerts: userAlerts.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * Mark alert as read
   */
  async markAsRead(userId: string, alertId: string): Promise<boolean> {
    const userAlerts = alerts.get(userId);
    if (!userAlerts) return false;

    const alert = userAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.read = true;
      return true;
    }

    return false;
  }

  /**
   * Mark all alerts as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const userAlerts = alerts.get(userId);
    if (!userAlerts) return 0;

    let count = 0;
    for (const alert of userAlerts) {
      if (!alert.read) {
        alert.read = true;
        count++;
      }
    }

    return count;
  }

  /**
   * Delete an alert
   */
  async deleteAlert(userId: string, alertId: string): Promise<boolean> {
    const userAlerts = alerts.get(userId);
    if (!userAlerts) return false;

    const index = userAlerts.findIndex(a => a.id === alertId);
    if (index >= 0) {
      userAlerts.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const userAlerts = alerts.get(userId) || [];
    return userAlerts.filter(a => !a.read).length;
  }

  /**
   * Set user preferences
   */
  async setPreferences(prefs: AlertPreferences): Promise<void> {
    preferences.set(prefs.userId, prefs);
    logger.info(`Alert preferences updated for user ${prefs.userId}`);
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<AlertPreferences | null> {
    return preferences.get(userId) || null;
  }

  /**
   * Process pending alerts (called by cron job)
   */
  async processPendingAlerts(): Promise<void> {
    if (pendingAlerts.length === 0) return;

    const toProcess = pendingAlerts.splice(0, 50);
    logger.info(`Processing ${toProcess.length} pending alerts`);

    for (const alert of toProcess) {
      const prefs = preferences.get(alert.userId);
      if (!prefs) continue;

      // Check severity threshold
      const severityLevels = { low: 0, medium: 1, high: 2, critical: 3 };
      if (severityLevels[alert.severity] < severityLevels[prefs.minSeverity]) {
        continue;
      }

      // Check alert type preferences
      const shouldSend =
        (alert.type === 'trust_change'    && prefs.trustChangeAlerts) ||
        (alert.type === 'scam_flag'       && prefs.scamFlagAlerts) ||
        (alert.type === 'whale_activity'  && prefs.whaleActivityAlerts) ||
        (alert.type === 'vote_threshold'  && prefs.voteThresholdAlerts) ||
        (alert.type === 'market_resolution' && prefs.marketAlerts) ||
        (alert.type === 'contract_event'  && prefs.scamFlagAlerts) || // routed through scam alerts
        alert.type === 'premium_expiry';

      if (!shouldSend) continue;

      // Deliver through enabled channels
      if (prefs.enableEmail && prefs.email) {
        await this.sendEmail(prefs.email, alert);
      }

      if (prefs.enableTelegram && prefs.telegram) {
        await this.sendTelegram(prefs.telegram, alert);
      }

      if (prefs.enableWebhook && prefs.webhook) {
        await this.sendWebhook(prefs.webhook, alert);
      }
    }
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmail(email: string, alert: Alert): Promise<void> {
    // In production, integrate with SendGrid, AWS SES, etc.
    logger.info(`Would send email to ${email}`, { alertId: alert.id });
  }

  /**
   * Send Telegram notification
   */
  private async sendTelegram(chatId: string, alert: Alert): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    try {
      const emoji = {
        trust_change: '📊',
        scam_flag: '🚨',
        whale_activity: '🐋',
        vote_threshold: '🗳️',
        premium_expiry: '⏰',
        market_resolution: '🎲',
        contract_event: '⛓️',
      }[alert.type];

      const severityEmoji = {
        low: '🟢',
        medium: '🟡',
        high: '🟠',
        critical: '🔴',
      }[alert.severity];

      const message = `${emoji} ${severityEmoji} *${alert.title}*\n\n${alert.message}`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });

      logger.info(`Sent Telegram alert to ${chatId}`, { alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send Telegram alert', error as Error);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(url: string, alert: Alert): Promise<void> {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'dappscore.alert',
          timestamp: alert.createdAt.toISOString(),
          data: alert,
        }),
      });

      logger.info(`Sent webhook to ${url}`, { alertId: alert.id });
    } catch (error) {
      logger.error('Failed to send webhook', error as Error);
    }
  }

  /**
   * Create trust change alert
   */
  async alertTrustChange(
    userId: string,
    projectId: string,
    projectName: string,
    oldLevel: number,
    newLevel: number
  ): Promise<Alert> {
    const levelNames = ['New Listing', 'Trusted', 'Neutral', 'Suspicious', 'Suspected Scam', 'Probable Scam'];
    const severity = newLevel >= 4 ? 'high' : newLevel >= 3 ? 'medium' : 'low';

    return this.createAlert({
      userId,
      type: 'trust_change',
      projectId,
      title: `Trust Level Changed: ${projectName}`,
      message: `${projectName} trust level changed from ${levelNames[oldLevel]} to ${levelNames[newLevel]}`,
      severity,
      metadata: { oldLevel, newLevel },
    });
  }

  /**
   * Create scam flag alert
   */
  async alertScamFlag(
    userId: string,
    projectId: string,
    projectName: string,
    reason: string
  ): Promise<Alert> {
    return this.createAlert({
      userId,
      type: 'scam_flag',
      projectId,
      title: `Scam Alert: ${projectName}`,
      message: `${projectName} has been flagged as a potential scam. Reason: ${reason}`,
      severity: 'critical',
      metadata: { reason },
    });
  }

  /**
   * Create whale activity alert
   */
  async alertWhaleActivity(
    userId: string,
    projectId: string,
    projectName: string,
    activityType: string,
    details: Record<string, any>
  ): Promise<Alert> {
    return this.createAlert({
      userId,
      type: 'whale_activity',
      projectId,
      title: `Whale Activity: ${projectName}`,
      message: `Large ${activityType} detected for ${projectName}`,
      severity: 'medium',
      metadata: details,
    });
  }
}

export const alertService = new AlertService();
export default alertService;
