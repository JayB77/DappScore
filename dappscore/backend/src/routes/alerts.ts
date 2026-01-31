/**
 * Alerts API Routes
 */

import { Router, Request, Response } from 'express';
import { alertService } from '../services/alerts';

const router = Router();

/**
 * GET /api/alerts
 * Get user's alerts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const { unreadOnly, type, limit = '20', offset = '0' } = req.query;

    const result = await alertService.getAlerts(userId, {
      unreadOnly: unreadOnly === 'true',
      type: type as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Alerts API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch alerts',
    });
  }
});

/**
 * GET /api/alerts/unread-count
 * Get unread alert count
 */
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const count = await alertService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    console.error('[Alerts API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get unread count',
    });
  }
});

/**
 * POST /api/alerts/:alertId/read
 * Mark alert as read
 */
router.post('/:alertId/read', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const { alertId } = req.params;
    const success = await alertService.markAsRead(userId, alertId);

    res.json({
      success,
      message: success ? 'Alert marked as read' : 'Alert not found',
    });
  } catch (error: any) {
    console.error('[Alerts API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark as read',
    });
  }
});

/**
 * POST /api/alerts/read-all
 * Mark all alerts as read
 */
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const count = await alertService.markAllAsRead(userId);

    res.json({
      success: true,
      message: `Marked ${count} alerts as read`,
      data: { count },
    });
  } catch (error: any) {
    console.error('[Alerts API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark all as read',
    });
  }
});

/**
 * DELETE /api/alerts/:alertId
 * Delete an alert
 */
router.delete('/:alertId', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const { alertId } = req.params;
    const success = await alertService.deleteAlert(userId, alertId);

    res.json({
      success,
      message: success ? 'Alert deleted' : 'Alert not found',
    });
  } catch (error: any) {
    console.error('[Alerts API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete alert',
    });
  }
});

/**
 * GET /api/alerts/preferences
 * Get user's alert preferences
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const prefs = await alertService.getPreferences(userId);

    res.json({
      success: true,
      data: prefs || {
        userId,
        enableEmail: false,
        enableTelegram: false,
        enableWebhook: false,
        enablePush: false,
        trustChangeAlerts: true,
        scamFlagAlerts: true,
        whaleActivityAlerts: true,
        voteThresholdAlerts: false,
        marketAlerts: false,
        minSeverity: 'low',
      },
    });
  } catch (error: any) {
    console.error('[Alerts API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get preferences',
    });
  }
});

/**
 * PUT /api/alerts/preferences
 * Update user's alert preferences
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID required' });
    }

    const prefs = { ...req.body, userId };
    await alertService.setPreferences(prefs);

    res.json({
      success: true,
      message: 'Preferences updated',
    });
  } catch (error: any) {
    console.error('[Alerts API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update preferences',
    });
  }
});

export const alertRoutes = router;
export default router;
