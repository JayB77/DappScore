import { Router } from 'express';
import { GraphQLService } from '../services/graphql';
import { z } from 'zod';

const router = Router();
const graphql = new GraphQLService();

// Validation schemas
const searchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  chain: z.string().optional(),
  trustLevel: z.string().optional(),
  status: z.string().optional(),
  sortBy: z.enum(['trustScore', 'votes', 'newest', 'endingSoon']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// GET /api/projects - Search and filter projects
router.get('/', async (req, res) => {
  try {
    const params = searchSchema.parse(req.query);

    const projects = await graphql.searchProjects({
      query: params.query,
      category: params.category,
      chain: params.chain,
      trustLevel: params.trustLevel ? parseInt(params.trustLevel) : undefined,
      status: params.status ? parseInt(params.status) : undefined,
      sortBy: params.sortBy,
      offset: (params.page - 1) * params.limit,
      limit: params.limit,
    });

    res.json({
      data: projects.data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: projects.total,
        pages: Math.ceil(projects.total / params.limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
    }
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/by-address/:address - Look up project by contract address
// Must be declared before /:id to avoid route collision
router.get('/by-address/:address', async (req, res) => {
  const { address } = req.params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid contract address' });
  }
  try {
    const project = await graphql.getProjectByAddress(address);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ data: project });
  } catch (error) {
    console.error('Error fetching project by address:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// GET /api/projects/:id - Get project details
router.get('/:id', async (req, res) => {
  try {
    const project = await graphql.getProject(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ data: project });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// GET /api/projects/:id/votes - Get project votes
router.get('/:id/votes', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const votes = await graphql.getProjectVotes(req.params.id, (page - 1) * limit, limit);

    res.json({
      data: votes.data,
      pagination: {
        page,
        limit,
        total: votes.total,
      },
    });
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// GET /api/projects/:id/trust-history - Get trust level history
router.get('/:id/trust-history', async (req, res) => {
  try {
    const history = await graphql.getTrustLevelHistory(req.params.id);
    res.json({ data: history });
  } catch (error) {
    console.error('Error fetching trust history:', error);
    res.status(500).json({ error: 'Failed to fetch trust history' });
  }
});

// GET /api/projects/similar/:address - Find similar contracts
router.get('/similar/:address', async (req, res) => {
  try {
    const { ScamPatternService } = await import('../services/scam-patterns');
    const scamService = new ScamPatternService();

    const similar = await scamService.findSimilarContracts(req.params.address);

    res.json({ data: similar });
  } catch (error) {
    console.error('Error finding similar contracts:', error);
    res.status(500).json({ error: 'Failed to find similar contracts' });
  }
});

// GET /api/projects/trending - Get trending projects
router.get('/trending', async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as string) || '24h';
    const limit = parseInt(req.query.limit as string) || 10;

    const trending = await graphql.getTrendingProjects(timeframe, limit);

    res.json({ data: trending });
  } catch (error) {
    console.error('Error fetching trending projects:', error);
    res.status(500).json({ error: 'Failed to fetch trending projects' });
  }
});

export { router as projectRoutes };
