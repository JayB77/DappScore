import { Router } from 'express';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { gql } from '../lib/graphql';

const router = Router();

const CACHE_TTL_SECONDS = 5 * 60; // 5 min

async function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const db   = getFirestore();
  const ref  = db.collection('stats_cache').doc(key);
  const snap = await ref.get();

  if (snap.exists) {
    const d   = snap.data()!;
    const age = Date.now() / 1000 - (d.cachedAt as Timestamp).seconds;
    if (age < CACHE_TTL_SECONDS) return d.value as T;
  }

  const value = await fetcher();
  await ref.set({ value, cachedAt: Timestamp.now() });
  return value;
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/v1/stats/global */
router.get('/global', async (_req, res) => {
  try {
    const data = await getCached('global', () =>
      gql(
        `query GlobalStats {
          globalStats(id: "1") {
            totalProjects totalUsers totalVotes totalScamsDetected
            totalRewardsDistributed activePredictionMarkets
            totalInsurancePolicies insurancePoolSize updatedAt
          }
        }`,
      ),
    );

    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.json({ data });
  } catch (err) {
    console.error('[stats] global', err);
    res.status(500).json({ error: 'Failed to fetch global stats.' });
  }
});

/** GET /api/v1/stats/daily?days=30 */
router.get('/daily', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);

    const data = await getCached(`daily_${days}`, () =>
      gql(
        `query DailyStats($first: Int!) {
          dailyStats(first: $first, orderBy: date, orderDirection: desc) {
            date newProjects newUsers newVotes scamsDetected
            rewardsDistributed activeUsers
          }
        }`,
        { first: days },
      ),
    );

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.json({ data });
  } catch (err) {
    console.error('[stats] daily', err);
    res.status(500).json({ error: 'Failed to fetch daily stats.' });
  }
});

/** GET /api/v1/stats/token */
router.get('/token', async (_req, res) => {
  try {
    const data = await getCached('token', () =>
      gql(
        `query TokenStats {
          tokenStats(id: "1") {
            totalSupply circulatingSupply stakedSupply
            totalStakers avgStakeDuration price marketCap
            burnedAmount rewardsEmitted updatedAt
          }
        }`,
      ),
    );

    res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    res.json({ data });
  } catch (err) {
    console.error('[stats] token', err);
    res.status(500).json({ error: 'Failed to fetch token stats.' });
  }
});

/** GET /api/v1/stats/insurance */
router.get('/insurance', async (_req, res) => {
  try {
    const data = await getCached('insurance', () =>
      gql(
        `query InsuranceStats {
          insurancePool(id: "1") {
            totalDeposited totalClaimed activePolicies
            poolBalance coverageRatio avgPremium updatedAt
          }
        }`,
      ),
    );

    res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    res.json({ data });
  } catch (err) {
    console.error('[stats] insurance', err);
    res.status(500).json({ error: 'Failed to fetch insurance stats.' });
  }
});

/** GET /api/v1/stats/predictions */
router.get('/predictions', async (_req, res) => {
  try {
    const data = await getCached('predictions', () =>
      gql(
        `query PredictionStats {
          predictionStats(id: "1") {
            totalMarkets activeMarkets resolvedMarkets
            totalVolume totalParticipants avgAccuracy updatedAt
          }
        }`,
      ),
    );

    res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    res.json({ data });
  } catch (err) {
    console.error('[stats] predictions', err);
    res.status(500).json({ error: 'Failed to fetch prediction stats.' });
  }
});

/** GET /api/v1/stats/bounties */
router.get('/bounties', async (_req, res) => {
  try {
    const data = await getCached('bounties', () =>
      gql(
        `query BountyStats {
          bountyStats(id: "1") {
            totalBounties activeBounties completedBounties
            totalPaid avgBountySize topHunters { address earned }
            updatedAt
          }
        }`,
      ),
    );

    res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    res.json({ data });
  } catch (err) {
    console.error('[stats] bounties', err);
    res.status(500).json({ error: 'Failed to fetch bounty stats.' });
  }
});

export default router;
