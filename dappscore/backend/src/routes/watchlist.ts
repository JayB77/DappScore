/**
 * Watchlist API Routes
 *
 * GET    /api/v1/watchlist              — user's watched projects
 * POST   /api/v1/watchlist              — add project to watchlist
 * DELETE /api/v1/watchlist/:projectId   — remove project from watchlist
 * PUT    /api/v1/watchlist/:projectId/prefs — update per-project alert prefs
 */

import { Router, Request, Response } from 'express';
import { db } from '../lib/db';
import { logger } from '../services/logger';

const router = Router();

function requireUser(req: Request, res: Response): string | null {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    res.status(401).json({ success: false, error: 'User ID required' });
    return null;
  }
  return userId;
}

/** GET /api/v1/watchlist — fetch all watched projects for the caller */
router.get('/', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const { rows } = await db.query(
      `SELECT id, project_id, token_address, network, created_at,
              alert_liquidity_drop, alert_ownership_xfer,
              alert_trust_change, alert_scam_flag
       FROM user_watchlist
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    res.json({ success: true, data: rows });
  } catch (err: any) {
    logger.error('[Watchlist] GET error', err);
    res.status(500).json({ success: false, error: 'Failed to fetch watchlist' });
  }
});

/** POST /api/v1/watchlist — add a project to the watchlist */
router.post('/', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { projectId, tokenAddress, network = 'mainnet' } = req.body as {
    projectId?: string;
    tokenAddress?: string;
    network?: string;
  };

  if (!projectId) {
    return res.status(400).json({ success: false, error: 'projectId required' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO user_watchlist (user_id, project_id, token_address, network)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, project_id) DO UPDATE
         SET token_address = COALESCE(EXCLUDED.token_address, user_watchlist.token_address),
             network       = EXCLUDED.network
       RETURNING *`,
      [userId, projectId, tokenAddress ?? null, network],
    );

    logger.info(`User ${userId} watching project ${projectId}`);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    logger.error('[Watchlist] POST error', err);
    res.status(500).json({ success: false, error: 'Failed to add to watchlist' });
  }
});

/** DELETE /api/v1/watchlist/:projectId — remove a project from the watchlist */
router.delete('/:projectId', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { projectId } = req.params;

  try {
    const { rowCount } = await db.query(
      `DELETE FROM user_watchlist WHERE user_id = $1 AND project_id = $2`,
      [userId, projectId],
    );

    if ((rowCount ?? 0) === 0) {
      return res.status(404).json({ success: false, error: 'Not in watchlist' });
    }

    logger.info(`User ${userId} unwatched project ${projectId}`);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('[Watchlist] DELETE error', err);
    res.status(500).json({ success: false, error: 'Failed to remove from watchlist' });
  }
});

/** PUT /api/v1/watchlist/:projectId/prefs — update per-project alert prefs */
router.put('/:projectId/prefs', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { projectId } = req.params;
  const {
    alertLiquidityDrop,
    alertOwnershipXfer,
    alertTrustChange,
    alertScamFlag,
  } = req.body as Record<string, boolean | undefined>;

  try {
    const { rowCount } = await db.query(
      `UPDATE user_watchlist
       SET alert_liquidity_drop = COALESCE($3, alert_liquidity_drop),
           alert_ownership_xfer = COALESCE($4, alert_ownership_xfer),
           alert_trust_change   = COALESCE($5, alert_trust_change),
           alert_scam_flag      = COALESCE($6, alert_scam_flag)
       WHERE user_id = $1 AND project_id = $2`,
      [userId, projectId,
       alertLiquidityDrop ?? null, alertOwnershipXfer ?? null,
       alertTrustChange ?? null,   alertScamFlag ?? null],
    );

    if ((rowCount ?? 0) === 0) {
      return res.status(404).json({ success: false, error: 'Project not in watchlist' });
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error('[Watchlist] PUT prefs error', err);
    res.status(500).json({ success: false, error: 'Failed to update prefs' });
  }
});

export const watchlistRoutes = router;
export default router;
