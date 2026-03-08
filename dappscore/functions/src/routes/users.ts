import { Router } from 'express';
import { gql } from '../lib/graphql';
import { isEvmAddress } from '../lib/auth';

const router = Router();

const LEADERBOARD_TYPES = ['reputation', 'scamHunters', 'accuracy', 'earnings'] as const;

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/v1/users/leaderboard/:type */
router.get('/leaderboard/:type', async (req, res) => {
  const { type } = req.params;
  if (!LEADERBOARD_TYPES.includes(type as (typeof LEADERBOARD_TYPES)[number])) {
    return res.status(400).json({ error: `type must be one of: ${LEADERBOARD_TYPES.join(', ')}` });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
    const orderBy = type === 'earnings' ? 'totalEarnings'
      : type === 'accuracy' ? 'accuracy'
      : type === 'scamHunters' ? 'scamsDetected'
      : 'reputationScore';

    const data = await gql<{ users: unknown[] }>(
      `query Leaderboard($first: Int!, $orderBy: User_orderBy!) {
        users(first: $first, orderBy: $orderBy, orderDirection: desc) {
          id address reputationScore accuracy totalEarnings scamsDetected
          totalVotes createdAt
        }
      }`,
      { first: limit, orderBy },
    );

    res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    res.json({ data: data.users });
  } catch (err) {
    console.error('[users] leaderboard', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

/** GET /api/v1/users/:address */
router.get('/:address', async (req, res) => {
  const { address } = req.params;
  if (!isEvmAddress(address)) return res.status(400).json({ error: 'Invalid address.' });

  try {
    const data = await gql<{ user: unknown }>(
      `query GetUser($id: ID!) {
        user(id: $id) {
          id address reputationScore accuracy totalVotes totalEarnings
          scamsDetected tier referralCode referredBy createdAt updatedAt
        }
      }`,
      { id: address.toLowerCase() },
    );

    if (!data.user) return res.status(404).json({ error: 'User not found.' });

    res.set('Cache-Control', 'private, max-age=30');
    res.json({ data: data.user });
  } catch (err) {
    console.error('[users] GET /:address', err);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

/** GET /api/v1/users/:address/votes */
router.get('/:address/votes', async (req, res) => {
  const { address } = req.params;
  if (!isEvmAddress(address)) return res.status(400).json({ error: 'Invalid address.' });

  try {
    const page  = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const data = await gql<{ votes: unknown[]; total: { id: string }[] }>(
      `query UserVotes($voter: ID!, $first: Int!, $skip: Int!) {
        votes(first: $first, skip: $skip, where: { voter: $voter },
              orderBy: createdAt, orderDirection: desc) {
          id project { id name logoUrl chain } voteType trustChange
          rewardEarned comment createdAt
        }
        total: votes(where: { voter: $voter }) { id }
      }`,
      { voter: address.toLowerCase(), first: limit, skip: (page - 1) * limit },
    );

    res.json({
      data: data.votes,
      pagination: { page, limit, total: data.total.length },
    });
  } catch (err) {
    console.error('[users] GET /:address/votes', err);
    res.status(500).json({ error: 'Failed to fetch votes.' });
  }
});

/** GET /api/v1/users/:address/accuracy */
router.get('/:address/accuracy', async (req, res) => {
  const { address } = req.params;
  if (!isEvmAddress(address)) return res.status(400).json({ error: 'Invalid address.' });

  try {
    const data = await gql<{ user: unknown }>(
      `query UserAccuracy($id: ID!) {
        user(id: $id) {
          id accuracy correctVotes totalVotes streakDays bestStreak
          accuracyHistory { date accuracy votes }
        }
      }`,
      { id: address.toLowerCase() },
    );

    if (!data.user) return res.status(404).json({ error: 'User not found.' });

    res.set('Cache-Control', 'private, max-age=60');
    res.json({ data: data.user });
  } catch (err) {
    console.error('[users] GET /:address/accuracy', err);
    res.status(500).json({ error: 'Failed to fetch accuracy.' });
  }
});

/** GET /api/v1/users/:address/earnings */
router.get('/:address/earnings', async (req, res) => {
  const { address } = req.params;
  if (!isEvmAddress(address)) return res.status(400).json({ error: 'Invalid address.' });

  try {
    const data = await gql<{ user: unknown }>(
      `query UserEarnings($id: ID!) {
        user(id: $id) {
          id totalEarnings pendingEarnings claimedEarnings
          earningsHistory { date amount source }
        }
      }`,
      { id: address.toLowerCase() },
    );

    if (!data.user) return res.status(404).json({ error: 'User not found.' });

    res.set('Cache-Control', 'private, max-age=60');
    res.json({ data: data.user });
  } catch (err) {
    console.error('[users] GET /:address/earnings', err);
    res.status(500).json({ error: 'Failed to fetch earnings.' });
  }
});

/** GET /api/v1/users/:address/reputation */
router.get('/:address/reputation', async (req, res) => {
  const { address } = req.params;
  if (!isEvmAddress(address)) return res.status(400).json({ error: 'Invalid address.' });

  try {
    const data = await gql<{ user: unknown }>(
      `query UserReputation($id: ID!) {
        user(id: $id) {
          id reputationScore tier
          reputationBreakdown { category score weight }
          reputationHistory { date score change reason }
          badges { id name description earnedAt }
        }
      }`,
      { id: address.toLowerCase() },
    );

    if (!data.user) return res.status(404).json({ error: 'User not found.' });

    res.set('Cache-Control', 'private, max-age=60');
    res.json({ data: data.user });
  } catch (err) {
    console.error('[users] GET /:address/reputation', err);
    res.status(500).json({ error: 'Failed to fetch reputation.' });
  }
});

/** GET /api/v1/users/:address/referrals */
router.get('/:address/referrals', async (req, res) => {
  const { address } = req.params;
  if (!isEvmAddress(address)) return res.status(400).json({ error: 'Invalid address.' });

  try {
    const data = await gql<{ user: unknown }>(
      `query UserReferrals($id: ID!) {
        user(id: $id) {
          id referralCode totalReferrals referralEarnings
          referrals { id address createdAt earningsGenerated }
        }
      }`,
      { id: address.toLowerCase() },
    );

    if (!data.user) return res.status(404).json({ error: 'User not found.' });

    res.set('Cache-Control', 'private, max-age=120');
    res.json({ data: data.user });
  } catch (err) {
    console.error('[users] GET /:address/referrals', err);
    res.status(500).json({ error: 'Failed to fetch referrals.' });
  }
});

export default router;
