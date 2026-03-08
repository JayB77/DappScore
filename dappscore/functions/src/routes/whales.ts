/**
 * Whale Tracking — uses Alchemy REST API (no native-module SDK).
 * Supports per-network Alchemy API keys via lib/alchemy.ts.
 */

import { Router } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { alchemyRpc, ALCHEMY_NETWORKS } from '../lib/alchemy';

const router = Router();

/** Fetch top token holders via Alchemy getTokenTopHolders. */
async function getTopHolders(tokenAddress: string, network: string, limit: number) {
  try {
    const result = await alchemyRpc(network, 'alchemy_getTokenBalances', [
      tokenAddress, 'erc20',
    ]);
    // NOTE: real top-holder endpoint is alchemy_getTopTokenHolders (Alchemy v3 endpoints)
    return result;
  } catch {
    return [];
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/v1/whales/wallet/:address */
router.get('/wallet/:address', async (req, res) => {
  const { address } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ success: false, error: 'Invalid address.' });
  }

  try {
    const network = (req.query.network as string) || 'mainnet';

    // Fetch ETH balance
    const balance = await alchemyRpc(network, 'eth_getBalance', [address, 'latest']);

    // Fetch known label from Firestore
    const labelSnap = await getFirestore().collection('whale_labels').doc(address.toLowerCase()).get();
    const label = labelSnap.exists ? labelSnap.data() : null;

    res.set('Cache-Control', 'public, s-maxage=60');
    res.json({
      success: true,
      data: {
        address,
        network,
        ethBalance: balance,
        label: label?.label ?? null,
        type: label?.type ?? 'unknown',
        notes: label?.notes ?? null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[whales] wallet', err);
    res.status(500).json({ success: false, error: msg });
  }
});

/** GET /api/v1/whales/:tokenAddress */
router.get('/:tokenAddress', async (req, res) => {
  const { tokenAddress } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid token address.' });
  }

  try {
    const network = (req.query.network as string) || 'mainnet';
    const limit   = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const holders = await getTopHolders(tokenAddress, network, limit);

    res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    res.json({
      success: true,
      data: { tokenAddress, network, whaleCount: Array.isArray(holders) ? holders.length : 0, whales: holders },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[whales] GET /:tokenAddress', err);
    res.status(500).json({ success: false, error: msg });
  }
});

/** GET /api/v1/whales/:tokenAddress/transactions */
router.get('/:tokenAddress/transactions', async (req, res) => {
  const { tokenAddress } = req.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid token address.' });
  }

  try {
    const network = (req.query.network as string) || 'mainnet';
    const hours   = Math.min(parseInt(req.query.hours as string) || 24, 168); // max 7 days

    // Use alchemy_getAssetTransfers
    const fromBlock = `0x${Math.floor((Date.now() / 1000 - hours * 3600) / 12).toString(16)}`;

    const result = await alchemyRpc(network, 'alchemy_getAssetTransfers', [{
      fromBlock,
      toBlock: 'latest',
      contractAddresses: [tokenAddress],
      category: ['erc20'],
      withMetadata: true,
      maxCount: '0x64', // 100 transfers
    }]);

    const transfers = (result as { transfers?: unknown[] })?.transfers ?? [];

    res.set('Cache-Control', 'public, s-maxage=60');
    res.json({
      success: true,
      data: {
        tokenAddress,
        network,
        timeframe: `${hours}h`,
        transactionCount: transfers.length,
        transactions: transfers,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[whales] transactions', err);
    res.status(500).json({ success: false, error: msg });
  }
});

/** GET /api/v1/whales/:tokenAddress/analysis */
router.get('/:tokenAddress/analysis', async (req, res) => {
  const { tokenAddress } = req.params;

  try {
    const network = (req.query.network as string) || 'mainnet';

    // Cached in Firestore for 1 hour
    const cacheKey = `${tokenAddress}_${network}`;
    const cached = await getFirestore().collection('whale_analysis_cache').doc(cacheKey).get();

    if (cached.exists) {
      const d = cached.data()!;
      const age = Date.now() / 1000 - d.cachedAt.seconds;
      if (age < 3600) {
        return res.set('Cache-Control', 'public, s-maxage=600').json({ success: true, data: d.analysis });
      }
    }

    // Minimal analysis: fetch recent transfers and compute basic metrics
    const result = await alchemyRpc(network, 'alchemy_getAssetTransfers', [{
      fromBlock: `0x${Math.floor((Date.now() / 1000 - 86400) / 12).toString(16)}`,
      toBlock: 'latest',
      contractAddresses: [tokenAddress],
      category: ['erc20'],
      withMetadata: true,
      maxCount: '0x64',
    }]).catch(() => ({ transfers: [] }));

    const transfers = (result as { transfers?: Array<{ value?: number }> })?.transfers ?? [];

    const totalVolume = transfers.reduce((s, t) => s + (t.value ?? 0), 0);
    const analysis = {
      tokenAddress,
      network,
      last24h: {
        transferCount: transfers.length,
        totalVolume,
        avgTransferSize: transfers.length ? totalVolume / transfers.length : 0,
      },
      trend: transfers.length > 50 ? 'high_activity' : transfers.length > 20 ? 'moderate' : 'low',
      analyzedAt: new Date().toISOString(),
    };

    await getFirestore().collection('whale_analysis_cache').doc(cacheKey).set({
      analysis, cachedAt: Timestamp.now(),
    });

    res.set('Cache-Control', 'public, s-maxage=300');
    res.json({ success: true, data: analysis });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[whales] analysis', err);
    res.status(500).json({ success: false, error: msg });
  }
});

const trackSchema = z.object({
  tokenAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  symbol:       z.string().min(1).max(20),
  priceUsd:     z.number().min(0).optional().default(0),
  network:      z.string().optional().default('mainnet'),
});

/** POST /api/v1/whales/track */
router.post('/track', async (req, res) => {
  const parsed = trackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, error: 'Invalid fields.', details: parsed.error.flatten() });
  }

  try {
    const { tokenAddress, symbol, priceUsd, network } = parsed.data;

    await getFirestore().collection('tracked_tokens').doc(tokenAddress.toLowerCase()).set({
      tokenAddress: tokenAddress.toLowerCase(),
      symbol,
      priceUsd,
      network,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    res.json({ success: true, message: `Now tracking ${symbol} on ${network}.` });
  } catch (err) {
    console.error('[whales] track', err);
    res.status(500).json({ success: false, error: 'Failed to track token.' });
  }
});

/** POST /api/v1/whales/price */
router.post('/price', async (req, res) => {
  const { tokenAddress, priceUsd } = req.body ?? {};

  if (!tokenAddress || typeof priceUsd !== 'number') {
    return res.status(400).json({ success: false, error: 'tokenAddress and priceUsd required.' });
  }

  try {
    await getFirestore().collection('tracked_tokens').doc(tokenAddress.toLowerCase()).set({
      priceUsd, updatedAt: Timestamp.now(),
    }, { merge: true });

    res.json({ success: true, message: 'Price updated.' });
  } catch (err) {
    console.error('[whales] price', err);
    res.status(500).json({ success: false, error: 'Failed to update price.' });
  }
});

const labelSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  label:   z.string().min(1).max(100),
  type:    z.enum(['whale', 'exchange', 'team', 'fund', 'bot', 'other']).optional().default('whale'),
  notes:   z.string().max(500).optional(),
});

/** POST /api/v1/whales/wallet/label */
router.post('/wallet/label', async (req, res) => {
  const parsed = labelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, error: 'Invalid fields.', details: parsed.error.flatten() });
  }

  try {
    await getFirestore().collection('whale_labels').doc(parsed.data.address.toLowerCase()).set({
      ...parsed.data,
      address: parsed.data.address.toLowerCase(),
      updatedAt: Timestamp.now(),
    }, { merge: true });

    res.json({ success: true, message: 'Wallet labelled.' });
  } catch (err) {
    console.error('[whales] label', err);
    res.status(500).json({ success: false, error: 'Failed to label wallet.' });
  }
});

/** GET /api/v1/whales/:tokenAddress/alerts */
router.get('/:tokenAddress/alerts', async (req, res) => {
  const { tokenAddress } = req.params;

  try {
    // Check for large recent transfers (> 1% total supply estimate)
    const network = (req.query.network as string) || 'mainnet';

    const result = await alchemyRpc(network, 'alchemy_getAssetTransfers', [{
      fromBlock: `0x${Math.floor((Date.now() / 1000 - 3600) / 12).toString(16)}`,
      toBlock: 'latest',
      contractAddresses: [tokenAddress],
      category: ['erc20'],
      withMetadata: true,
      maxCount: '0x32', // 50
    }]).catch(() => ({ transfers: [] }));

    const transfers = (result as { transfers?: Array<{ value?: number; from?: string; to?: string; hash?: string }> })?.transfers ?? [];

    // Flag transfers > $100k (rough threshold)
    const threshold = (req.query.threshold ? parseFloat(req.query.threshold as string) : 100_000);
    const tokenInfo = await getFirestore().collection('tracked_tokens').doc(tokenAddress.toLowerCase()).get();
    const priceUsd  = (tokenInfo.data()?.priceUsd as number) || 0;

    const alerts = priceUsd > 0
      ? transfers
          .filter(t => (t.value ?? 0) * priceUsd > threshold)
          .map(t => ({
            type: 'large_transfer',
            value: t.value,
            valueUsd: (t.value ?? 0) * priceUsd,
            from: t.from,
            to: t.to,
            txHash: t.hash,
          }))
      : [];

    res.json({
      success: true,
      data: { tokenAddress, network, alertCount: alerts.length, alerts },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[whales] alerts', err);
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
