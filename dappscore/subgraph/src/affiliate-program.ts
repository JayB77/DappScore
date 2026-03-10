import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  AffiliateRegistered,
  ReferralRecorded,
  EarningsWithdrawn,
  LevelUpgraded,
} from "../generated/AffiliateProgram/AffiliateProgram";
import { Affiliate, Referral, User, GlobalStats } from "../generated/schema";

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

export function handleAffiliateRegistered(event: AffiliateRegistered): void {
  let address = event.params.affiliate;
  let id = address.toHexString();

  let user = getOrCreateUser(address, event.block.timestamp);
  user.isAffiliate = true;
  user.save();

  let affiliate = new Affiliate(id);
  affiliate.user = id;
  affiliate.referralCode = event.params.referralCode;
  affiliate.totalReferrals = BigInt.fromI32(0);
  affiliate.projectReferrals = BigInt.fromI32(0);
  affiliate.userReferrals = BigInt.fromI32(0);
  affiliate.totalEarnings = BigInt.fromI32(0);
  affiliate.pendingEarnings = BigInt.fromI32(0);
  affiliate.level = 0; // Bronze
  affiliate.joinedAt = event.block.timestamp;
  affiliate.save();
}

export function handleReferralRecorded(event: ReferralRecorded): void {
  let referrerAddress = event.params.referrer;
  let referrerId = referrerAddress.toHexString();

  let affiliate = Affiliate.load(referrerId);
  if (!affiliate) return;

  affiliate.totalReferrals = affiliate.totalReferrals.plus(BigInt.fromI32(1));
  affiliate.totalEarnings = affiliate.totalEarnings.plus(event.params.reward);
  affiliate.pendingEarnings = affiliate.pendingEarnings.plus(event.params.reward);

  if (event.params.isProject) {
    affiliate.projectReferrals = affiliate.projectReferrals.plus(BigInt.fromI32(1));
  } else {
    affiliate.userReferrals = affiliate.userReferrals.plus(BigInt.fromI32(1));
  }

  affiliate.save();

  // Record referral event
  let referralId = event.transaction.hash.toHexString();
  let referral = new Referral(referralId);
  referral.referrer = referrerId;
  referral.referred = event.params.referred;
  referral.isProject = event.params.isProject;
  referral.rewardAmount = event.params.reward;
  referral.timestamp = event.block.timestamp;
  referral.save();

  // Track referred user's referrer
  let referredUser = getOrCreateUser(event.params.referred, event.block.timestamp);
  referredUser.referredBy = referrerId;
  referredUser.save();

  let stats = getOrCreateGlobalStats();
  stats.totalAffiliateEarnings = stats.totalAffiliateEarnings.plus(event.params.reward);
  stats.save();
}

export function handleEarningsWithdrawn(event: EarningsWithdrawn): void {
  let affiliate = Affiliate.load(event.params.affiliate.toHexString());
  if (!affiliate) return;

  affiliate.pendingEarnings = BigInt.fromI32(0);
  affiliate.save();
}

export function handleLevelUpgraded(event: LevelUpgraded): void {
  let affiliate = Affiliate.load(event.params.affiliate.toHexString());
  if (!affiliate) return;

  affiliate.level = event.params.newLevel;
  affiliate.save();
}
