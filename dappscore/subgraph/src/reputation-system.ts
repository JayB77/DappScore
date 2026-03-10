import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  ReputationUpdated,
  ScamIdentified,
  DecayApplied,
  UserRegistered,
} from "../generated/ReputationSystem/ReputationSystem";
import { UserReputation, ReputationEvent, User, GlobalStats } from "../generated/schema";

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

function getOrCreateReputation(
  address: Address,
  timestamp: BigInt
): UserReputation {
  let id = address.toHexString();
  let rep = UserReputation.load(id);

  if (!rep) {
    rep = new UserReputation(id);
    rep.user = id;
    rep.points = BigInt.fromI32(100);
    rep.totalVotes = BigInt.fromI32(0);
    rep.accurateVotes = BigInt.fromI32(0);
    rep.scamsIdentified = BigInt.fromI32(0);
    rep.level = 0;
    rep.lastActivityAt = timestamp;
    rep.accountCreatedAt = timestamp;
    rep.decayAppliedAt = timestamp;
  }

  return rep;
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

function reputationLevel(points: BigInt): i32 {
  let p = points.toI32();
  if (p >= 10000) return 5;
  if (p >= 5000) return 4;
  if (p >= 2000) return 3;
  if (p >= 500) return 2;
  if (p >= 100) return 1;
  return 0;
}

export function handleUserRegistered(event: UserRegistered): void {
  let address = event.params.user;
  let user = getOrCreateUser(address, event.block.timestamp);
  user.save();

  let rep = getOrCreateReputation(address, event.block.timestamp);
  rep.accountCreatedAt = event.block.timestamp;
  rep.save();
}

export function handleReputationUpdated(event: ReputationUpdated): void {
  let address = event.params.user;
  let newPoints = event.params.newPoints;

  let rep = getOrCreateReputation(address, event.block.timestamp);
  rep.points = newPoints;
  rep.level = reputationLevel(newPoints);
  rep.lastActivityAt = event.block.timestamp;
  rep.save();

  let user = getOrCreateUser(address, event.block.timestamp);
  user.reputationPoints = newPoints;
  user.lastActivityAt = event.block.timestamp;
  user.save();

  let eventId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString();
  let repEvent = new ReputationEvent(eventId);
  repEvent.user = address;
  repEvent.pointsChange = BigInt.fromI32(0); // Delta not in event; tracked as snapshot
  repEvent.newTotal = newPoints;
  repEvent.reason = event.params.reason;
  repEvent.timestamp = event.block.timestamp;
  repEvent.save();
}

export function handleScamIdentified(event: ScamIdentified): void {
  let address = event.params.user;

  let rep = getOrCreateReputation(address, event.block.timestamp);
  rep.scamsIdentified = rep.scamsIdentified.plus(BigInt.fromI32(1));
  rep.save();

  let user = getOrCreateUser(address, event.block.timestamp);
  user.scamsIdentified = user.scamsIdentified.plus(BigInt.fromI32(1));
  user.save();

  let stats = getOrCreateGlobalStats();
  stats.totalScamsIdentified = stats.totalScamsIdentified.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleDecayApplied(event: DecayApplied): void {
  let address = event.params.user;

  let rep = getOrCreateReputation(address, event.block.timestamp);
  rep.points = rep.points.minus(event.params.decayAmount);
  if (rep.points.lt(BigInt.fromI32(0))) rep.points = BigInt.fromI32(0);
  rep.level = reputationLevel(rep.points);
  rep.decayAppliedAt = event.block.timestamp;
  rep.save();

  let user = getOrCreateUser(address, event.block.timestamp);
  user.reputationPoints = rep.points;
  user.save();
}
