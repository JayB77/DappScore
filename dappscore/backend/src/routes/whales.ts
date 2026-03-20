/**
 * Whale Tracking API Routes
 */

import { Router, Request, Response } from 'express';
import whaleTrackingService from '../services/whale-tracking';

const router = Router();

/**
 * GET /api/whales/:tokenAddress
 * Get whale wallets for a token
 */
router.get('/:tokenAddress', async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;
    const { network = 'mainnet', limit = '20' } = req.query;

    const whales = await whaleTrackingService.getWhalesForToken(
      tokenAddress,
      network as 'mainnet' | 'testnet',
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: {
        tokenAddress,
        whaleCount: whales.length,
        whales,
      },
    });
  } catch (error: any) {
    console.error('[Whales API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch whale data',
    });
  }
});

/**
 * GET /api/whales/:tokenAddress/transactions
 * Get recent whale transactions
 */
router.get('/:tokenAddress/transactions', async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;
    const { network = 'mainnet', hours = '24' } = req.query;

    const transactions = await whaleTrackingService.getRecentWhaleTransactions(
      tokenAddress,
      network as 'mainnet' | 'testnet',
      parseInt(hours as string)
    );

    res.json({
      success: true,
      data: {
        tokenAddress,
        timeframe: `${hours}h`,
        transactionCount: transactions.length,
        transactions,
      },
    });
  } catch (error: any) {
    if (error.message === 'Token not being tracked') {
      return res.status(404).json({ success: false, error: 'Token not tracked' });
    }
    console.error('[Whales API] Transactions error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch transactions',
    });
  }
});

/**
 * GET /api/whales/:tokenAddress/analysis
 * Get whale activity analysis
 */
router.get('/:tokenAddress/analysis', async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;
    const { network = 'mainnet' } = req.query;

    const analysis = await whaleTrackingService.analyzeWhaleActivity(
      tokenAddress,
      network as 'mainnet' | 'testnet'
    );

    res.json({
      success: true,
      data: {
        tokenAddress,
        analysis,
      },
    });
  } catch (error: any) {
    if (error.message === 'Token not being tracked') {
      return res.status(404).json({ success: false, error: 'Token not tracked' });
    }
    console.error('[Whales API] Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze whale activity',
    });
  }
});

/**
 * GET /api/whales/:tokenAddress/alerts
 * Get whale alerts for a token
 */
router.get('/:tokenAddress/alerts', async (req: Request, res: Response) => {
  try {
    const { tokenAddress } = req.params;
    const { projectId = '', network = 'mainnet' } = req.query;

    const alerts = await whaleTrackingService.checkForAlerts(
      tokenAddress,
      projectId as string,
      network as 'mainnet' | 'testnet'
    );

    res.json({
      success: true,
      data: {
        tokenAddress,
        alertCount: alerts.length,
        alerts,
      },
    });
  } catch (error: any) {
    console.error('[Whales API] Alerts error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check alerts',
    });
  }
});

/**
 * POST /api/whales/track
 * Add a token to track
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const { tokenAddress, symbol, priceUsd, network = 'mainnet' } = req.body;

    if (!tokenAddress || !symbol) {
      return res.status(400).json({
        success: false,
        error: 'tokenAddress and symbol are required',
      });
    }

    await whaleTrackingService.trackToken(
      tokenAddress,
      symbol,
      priceUsd || 0,
      network
    );

    res.json({
      success: true,
      message: `Now tracking ${symbol} at ${tokenAddress}`,
    });
  } catch (error: any) {
    console.error('[Whales API] Track error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to track token',
    });
  }
});

/**
 * POST /api/whales/price
 * Update token price
 */
router.post('/price', async (req: Request, res: Response) => {
  try {
    const { tokenAddress, priceUsd } = req.body;

    if (!tokenAddress || priceUsd === undefined) {
      return res.status(400).json({
        success: false,
        error: 'tokenAddress and priceUsd are required',
      });
    }

    whaleTrackingService.updateTokenPrice(tokenAddress, priceUsd);

    res.json({
      success: true,
      message: 'Price updated',
    });
  } catch (error: any) {
    console.error('[Whales API] Price update error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update price',
    });
  }
});

/**
 * GET /api/whales/wallet/:address
 * Get wallet info and labels
 */
router.get('/wallet/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const info = whaleTrackingService.getWalletInfo(address);

    res.json({
      success: true,
      data: {
        address,
        ...info,
      },
    });
  } catch (error: any) {
    console.error('[Whales API] Wallet info error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get wallet info',
    });
  }
});

/**
 * POST /api/whales/wallet/label
 * Add a custom wallet label
 */
router.post('/wallet/label', async (req: Request, res: Response) => {
  try {
    const { address, label, type } = req.body;

    if (!address || !label) {
      return res.status(400).json({
        success: false,
        error: 'address and label are required',
      });
    }

    whaleTrackingService.addWalletLabel(address, label, type || 'whale');

    res.json({
      success: true,
      message: 'Wallet labeled',
    });
  } catch (error: any) {
    console.error('[Whales API] Label error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to label wallet',
    });
  }
});

export default router;
