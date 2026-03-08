import { Router } from 'express';
import { z } from 'zod';
import { gql } from '../lib/graphql';

const router = Router();

// ── Validation ────────────────────────────────────────────────────────────────

const searchSchema = z.object({
  query:      z.string().optional(),
  category:   z.string().optional(),
  chain:      z.string().optional(),
  trustLevel: z.coerce.number().int().min(0).max(5).optional(),
  status:     z.coerce.number().int().optional(),
  sortBy:     z.enum(['trustScore', 'votes', 'newest', 'endingSoon']).optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
});

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/v1/projects */
router.get('/', async (req, res) => {
  try {
    const p = searchSchema.parse(req.query);
    const offset = (p.page - 1) * p.limit;

    const data = await gql<{ projects: unknown[]; projectCount: { count: number } }>(
      `query SearchProjects(
        $first: Int!, $skip: Int!,
        $category: String, $chain: String,
        $trustLevel: Int, $status: Int,
        $orderBy: Project_orderBy, $orderDirection: OrderDirection
      ) {
        projects(
          first: $first skip: $skip
          where: {
            category: $category chain: $chain
            trustLevel: $trustLevel status: $status
          }
          orderBy: $orderBy orderDirection: $orderDirection
        ) {
          id name logoUrl category chain trustLevel status votes totalVoters
          contractAddress createdAt updatedAt
        }
        projectCount: _meta { block { number } }
      }`,
      {
        first: p.limit,
        skip: offset,
        category: p.category,
        chain: p.chain,
        trustLevel: p.trustLevel,
        status: p.status,
        orderBy: p.sortBy === 'votes' ? 'votes'
          : p.sortBy === 'newest' ? 'createdAt'
          : p.sortBy === 'endingSoon' ? 'endDate'
          : 'trustScore',
        orderDirection: p.sortBy === 'newest' ? 'desc' : 'desc',
      },
    );

    res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.json({
      data: data.projects,
      pagination: { page: p.page, limit: p.limit },
    });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ error: 'Invalid parameters', details: err.errors });
    console.error('[projects] GET /', err);
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

/** GET /api/v1/projects/trending */
router.get('/trending', async (req, res) => {
  try {
    const timeframe = (req.query.timeframe as string) || '24h';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const since = timeframe === '7d'
      ? Math.floor(Date.now() / 1000) - 7 * 86400
      : Math.floor(Date.now() / 1000) - 86400;

    const data = await gql<{ projects: unknown[] }>(
      `query TrendingProjects($first: Int!, $since: Int!) {
        projects(first: $first, orderBy: votes, orderDirection: desc,
                 where: { updatedAt_gte: $since }) {
          id name logoUrl category chain trustLevel votes totalVoters createdAt
        }
      }`,
      { first: limit, since },
    );

    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.json({ data: data.projects });
  } catch (err) {
    console.error('[projects] GET /trending', err);
    res.status(500).json({ error: 'Failed to fetch trending projects.' });
  }
});

/** GET /api/v1/projects/:id */
router.get('/:id', async (req, res) => {
  try {
    const data = await gql<{ project: unknown }>(
      `query GetProject($id: ID!) {
        project(id: $id) {
          id name description logoUrl websiteUrl twitterUrl telegramUrl
          category chain trustLevel status votes totalVoters
          contractAddress createdAt updatedAt
          tags riskFlags auditUrls team { name role }
        }
      }`,
      { id: req.params.id },
    );

    if (!data.project) return res.status(404).json({ error: 'Project not found.' });

    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.json({ data: data.project });
  } catch (err) {
    console.error('[projects] GET /:id', err);
    res.status(500).json({ error: 'Failed to fetch project.' });
  }
});

/** GET /api/v1/projects/:id/votes */
router.get('/:id/votes', async (req, res) => {
  try {
    const page  = parseInt(req.query.page  as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const data = await gql<{ votes: unknown[]; total: { id: string }[] }>(
      `query ProjectVotes($projectId: ID!, $first: Int!, $skip: Int!) {
        votes(first: $first, skip: $skip, where: { project: $projectId },
              orderBy: createdAt, orderDirection: desc) {
          id voter { id } voteType trustChange comment createdAt
        }
        total: votes(where: { project: $projectId }) { id }
      }`,
      { projectId: req.params.id, first: limit, skip: (page - 1) * limit },
    );

    res.json({
      data: data.votes,
      pagination: { page, limit, total: data.total.length },
    });
  } catch (err) {
    console.error('[projects] GET /:id/votes', err);
    res.status(500).json({ error: 'Failed to fetch votes.' });
  }
});

/** GET /api/v1/projects/:id/trust-history */
router.get('/:id/trust-history', async (req, res) => {
  try {
    const data = await gql<{ trustEvents: unknown[] }>(
      `query TrustHistory($projectId: ID!) {
        trustEvents(where: { project: $projectId }, orderBy: timestamp, orderDirection: asc) {
          id oldLevel newLevel reason triggeredBy timestamp
        }
      }`,
      { projectId: req.params.id },
    );

    res.set('Cache-Control', 'public, s-maxage=120');
    res.json({ data: data.trustEvents });
  } catch (err) {
    console.error('[projects] GET /:id/trust-history', err);
    res.status(500).json({ error: 'Failed to fetch trust history.' });
  }
});

/** GET /api/v1/projects/similar/:address */
router.get('/similar/:address', async (req, res) => {
  try {
    // Return projects on same chain with similar category as a starting point
    const data = await gql<{ project: { category: string; chain: string } | null }>(
      `query ProjectByAddress($addr: String!) {
        project: projects(first: 1, where: { contractAddress: $addr }) {
          category chain
        }
      }`,
      { addr: req.params.address.toLowerCase() },
    );

    if (!data.project) return res.status(404).json({ error: 'Contract not found.' });

    const similar = await gql<{ projects: unknown[] }>(
      `query SimilarProjects($category: String!, $chain: String!) {
        projects(first: 10, where: { category: $category, chain: $chain },
                 orderBy: trustScore, orderDirection: desc) {
          id name logoUrl category chain trustLevel votes
        }
      }`,
      { category: data.project.category, chain: data.project.chain },
    );

    res.set('Cache-Control', 'public, s-maxage=300');
    res.json({ data: similar.projects });
  } catch (err) {
    console.error('[projects] GET /similar/:address', err);
    res.status(500).json({ error: 'Failed to find similar projects.' });
  }
});

export default router;
