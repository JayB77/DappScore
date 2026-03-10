import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  MarketCreated,
  BetPlaced,
  MarketResolved,
  WinningsClaimed,
} from "../generated/PredictionMarket/PredictionMarket";
import { Market, Bet, User, GlobalStats, DailyStats } from "../generated/schema";

function getOrCreateUser(address: Address, timestamp: BigInt): User {
  let id = address.toHexString();
  let user = User.load(id);

  if (!user) {
    user = new User(id);
    user.address = address;
    user.totalVotes = BigInt.fromI32(0);
    user.upvotes = BigInt.fromI32(0);
    user.downvotes = BigInt.fromI32(0);
    user.accurateVotes = BigInt.fromI32(0);
    user.scamsIdentified = BigInt.fromI32(0);
    user.reputationPoints = BigInt.fromI32(100);
    user.stakedBalance = BigInt.fromI32(0);
    user.totalEarnings = BigInt.fromI32(0);
    user.pendingRewards = BigInt.fromI32(0);
    user.accountCreatedAt = timestamp;
    user.lastActivityAt = timestamp;
    user.isAffiliate = false;

    let stats = getOrCreateGlobalStats();
    stats.totalUsers = stats.totalUsers.plus(BigInt.fromI32(1));
    stats.save();
  }

  return user;
}

function getOrCreateGlobalStats(): GlobalStats {
  let stats = GlobalStats.load("global");

  if (!stats) {
    stats = new GlobalStats("global");
    stats.totalProjects = BigInt.fromI32(0);
    stats.totalVotes = BigInt.fromI32(0);
    stats.totalUsers = BigInt.fromI32(0);
    stats.totalScamsIdentified = BigInt.fromI32(0);
    stats.totalBounties = BigInt.fromI32(0);
    stats.totalBountyPaid = BigInt.fromI32(0);
    stats.totalInsuranceStaked = BigInt.fromI32(0);
    stats.totalClaimsPaid = BigInt.fromI32(0);
    stats.totalPredictionVolume = BigInt.fromI32(0);
    stats.totalAffiliateEarnings = BigInt.fromI32(0);
  }

  return stats;
}

function getDailyStats(timestamp: BigInt): DailyStats {
  let dayTimestamp = (timestamp.toI32() / 86400) * 86400;
  let id = dayTimestamp.toString();
  let stats = DailyStats.load(id);

  if (!stats) {
    stats = new DailyStats(id);
    stats.date = BigInt.fromI32(dayTimestamp);
    stats.newProjects = BigInt.fromI32(0);
    stats.newVotes = BigInt.fromI32(0);
    stats.newUsers = BigInt.fromI32(0);
    stats.volumeTraded = BigInt.fromI32(0);
    stats.tokensBurned = BigInt.fromI32(0);
  }

  return stats;
}

export function handleMarketCreated(event: MarketCreated): void {
  let marketId = event.params.marketId;
  let market = new Market(marketId.toString());

  market.marketId = marketId;
  market.project = event.params.projectId.toString();
  market.creator = event.params.creator;
  market.totalScamBets = BigInt.fromI32(0);
  market.totalLegitBets = BigInt.fromI32(0);
  market.totalBettors = BigInt.fromI32(0);
  market.status = 0; // Active
  market.outcome = 0; // Undecided
  market.bettingDeadline = BigInt.fromI32(0); // Not in event; fetched at bet time
  market.resolutionDeadline = event.params.resolutionDeadline;
  market.createdAt = event.block.timestamp;
  market.save();
}

export function handleBetPlaced(event: BetPlaced): void {
  let marketId = event.params.marketId;
  let bettorAddress = event.params.bettor;

  let market = Market.load(marketId.toString());
  if (!market) return;

  let user = getOrCreateUser(bettorAddress, event.block.timestamp);
  user.lastActivityAt = event.block.timestamp;
  user.save();

  let betId = marketId.toString() + "-" + bettorAddress.toHexString();
  let bet = new Bet(betId);
  bet.market = marketId.toString();
  bet.bettor = user.id;
  bet.amount = event.params.amount;
  bet.betOnScam = event.params.betOnScam;
  bet.claimed = false;
  bet.timestamp = event.block.timestamp;
  bet.save();

  if (event.params.betOnScam) {
    market.totalScamBets = market.totalScamBets.plus(event.params.amount);
  } else {
    market.totalLegitBets = market.totalLegitBets.plus(event.params.amount);
  }
  market.totalBettors = market.totalBettors.plus(BigInt.fromI32(1));
  market.save();

  let stats = getOrCreateGlobalStats();
  stats.totalPredictionVolume = stats.totalPredictionVolume.plus(event.params.amount);
  stats.save();

  let daily = getDailyStats(event.block.timestamp);
  daily.volumeTraded = daily.volumeTraded.plus(event.params.amount);
  daily.save();
}

export function handleMarketResolved(event: MarketResolved): void {
  let market = Market.load(event.params.marketId.toString());
  if (!market) return;

  market.status = 2; // Resolved
  market.outcome = event.params.outcome;
  market.resolvedAt = event.block.timestamp;
  market.save();
}

export function handleWinningsClaimed(event: WinningsClaimed): void {
  let betId =
    event.params.marketId.toString() + "-" + event.params.bettor.toHexString();
  let bet = Bet.load(betId);
  if (!bet) return;

  bet.claimed = true;
  bet.winnings = event.params.amount;
  bet.save();

  let user = User.load(event.params.bettor.toHexString());
  if (user) {
    user.totalEarnings = user.totalEarnings.plus(event.params.amount);
    user.lastActivityAt = event.block.timestamp;
    user.save();
  }
}
