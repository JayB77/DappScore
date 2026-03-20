/**
 * GraphQL Service
 *
 * Queries the DappScore subgraph via The Graph.
 * SUBGRAPH_URL should be set in .env — e.g.
 *   SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/dappscore/dappscore
 */

import { GraphQLClient, gql } from 'graphql-request';

const SUBGRAPH_URL =
  process.env.SUBGRAPH_URL || 'http://localhost:8000/subgraphs/name/dappscore/dappscore';

export class GraphQLService {
  private client: GraphQLClient;

  constructor() {
    this.client = new GraphQLClient(SUBGRAPH_URL);
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  async searchProjects(params: {
    query?: string;
    category?: string;
    chain?: string;
    trustLevel?: number;
    status?: number;
    sortBy?: string;
    offset: number;
    limit: number;
  }): Promise<{ data: any[]; total: number }> {
    const q = gql`
      query SearchProjects($first: Int, $skip: Int) {
        projects(first: $first, skip: $skip, orderBy: trustScore, orderDirection: desc) {
          id name category chain trustScore status votesFor votesAgainst contractAddress
        }
        projectCount { count }
      }
    `;
    const res: any = await this.client.request(q, {
      first: params.limit,
      skip: params.offset,
    });
    return { data: res.projects ?? [], total: res.projectCount?.count ?? 0 };
  }

  async getProjectByAddress(address: string): Promise<any | null> {
    const q = gql`
      query GetProjectByAddress($addr: String!) {
        projects(where: { contractAddress: $addr }, first: 1) {
          id name description category chain contractAddress
          trustScore trustLevel status votesFor votesAgainst
          createdAt updatedAt
        }
      }
    `;
    const res: any = await this.client.request(q, { addr: address.toLowerCase() });
    return res.projects?.[0] ?? null;
  }

  async getProject(id: string): Promise<any | null> {
    const q = gql`
      query GetProject($id: ID!) {
        project(id: $id) {
          id name description category chain contractAddress
          trustScore trustLevel status votesFor votesAgainst
          createdAt updatedAt
        }
      }
    `;
    const res: any = await this.client.request(q, { id });
    return res.project ?? null;
  }

  async getProjectVotes(
    id: string,
    offset: number,
    limit: number,
  ): Promise<{ data: any[]; total: number }> {
    const q = gql`
      query GetProjectVotes($projectId: String, $first: Int, $skip: Int) {
        votes(where: { project: $projectId }, first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
          id voter { id } isPositive stake timestamp
        }
        voteCount: votes(where: { project: $projectId }) { id }
      }
    `;
    const res: any = await this.client.request(q, { projectId: id, first: limit, skip: offset });
    return { data: res.votes ?? [], total: res.voteCount?.length ?? 0 };
  }

  async getTrustLevelHistory(id: string): Promise<any[]> {
    const q = gql`
      query GetTrustHistory($projectId: String) {
        trustLevelChanges(where: { project: $projectId }, orderBy: timestamp, orderDirection: asc) {
          id previousLevel newLevel timestamp
        }
      }
    `;
    const res: any = await this.client.request(q, { projectId: id });
    return res.trustLevelChanges ?? [];
  }

  async getTrendingProjects(timeframe: string, limit: number): Promise<any[]> {
    const q = gql`
      query GetTrending($first: Int) {
        projects(first: $first, orderBy: votesFor, orderDirection: desc) {
          id name category chain trustScore votesFor votesAgainst
        }
      }
    `;
    const res: any = await this.client.request(q, { first: limit });
    return res.projects ?? [];
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async getUser(address: string): Promise<any | null> {
    const q = gql`
      query GetUser($id: ID!) {
        user(id: $id) {
          id address reputation totalVotes correctVotes earningsTotal referralCount
        }
      }
    `;
    const res: any = await this.client.request(q, { id: address.toLowerCase() });
    return res.user ?? null;
  }

  async getUserVotes(
    address: string,
    offset: number,
    limit: number,
  ): Promise<{ data: any[]; total: number }> {
    const q = gql`
      query GetUserVotes($voter: String, $first: Int, $skip: Int) {
        votes(where: { voter: $voter }, first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
          id project { id name } isPositive stake timestamp outcome
        }
      }
    `;
    const res: any = await this.client.request(q, {
      voter: address.toLowerCase(),
      first: limit,
      skip: offset,
    });
    return { data: res.votes ?? [], total: res.votes?.length ?? 0 };
  }

  async getUserAccuracy(address: string): Promise<any> {
    const user = await this.getUser(address);
    if (!user) return null;
    const accuracy =
      user.totalVotes > 0 ? (user.correctVotes / user.totalVotes) * 100 : 0;
    return { address, totalVotes: user.totalVotes, correctVotes: user.correctVotes, accuracy };
  }

  async getUserEarnings(address: string): Promise<any[]> {
    const q = gql`
      query GetUserEarnings($voter: String) {
        rewardDistributions(where: { recipient: $voter }, orderBy: timestamp, orderDirection: desc) {
          id amount timestamp reason
        }
      }
    `;
    const res: any = await this.client.request(q, { voter: address.toLowerCase() });
    return res.rewardDistributions ?? [];
  }

  async getUserReputation(address: string): Promise<any | null> {
    return this.getUser(address);
  }

  async getUserReferrals(address: string): Promise<any[]> {
    const q = gql`
      query GetReferrals($referrer: String) {
        affiliateReferrals(where: { referrer: $referrer }) {
          id referee timestamp reward
        }
      }
    `;
    const res: any = await this.client.request(q, { referrer: address.toLowerCase() });
    return res.affiliateReferrals ?? [];
  }

  async getLeaderboard(type: string, limit: number): Promise<any[]> {
    const orderBy: Record<string, string> = {
      reputation: 'reputation',
      scamHunters: 'correctVotes',
      accuracy: 'reputation',
      earnings: 'earningsTotal',
    };
    const q = gql`
      query GetLeaderboard($first: Int, $orderBy: User_orderBy) {
        users(first: $first, orderBy: $orderBy, orderDirection: desc) {
          id address reputation totalVotes correctVotes earningsTotal
        }
      }
    `;
    const res: any = await this.client.request(q, {
      first: limit,
      orderBy: orderBy[type] ?? 'reputation',
    });
    return res.users ?? [];
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getGlobalStats(): Promise<any> {
    const q = gql`
      {
        globalStats(id: "global") {
          totalProjects totalUsers totalVotes totalScamsDetected
          totalInsurancePayout totalBounties
        }
      }
    `;
    const res: any = await this.client.request(q);
    return res.globalStats ?? {};
  }

  async getDailyStats(days: number): Promise<any[]> {
    const q = gql`
      query GetDailyStats($first: Int) {
        dailyStats(first: $first, orderBy: date, orderDirection: desc) {
          id date newProjects newUsers newVotes scamsDetected
        }
      }
    `;
    const res: any = await this.client.request(q, { first: days });
    return res.dailyStats ?? [];
  }

  async getTokenStats(): Promise<any> {
    const q = gql`
      {
        tokenStats(id: "global") {
          totalSupply circulatingSupply totalStaked totalBurned
        }
      }
    `;
    const res: any = await this.client.request(q);
    return res.tokenStats ?? {};
  }

  async getInsurancePoolStats(): Promise<any> {
    const q = gql`
      {
        insurancePool(id: "global") {
          totalDeposited totalPaid activeClaimCount
        }
      }
    `;
    const res: any = await this.client.request(q);
    return res.insurancePool ?? {};
  }

  async getPredictionStats(): Promise<any> {
    const q = gql`
      {
        predictionStats(id: "global") {
          totalMarkets resolvedMarkets openMarkets totalVolume
        }
      }
    `;
    const res: any = await this.client.request(q);
    return res.predictionStats ?? {};
  }

  async getBountyStats(): Promise<any> {
    const q = gql`
      {
        bountyStats(id: "global") {
          totalBounties activeBounties completedBounties totalRewarded
        }
      }
    `;
    const res: any = await this.client.request(q);
    return res.bountyStats ?? {};
  }

  // ── Markets ───────────────────────────────────────────────────────────────

  async getMarket(marketId: string): Promise<any | null> {
    const q = gql`
      query GetMarket($id: ID!) {
        predictionMarket(id: $id) {
          id question resolutionDate totalYesStake totalNoStake status resolvedOutcome
          project { id name }
        }
      }
    `;
    const res: any = await this.client.request(q, { id: marketId });
    return res.predictionMarket ?? null;
  }
}
