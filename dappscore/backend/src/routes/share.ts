import { Router } from 'express';
import { ShareCardService } from '../services/share-cards';
import { GraphQLService } from '../services/graphql';

const router = Router();
const shareService = new ShareCardService();
const graphql = new GraphQLService();

// GET /api/share/project/:id - Generate shareable project card
router.get('/project/:id', async (req, res) => {
  try {
    const project = await graphql.getProject(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const imageBuffer = await shareService.generateProjectCard(project);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache 5 mins
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error generating project card:', error);
    res.status(500).json({ error: 'Failed to generate card' });
  }
});

// GET /api/share/user/:address - Generate shareable user stats card
router.get('/user/:address', async (req, res) => {
  try {
    const user = await graphql.getUser(req.params.address);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const imageBuffer = await shareService.generateUserCard(user);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error generating user card:', error);
    res.status(500).json({ error: 'Failed to generate card' });
  }
});

// GET /api/share/leaderboard - Generate leaderboard card
router.get('/leaderboard', async (req, res) => {
  try {
    const type = (req.query.type as string) || 'reputation';
    const leaderboard = await graphql.getLeaderboard(type, 10);

    const imageBuffer = await shareService.generateLeaderboardCard(leaderboard, type);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error generating leaderboard card:', error);
    res.status(500).json({ error: 'Failed to generate card' });
  }
});

// GET /api/share/prediction/:marketId - Generate prediction market card
router.get('/prediction/:marketId', async (req, res) => {
  try {
    const market = await graphql.getMarket(req.params.marketId);

    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const imageBuffer = await shareService.generatePredictionCard(market);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60'); // Shorter cache for live markets
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error generating prediction card:', error);
    res.status(500).json({ error: 'Failed to generate card' });
  }
});

export { router as shareRoutes };
