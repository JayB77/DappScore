import { Router } from 'express';
import { GraphQLService } from '../services/graphql';
import { isAddress } from 'viem';

const router = Router();
const graphql = new GraphQLService();

// GET /api/users/:address - Get user profile
router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const user = await graphql.getUser(address);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /api/users/:address/votes - Get user's voting history
router.get('/:address/votes', async (req, res) => {
  try {
    const { address } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const votes = await graphql.getUserVotes(address, (page - 1) * limit, limit);

    res.json({
      data: votes.data,
      pagination: {
        page,
        limit,
        total: votes.total,
      },
    });
  } catch (error) {
    console.error('Error fetching user votes:', error);
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// GET /api/users/:address/accuracy - Get user's voting accuracy
router.get('/:address/accuracy', async (req, res) => {
  try {
    const { address } = req.params;

    if (!isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const accuracy = await graphql.getUserAccuracy(address);

    res.json({ data: accuracy });
  } catch (error) {
    console.error('Error fetching accuracy:', error);
    res.status(500).json({ error: 'Failed to fetch accuracy' });
  }
});

// GET /api/users/:address/earnings - Get user's earnings history
router.get('/:address/earnings', async (req, res) => {
  try {
    const { address } = req.params;

    if (!isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const earnings = await graphql.getUserEarnings(address);

    res.json({ data: earnings });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// GET /api/users/:address/reputation - Get detailed reputation info
router.get('/:address/reputation', async (req, res) => {
  try {
    const { address } = req.params;

    if (!isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const reputation = await graphql.getUserReputation(address);

    res.json({ data: reputation });
  } catch (error) {
    console.error('Error fetching reputation:', error);
    res.status(500).json({ error: 'Failed to fetch reputation' });
  }
});

// GET /api/users/:address/referrals - Get affiliate referrals
router.get('/:address/referrals', async (req, res) => {
  try {
    const { address } = req.params;

    if (!isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const referrals = await graphql.getUserReferrals(address);

    res.json({ data: referrals });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// GET /api/users/leaderboard/:type - Get leaderboard
router.get('/leaderboard/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!['reputation', 'scamHunters', 'accuracy', 'earnings'].includes(type)) {
      return res.status(400).json({ error: 'Invalid leaderboard type' });
    }

    const leaderboard = await graphql.getLeaderboard(type, limit);

    res.json({ data: leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export { router as userRoutes };
