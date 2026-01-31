import { createCanvas, registerFont } from 'canvas';
import path from 'path';

// Trust level colors
const TRUST_COLORS: Record<number, string> = {
  0: '#6B7280', // NewListing - Gray
  1: '#10B981', // Trusted - Green
  2: '#F59E0B', // Neutral - Yellow
  3: '#F97316', // Suspicious - Orange
  4: '#EF4444', // SuspectedScam - Red
  5: '#DC2626', // ProbableScam - Dark Red
};

const TRUST_LABELS: Record<number, string> = {
  0: 'New Listing',
  1: 'Trusted',
  2: 'Neutral',
  3: 'Suspicious',
  4: 'Suspected Scam',
  5: 'Probable Scam',
};

interface Project {
  id: string;
  name: string;
  symbol?: string;
  category?: string;
  trustLevel: number;
  upvotes: string;
  downvotes: string;
  totalVoters: string;
}

interface User {
  address: string;
  totalVotes: string;
  accurateVotes: string;
  scamsIdentified: string;
  reputationPoints: string;
  totalEarnings: string;
}

interface Market {
  id: string;
  project: { name: string };
  totalScamBets: string;
  totalLegitBets: string;
  status: number;
  outcome: number;
  resolutionDeadline: string;
}

export class ShareCardService {
  private readonly WIDTH = 1200;
  private readonly HEIGHT = 630;
  private readonly BG_COLOR = '#0F172A'; // Dark blue
  private readonly ACCENT_COLOR = '#FACC15'; // Yellow
  private readonly TEXT_COLOR = '#F8FAFC';
  private readonly MUTED_COLOR = '#94A3B8';

  async generateProjectCard(project: Project): Promise<Buffer> {
    const canvas = createCanvas(this.WIDTH, this.HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = this.BG_COLOR;
    ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

    // Gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, this.WIDTH, this.HEIGHT);
    gradient.addColorStop(0, 'rgba(250, 204, 21, 0.1)');
    gradient.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

    // DappScore logo/text
    ctx.fillStyle = this.ACCENT_COLOR;
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('DappScore', 60, 70);

    // Trust score circle
    const trustScore = this.calculateTrustScore(project);
    const trustColor = TRUST_COLORS[project.trustLevel];
    const centerX = this.WIDTH - 200;
    const centerY = 200;
    const radius = 100;

    // Outer ring
    ctx.strokeStyle = trustColor;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Trust percentage
    ctx.fillStyle = trustColor;
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${trustScore}%`, centerX, centerY + 20);

    // Trust label
    ctx.fillStyle = this.MUTED_COLOR;
    ctx.font = '24px sans-serif';
    ctx.fillText(TRUST_LABELS[project.trustLevel], centerX, centerY + 60);

    // Reset text align
    ctx.textAlign = 'left';

    // Project name
    ctx.fillStyle = this.TEXT_COLOR;
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(project.name, 60, 200);

    // Symbol and category
    ctx.fillStyle = this.MUTED_COLOR;
    ctx.font = '28px sans-serif';
    const subtitle = [project.symbol, project.category].filter(Boolean).join(' • ');
    ctx.fillText(subtitle, 60, 250);

    // Vote stats
    const upvotes = parseInt(project.upvotes);
    const downvotes = parseInt(project.downvotes);

    ctx.fillStyle = '#10B981';
    ctx.font = '32px sans-serif';
    ctx.fillText(`▲ ${upvotes.toLocaleString()}`, 60, 350);

    ctx.fillStyle = '#EF4444';
    ctx.fillText(`▼ ${downvotes.toLocaleString()}`, 250, 350);

    ctx.fillStyle = this.MUTED_COLOR;
    ctx.fillText(`${parseInt(project.totalVoters).toLocaleString()} voters`, 440, 350);

    // Vote bar
    const barY = 400;
    const barWidth = 600;
    const barHeight = 20;
    const total = upvotes + downvotes;
    const upWidth = total > 0 ? (upvotes / total) * barWidth : barWidth / 2;

    // Background
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(60, barY, barWidth, barHeight);

    // Up portion
    ctx.fillStyle = '#10B981';
    ctx.fillRect(60, barY, upWidth, barHeight);

    // Down portion
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(60 + upWidth, barY, barWidth - upWidth, barHeight);

    // Footer
    ctx.fillStyle = this.MUTED_COLOR;
    ctx.font = '20px sans-serif';
    ctx.fillText('dappscore.io', 60, this.HEIGHT - 40);

    ctx.fillStyle = this.ACCENT_COLOR;
    ctx.fillText('Community-driven trust scores', 220, this.HEIGHT - 40);

    return canvas.toBuffer('image/png');
  }

  async generateUserCard(user: User): Promise<Buffer> {
    const canvas = createCanvas(this.WIDTH, this.HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = this.BG_COLOR;
    ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

    // DappScore logo
    ctx.fillStyle = this.ACCENT_COLOR;
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('DappScore', 60, 70);

    // User address (truncated)
    ctx.fillStyle = this.TEXT_COLOR;
    ctx.font = 'bold 48px sans-serif';
    const truncatedAddress = `${user.address.slice(0, 6)}...${user.address.slice(-4)}`;
    ctx.fillText(truncatedAddress, 60, 180);

    // Stats grid
    const stats = [
      { label: 'Reputation', value: parseInt(user.reputationPoints).toLocaleString(), color: this.ACCENT_COLOR },
      { label: 'Total Votes', value: parseInt(user.totalVotes).toLocaleString(), color: this.TEXT_COLOR },
      { label: 'Accurate Votes', value: parseInt(user.accurateVotes).toLocaleString(), color: '#10B981' },
      { label: 'Scams Found', value: parseInt(user.scamsIdentified).toLocaleString(), color: '#EF4444' },
      { label: 'SCORE Earned', value: this.formatTokenAmount(user.totalEarnings), color: this.ACCENT_COLOR },
    ];

    const gridX = 60;
    const gridY = 280;
    const cellWidth = 220;
    const cellHeight = 120;

    stats.forEach((stat, i) => {
      const x = gridX + (i % 3) * cellWidth;
      const y = gridY + Math.floor(i / 3) * cellHeight;

      ctx.fillStyle = stat.color;
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(stat.value, x, y);

      ctx.fillStyle = this.MUTED_COLOR;
      ctx.font = '20px sans-serif';
      ctx.fillText(stat.label, x, y + 30);
    });

    // Accuracy percentage
    const accuracy = parseInt(user.totalVotes) > 0
      ? Math.round((parseInt(user.accurateVotes) / parseInt(user.totalVotes)) * 100)
      : 0;

    ctx.fillStyle = this.TEXT_COLOR;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`${accuracy}% Accuracy`, this.WIDTH - 300, 180);

    // Footer
    ctx.fillStyle = this.MUTED_COLOR;
    ctx.font = '20px sans-serif';
    ctx.fillText('dappscore.io', 60, this.HEIGHT - 40);

    return canvas.toBuffer('image/png');
  }

  async generateLeaderboardCard(leaderboard: any[], type: string): Promise<Buffer> {
    const canvas = createCanvas(this.WIDTH, this.HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = this.BG_COLOR;
    ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

    // Title
    ctx.fillStyle = this.ACCENT_COLOR;
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('DappScore', 60, 70);

    const typeLabels: Record<string, string> = {
      reputation: 'Top Curators',
      scamHunters: 'Top Scam Hunters',
      accuracy: 'Most Accurate',
      earnings: 'Top Earners',
    };

    ctx.fillStyle = this.TEXT_COLOR;
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(typeLabels[type] || 'Leaderboard', 60, 140);

    // Leaderboard entries
    const startY = 200;
    const rowHeight = 50;

    leaderboard.slice(0, 8).forEach((entry, i) => {
      const y = startY + i * rowHeight;
      const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`;

      ctx.font = '28px sans-serif';
      ctx.fillStyle = i < 3 ? this.ACCENT_COLOR : this.TEXT_COLOR;
      ctx.fillText(medal, 60, y);

      const address = `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`;
      ctx.fillStyle = this.TEXT_COLOR;
      ctx.fillText(address, 130, y);

      ctx.fillStyle = this.ACCENT_COLOR;
      ctx.textAlign = 'right';
      ctx.fillText(parseInt(entry.score).toLocaleString(), this.WIDTH - 60, y);
      ctx.textAlign = 'left';
    });

    // Footer
    ctx.fillStyle = this.MUTED_COLOR;
    ctx.font = '20px sans-serif';
    ctx.fillText('dappscore.io', 60, this.HEIGHT - 40);

    return canvas.toBuffer('image/png');
  }

  async generatePredictionCard(market: Market): Promise<Buffer> {
    const canvas = createCanvas(this.WIDTH, this.HEIGHT);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = this.BG_COLOR;
    ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

    // Title
    ctx.fillStyle = this.ACCENT_COLOR;
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('DappScore Predictions', 60, 70);

    // Project name
    ctx.fillStyle = this.TEXT_COLOR;
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(market.project.name, 60, 160);

    // Status
    const statusLabels = ['Active', 'Closed', 'Resolved', 'Cancelled'];
    ctx.fillStyle = market.status === 0 ? '#10B981' : this.MUTED_COLOR;
    ctx.font = '24px sans-serif';
    ctx.fillText(statusLabels[market.status], 60, 200);

    // Odds visualization
    const scamBets = parseInt(market.totalScamBets);
    const legitBets = parseInt(market.totalLegitBets);
    const total = scamBets + legitBets;
    const scamPct = total > 0 ? Math.round((scamBets / total) * 100) : 50;
    const legitPct = 100 - scamPct;

    // Bar
    const barY = 300;
    const barWidth = 800;
    const barHeight = 60;

    ctx.fillStyle = '#EF4444';
    ctx.fillRect(60, barY, (scamPct / 100) * barWidth, barHeight);

    ctx.fillStyle = '#10B981';
    ctx.fillRect(60 + (scamPct / 100) * barWidth, barY, (legitPct / 100) * barWidth, barHeight);

    // Labels
    ctx.fillStyle = this.TEXT_COLOR;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`SCAM ${scamPct}%`, 80, barY + 40);
    ctx.textAlign = 'right';
    ctx.fillText(`${legitPct}% LEGIT`, 60 + barWidth - 20, barY + 40);
    ctx.textAlign = 'left';

    // Pool size
    ctx.fillStyle = this.MUTED_COLOR;
    ctx.font = '24px sans-serif';
    ctx.fillText(`Total Pool: ${this.formatTokenAmount(total.toString())} SCORE`, 60, barY + 100);

    // Deadline
    const deadline = new Date(parseInt(market.resolutionDeadline) * 1000);
    ctx.fillText(`Resolves: ${deadline.toLocaleDateString()}`, 60, barY + 140);

    // Footer
    ctx.fillText('dappscore.io', 60, this.HEIGHT - 40);

    return canvas.toBuffer('image/png');
  }

  private calculateTrustScore(project: Project): number {
    const upvotes = parseInt(project.upvotes);
    const downvotes = parseInt(project.downvotes);
    const total = upvotes + downvotes;

    if (total === 0) return 50;
    return Math.round((upvotes / total) * 100);
  }

  private formatTokenAmount(wei: string): string {
    const amount = parseInt(wei) / 1e18;
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toFixed(0);
  }
}
