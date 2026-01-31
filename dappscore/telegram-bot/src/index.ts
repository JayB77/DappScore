import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { GraphQLClient, gql } from 'graphql-request';
import { isAddress } from 'viem';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUBGRAPH_URL = process.env.SUBGRAPH_URL || 'http://localhost:8000/subgraphs/name/dappscore';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://dappscore.io';

if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const graphql = new GraphQLClient(SUBGRAPH_URL);

// Trust level emojis and labels
const TRUST_LEVELS: Record<number, { emoji: string; label: string }> = {
  0: { emoji: '⚪', label: 'New Listing' },
  1: { emoji: '🟢', label: 'Trusted' },
  2: { emoji: '🟡', label: 'Neutral' },
  3: { emoji: '🟠', label: 'Suspicious' },
  4: { emoji: '🔴', label: 'Suspected Scam' },
  5: { emoji: '⛔', label: 'Probable Scam' },
};

// Start command
bot.start((ctx) => {
  ctx.reply(
    `👋 Welcome to DappScore Bot!\n\n` +
    `I help you check trust scores for crypto projects.\n\n` +
    `Commands:\n` +
    `/check <name or ID> - Check project trust score\n` +
    `/address <0x...> - Look up by contract address\n` +
    `/top - Show top trusted projects\n` +
    `/scams - Show recently flagged scams\n` +
    `/stats - Platform statistics\n` +
    `/help - Show this message\n\n` +
    `You can also just send me a project name or contract address!`
  );
});

// Help command
bot.help((ctx) => {
  ctx.reply(
    `📖 DappScore Bot Commands:\n\n` +
    `/check <name> - Check project by name\n` +
    `/address <0x...> - Look up by contract\n` +
    `/top [count] - Top trusted projects (default: 5)\n` +
    `/scams [count] - Recent scams (default: 5)\n` +
    `/user <0x...> - User reputation\n` +
    `/stats - Platform stats\n` +
    `/markets - Active prediction markets\n\n` +
    `🔗 Website: ${FRONTEND_URL}`
  );
});

// Check project by name
bot.command('check', async (ctx) => {
  const query = ctx.message.text.replace('/check', '').trim();

  if (!query) {
    return ctx.reply('Usage: /check <project name or ID>');
  }

  await searchAndReply(ctx, query);
});

// Check by address
bot.command('address', async (ctx) => {
  const address = ctx.message.text.replace('/address', '').trim();

  if (!address || !isAddress(address)) {
    return ctx.reply('Please provide a valid contract address.\nUsage: /address 0x...');
  }

  await lookupByAddress(ctx, address);
});

// Top projects
bot.command('top', async (ctx) => {
  const countStr = ctx.message.text.replace('/top', '').trim();
  const count = parseInt(countStr) || 5;

  try {
    const query = gql`
      query TopProjects($first: Int!) {
        projects(
          first: $first
          where: { trustLevel: 1, status: 1 }
          orderBy: upvotes
          orderDirection: desc
        ) {
          id
          name
          symbol
          trustLevel
          upvotes
          downvotes
        }
      }
    `;

    const data: any = await graphql.request(query, { first: Math.min(count, 10) });

    if (!data.projects?.length) {
      return ctx.reply('No trusted projects found yet.');
    }

    let message = '🏆 Top Trusted Projects:\n\n';

    data.projects.forEach((p: any, i: number) => {
      const score = calculateTrustScore(p.upvotes, p.downvotes);
      message += `${i + 1}. ${p.name} (${p.symbol || 'N/A'})\n`;
      message += `   ${TRUST_LEVELS[p.trustLevel].emoji} ${score}% trust | `;
      message += `👍 ${p.upvotes} 👎 ${p.downvotes}\n\n`;
    });

    message += `\n🔗 ${FRONTEND_URL}/projects`;

    ctx.reply(message);
  } catch (error) {
    console.error('Error fetching top projects:', error);
    ctx.reply('Sorry, failed to fetch top projects. Try again later.');
  }
});

// Recent scams
bot.command('scams', async (ctx) => {
  const countStr = ctx.message.text.replace('/scams', '').trim();
  const count = parseInt(countStr) || 5;

  try {
    const query = gql`
      query RecentScams($first: Int!) {
        projects(
          first: $first
          where: { trustLevel_gte: 4 }
          orderBy: updatedAt
          orderDirection: desc
        ) {
          id
          name
          symbol
          trustLevel
          upvotes
          downvotes
          updatedAt
        }
      }
    `;

    const data: any = await graphql.request(query, { first: Math.min(count, 10) });

    if (!data.projects?.length) {
      return ctx.reply('No scams flagged yet - community is vigilant! 🛡️');
    }

    let message = '⚠️ Recently Flagged Scams:\n\n';

    data.projects.forEach((p: any, i: number) => {
      const trustInfo = TRUST_LEVELS[p.trustLevel];
      message += `${i + 1}. ${trustInfo.emoji} ${p.name} (${p.symbol || 'N/A'})\n`;
      message += `   Status: ${trustInfo.label}\n`;
      message += `   👎 ${p.downvotes} downvotes\n\n`;
    });

    message += `\n⚠️ Always DYOR before investing!`;

    ctx.reply(message);
  } catch (error) {
    console.error('Error fetching scams:', error);
    ctx.reply('Sorry, failed to fetch scam list. Try again later.');
  }
});

// Platform stats
bot.command('stats', async (ctx) => {
  try {
    const query = gql`
      query Stats {
        globalStats(id: "global") {
          totalProjects
          totalVotes
          totalUsers
          totalScamsIdentified
        }
        token(id: "token") {
          totalSupply
          totalBurned
        }
      }
    `;

    const data: any = await graphql.request(query);
    const stats = data.globalStats || {};
    const token = data.token || {};

    const message =
      `📊 DappScore Statistics:\n\n` +
      `📁 Projects Listed: ${formatNumber(stats.totalProjects || 0)}\n` +
      `🗳️ Total Votes: ${formatNumber(stats.totalVotes || 0)}\n` +
      `👥 Active Users: ${formatNumber(stats.totalUsers || 0)}\n` +
      `🚨 Scams Identified: ${formatNumber(stats.totalScamsIdentified || 0)}\n\n` +
      `💰 SCORE Token:\n` +
      `   Supply: ${formatTokenAmount(token.totalSupply || '0')}\n` +
      `   Burned: ${formatTokenAmount(token.totalBurned || '0')}\n\n` +
      `🔗 ${FRONTEND_URL}`;

    ctx.reply(message);
  } catch (error) {
    console.error('Error fetching stats:', error);
    ctx.reply('Sorry, failed to fetch stats. Try again later.');
  }
});

// User reputation
bot.command('user', async (ctx) => {
  const address = ctx.message.text.replace('/user', '').trim();

  if (!address || !isAddress(address)) {
    return ctx.reply('Please provide a valid wallet address.\nUsage: /user 0x...');
  }

  try {
    const query = gql`
      query User($id: ID!) {
        user(id: $id) {
          address
          totalVotes
          accurateVotes
          scamsIdentified
          reputationPoints
          totalEarnings
        }
      }
    `;

    const data: any = await graphql.request(query, { id: address.toLowerCase() });

    if (!data.user) {
      return ctx.reply('User not found. They may not have voted yet.');
    }

    const u = data.user;
    const accuracy = parseInt(u.totalVotes) > 0
      ? Math.round((parseInt(u.accurateVotes) / parseInt(u.totalVotes)) * 100)
      : 0;

    const message =
      `👤 User Stats:\n\n` +
      `📍 ${truncateAddress(u.address)}\n\n` +
      `⭐ Reputation: ${formatNumber(u.reputationPoints)}\n` +
      `🗳️ Total Votes: ${formatNumber(u.totalVotes)}\n` +
      `🎯 Accuracy: ${accuracy}%\n` +
      `🚨 Scams Found: ${formatNumber(u.scamsIdentified)}\n` +
      `💰 Earned: ${formatTokenAmount(u.totalEarnings)} SCORE\n\n` +
      `🔗 ${FRONTEND_URL}/user/${u.address}`;

    ctx.reply(message);
  } catch (error) {
    console.error('Error fetching user:', error);
    ctx.reply('Sorry, failed to fetch user data. Try again later.');
  }
});

// Active prediction markets
bot.command('markets', async (ctx) => {
  try {
    const query = gql`
      query Markets {
        markets(
          first: 5
          where: { status: 0 }
          orderBy: totalScamBets
          orderDirection: desc
        ) {
          id
          project {
            name
          }
          totalScamBets
          totalLegitBets
          resolutionDeadline
        }
      }
    `;

    const data: any = await graphql.request(query);

    if (!data.markets?.length) {
      return ctx.reply('No active prediction markets right now.');
    }

    let message = '🎲 Active Prediction Markets:\n\n';

    data.markets.forEach((m: any, i: number) => {
      const total = parseInt(m.totalScamBets) + parseInt(m.totalLegitBets);
      const scamPct = total > 0 ? Math.round((parseInt(m.totalScamBets) / total) * 100) : 50;
      const deadline = new Date(parseInt(m.resolutionDeadline) * 1000);

      message += `${i + 1}. ${m.project.name}\n`;
      message += `   🔴 Scam: ${scamPct}% | 🟢 Legit: ${100 - scamPct}%\n`;
      message += `   Pool: ${formatTokenAmount(total.toString())} SCORE\n`;
      message += `   Ends: ${deadline.toLocaleDateString()}\n\n`;
    });

    message += `\n🔗 ${FRONTEND_URL}/predictions`;

    ctx.reply(message);
  } catch (error) {
    console.error('Error fetching markets:', error);
    ctx.reply('Sorry, failed to fetch markets. Try again later.');
  }
});

// Handle plain text - try to detect if it's a project name or address
bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text.trim();

  // Skip if it starts with /
  if (text.startsWith('/')) return;

  // Check if it's an address
  if (isAddress(text)) {
    await lookupByAddress(ctx, text);
  } else {
    await searchAndReply(ctx, text);
  }
});

// Helper functions
async function searchAndReply(ctx: Context, query: string) {
  try {
    const gqlQuery = gql`
      query SearchProjects($query: String!) {
        projects(
          first: 5
          where: { name_contains_nocase: $query }
          orderBy: totalVoters
          orderDirection: desc
        ) {
          id
          name
          symbol
          category
          trustLevel
          upvotes
          downvotes
          totalVoters
          verified
        }
      }
    `;

    const data: any = await graphql.request(gqlQuery, { query });

    if (!data.projects?.length) {
      return ctx.reply(
        `No projects found matching "${query}".\n\n` +
        `Try searching on the website: ${FRONTEND_URL}/projects`
      );
    }

    if (data.projects.length === 1) {
      // Single result - show detailed view
      const p = data.projects[0];
      await sendProjectDetails(ctx, p);
    } else {
      // Multiple results - show list
      let message = `🔍 Found ${data.projects.length} projects:\n\n`;

      data.projects.forEach((p: any, i: number) => {
        const trustInfo = TRUST_LEVELS[p.trustLevel];
        const score = calculateTrustScore(p.upvotes, p.downvotes);

        message += `${i + 1}. ${trustInfo.emoji} ${p.name}`;
        if (p.verified) message += ' ✅';
        message += `\n   ${score}% trust | ${p.totalVoters} voters\n\n`;
      });

      message += `\nReply with a number or use /check <name> for details.`;

      ctx.reply(message);
    }
  } catch (error) {
    console.error('Error searching:', error);
    ctx.reply('Sorry, search failed. Try again later.');
  }
}

async function lookupByAddress(ctx: Context, address: string) {
  ctx.reply(`🔍 Looking up ${truncateAddress(address)}...`);

  // In real implementation, query subgraph for project with this contract address
  // For now, return a placeholder
  ctx.reply(
    `Contract lookup coming soon!\n\n` +
    `Check on website: ${FRONTEND_URL}/projects?address=${address}`
  );
}

async function sendProjectDetails(ctx: Context, project: any) {
  const trustInfo = TRUST_LEVELS[project.trustLevel];
  const score = calculateTrustScore(project.upvotes, project.downvotes);

  let message =
    `${trustInfo.emoji} ${project.name}`;

  if (project.symbol) message += ` (${project.symbol})`;
  if (project.verified) message += ' ✅';

  message += `\n\n`;
  message += `📊 Trust Score: ${score}%\n`;
  message += `📈 Status: ${trustInfo.label}\n`;
  message += `🏷️ Category: ${project.category || 'N/A'}\n\n`;
  message += `👍 Upvotes: ${formatNumber(project.upvotes)}\n`;
  message += `👎 Downvotes: ${formatNumber(project.downvotes)}\n`;
  message += `👥 Total Voters: ${formatNumber(project.totalVoters)}\n\n`;

  if (project.trustLevel >= 4) {
    message += `⚠️ WARNING: This project has been flagged!\n\n`;
  }

  message += `🔗 ${FRONTEND_URL}/projects/${project.id}`;

  ctx.reply(message);
}

function calculateTrustScore(upvotes: string, downvotes: string): number {
  const up = parseInt(upvotes);
  const down = parseInt(downvotes);
  const total = up + down;
  if (total === 0) return 50;
  return Math.round((up / total) * 100);
}

function formatNumber(num: string | number): string {
  return parseInt(num.toString()).toLocaleString();
}

function formatTokenAmount(wei: string): string {
  const amount = parseInt(wei) / 1e18;
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toFixed(0);
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Launch bot
bot.launch().then(() => {
  console.log('🤖 DappScore Telegram Bot is running!');
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
