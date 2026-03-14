/**
 * Scam Detection API Routes
 */

import { Router, Request, Response } from 'express';
import { analyzeContract, analyzeTokenomics, getFingerprint, type ScamAnalysis } from '../services/scam-patterns';
import { monitorContractEvents } from '../services/event-monitor';

const router = Router();

/**
 * POST /api/scam-detection/analyze
 * Analyze a contract for scam patterns
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { contractAddress, network = 'mainnet' } = req.body;

    if (!contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'Contract address is required',
      });
    }

    const analysis = await analyzeContract(contractAddress, network);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    console.error('[ScamDetection API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze contract',
    });
  }
});

/**
 * POST /api/scam-detection/tokenomics
 * Analyze token distribution and tokenomics
 */
router.post('/tokenomics', async (req: Request, res: Response) => {
  try {
    const { tokenAddress, network = 'mainnet' } = req.body;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: 'Token address is required',
      });
    }

    const analysis = await analyzeTokenomics(tokenAddress, network);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    console.error('[ScamDetection API] Tokenomics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze tokenomics',
    });
  }
});

/**
 * POST /api/scam-detection/batch
 * Batch analyze multiple contracts
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { addresses, network = 'mainnet' } = req.body;

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({
        success: false,
        error: 'Addresses array is required',
      });
    }

    if (addresses.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 addresses per batch',
      });
    }

    const results: Record<string, ScamAnalysis> = {};

    for (const address of addresses) {
      try {
        results[address] = await analyzeContract(address, network);
      } catch (error: any) {
        results[address] = {
          address,
          riskScore: -1,
          riskLevel: 'unknown' as any,
          flags: [],
          details: { error: error.message },
          analyzedAt: new Date(),
        };
      }
    }

    res.json({
      success: true,
      data: {
        analyzed: Object.keys(results).length,
        results,
      },
    });
  } catch (error: any) {
    console.error('[ScamDetection API] Batch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to batch analyze',
    });
  }
});

/**
 * GET /api/scam-detection/patterns
 * Get list of known scam patterns
 */
router.get('/patterns', async (req: Request, res: Response) => {
  try {
    const patterns = [
      {
        id: 'honeypot',
        name: 'Honeypot',
        description: 'Contract that prevents selling tokens',
        severity: 'critical',
        indicators: [
          'Transfer restrictions on sell',
          'Blacklist functionality',
          'Max transaction limits on sell only',
        ],
      },
      {
        id: 'hidden-mint',
        name: 'Hidden Mint',
        description: 'Contract with hidden minting capability',
        severity: 'critical',
        indicators: [
          'Owner can mint unlimited tokens',
          'Hidden mint function in bytecode',
          'Proxy contracts with mintable implementation',
        ],
      },
      {
        id: 'fee-manipulation',
        name: 'Fee Manipulation',
        description: 'Excessive or manipulable trading fees',
        severity: 'high',
        indicators: [
          'Fees can be set above 25%',
          'Different buy/sell fees (sell higher)',
          'Owner can change fees to 100%',
        ],
      },
      {
        id: 'ownership-risk',
        name: 'Ownership Risk',
        description: 'Contract owner has excessive control',
        severity: 'medium',
        indicators: [
          'Owner not renounced',
          'Owner can pause trading',
          'Owner can blacklist addresses',
        ],
      },
      {
        id: 'liquidity-lock',
        name: 'Unlocked Liquidity',
        description: 'Liquidity pool tokens not locked',
        severity: 'high',
        indicators: [
          'LP tokens in deployer wallet',
          'No lock contract detected',
          'Short lock period',
        ],
      },
      {
        id: 'copy-token',
        name: 'Copy Token',
        description: 'Token copying popular project',
        severity: 'medium',
        indicators: [
          'Same name as known project',
          'Similar bytecode to known scam',
          'Impersonating verified project',
        ],
      },
    ];

    res.json({
      success: true,
      data: { patterns },
    });
  } catch (error: any) {
    console.error('[ScamDetection API] Patterns error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get patterns',
    });
  }
});

/**
 * POST /api/scam-detection/report
 * Submit a scam report
 */
router.post('/report', async (req: Request, res: Response) => {
  try {
    const { contractAddress, projectId, reason, evidence, reporter } = req.body;

    if (!contractAddress || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Contract address and reason are required',
      });
    }

    // In production, save to database and notify moderators
    const report = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contractAddress,
      projectId,
      reason,
      evidence: evidence || [],
      reporter: reporter || 'anonymous',
      status: 'pending',
      createdAt: new Date(),
    };

    console.log('[ScamDetection] New report submitted:', report);

    res.json({
      success: true,
      data: {
        reportId: report.id,
        message: 'Report submitted successfully. Our team will review it.',
      },
    });
  } catch (error: any) {
    console.error('[ScamDetection API] Report error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit report',
    });
  }
});

/**
 * POST /api/scam-detection/fingerprint
 * Full Rug Genome: bytecode hash, selectors, proxy type, obfuscation score,
 * and Jaccard similarity against every seeded known-rug profile.
 */
router.post('/fingerprint', async (req: Request, res: Response) => {
  try {
    const { contractAddress, network = 'mainnet' } = req.body;

    if (!contractAddress) {
      return res.status(400).json({
        success: false,
        error: 'contractAddress is required',
      });
    }

    const fingerprint = await getFingerprint(contractAddress, network);

    res.json({
      success: true,
      data: fingerprint,
    });
  } catch (error: any) {
    console.error('[ScamDetection API] Fingerprint error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fingerprint contract',
    });
  }
});

/**
 * GET /api/scam-detection/events?address=0x...&pair=0x...&network=mainnet&lookback=7200
 * On-demand event monitor: recent OwnershipTransferred, Upgraded, LP Mint/Burn
 * events for the given contract and optional LP pair address.
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { address, pair, network = 'mainnet', lookback } = req.query as Record<string, string>;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'address query param is required',
      });
    }

    const lookbackBlocks = lookback ? parseInt(lookback, 10) : 7_200;
    if (Number.isNaN(lookbackBlocks) || lookbackBlocks < 1 || lookbackBlocks > 500_000) {
      return res.status(400).json({
        success: false,
        error: 'lookback must be between 1 and 500000 blocks',
      });
    }

    const result = await monitorContractEvents(
      address,
      pair || undefined,
      network as 'mainnet' | 'testnet',
      lookbackBlocks,
    );

    res.json({
      success: true,
      data: {
        ...result,
        // Serialise bigints to strings for JSON compatibility
        events: result.events.map(e => ({ ...e, blockNumber: e.blockNumber.toString() })),
      },
    });
  } catch (error: any) {
    console.error('[ScamDetection API] Events error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch contract events',
    });
  }
});

export const scamDetectionRoutes = router;
export default router;
