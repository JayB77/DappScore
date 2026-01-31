import { Router } from 'express';
import { GraphQLService } from '../services/graphql';

const router = Router();
const graphql = new GraphQLService();

// GET /api/stats/global - Get global platform stats
router.get('/global', async (req, res) => {
  try {
    const stats = await graphql.getGlobalStats();
    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching global stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/stats/daily - Get daily stats for charts
router.get('/daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await graphql.getDailyStats(days);
    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    res.status(500).json({ error: 'Failed to fetch daily stats' });
  }
});

// GET /api/stats/token - Get token stats
router.get('/token', async (req, res) => {
  try {
    const stats = await graphql.getTokenStats();
    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching token stats:', error);
    res.status(500).json({ error: 'Failed to fetch token stats' });
  }
});

// GET /api/stats/insurance - Get insurance pool stats
router.get('/insurance', async (req, res) => {
  try {
    const stats = await graphql.getInsurancePoolStats();
    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching insurance stats:', error);
    res.status(500).json({ error: 'Failed to fetch insurance stats' });
  }
});

// GET /api/stats/predictions - Get prediction market stats
router.get('/predictions', async (req, res) => {
  try {
    const stats = await graphql.getPredictionStats();
    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching prediction stats:', error);
    res.status(500).json({ error: 'Failed to fetch prediction stats' });
  }
});

// GET /api/stats/bounties - Get bounty system stats
router.get('/bounties', async (req, res) => {
  try {
    const stats = await graphql.getBountyStats();
    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching bounty stats:', error);
    res.status(500).json({ error: 'Failed to fetch bounty stats' });
  }
});

export { router as statsRoutes };
