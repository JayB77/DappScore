import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  Voted,
  VoteChanged,
  RewardsClaimed,
  Staked,
  Unstaked,
  ProjectFlagged,
  ProjectMarkedScam,
} from "../generated/VotingEngine/VotingEngine";
import { Vote, User, Project, GlobalStats, DailyStats } from "../generated/schema";

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
    user.reputationPoints = BigInt.fromI32(100); // Starting rep
    user.stakedBalance = BigInt.fromI32(0);
    user.totalEarnings = BigInt.fromI32(0);
    user.pendingRewards = BigInt.fromI32(0);
    user.accountCreatedAt = timestamp;
    user.lastActivityAt = timestamp;
    user.isAffiliate = false;

    // Update global stats
    let stats = getOrCreateGlobalStats();
    stats.totalUsers = stats.totalUsers.plus(BigInt.fromI32(1));
    stats.save();
  }

  return user;
}

function getOrCreateProject(projectId: BigInt): Project {
  let id = projectId.toString();
  let project = Project.load(id);

  if (!project) {
    project = new Project(id);
    project.projectId = projectId;
    project.owner = Address.zero();
    project.name = "";
    project.status = 0;
    project.trustLevel = 0;
    project.upvotes = BigInt.fromI32(0);
    project.downvotes = BigInt.fromI32(0);
    project.totalVoters = BigInt.fromI32(0);
    project.isPremium = false;
    project.verified = false;
    project.createdAt = BigInt.fromI32(0);
    project.updatedAt = BigInt.fromI32(0);
  }

  return project;
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
  let dayTimestamp = timestamp.toI32() / 86400 * 86400;
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

export function handleVoted(event: Voted): void {
  let projectId = event.params.projectId;
  let voterAddress = event.params.voter;
  let voteType = event.params.voteType;

  let user = getOrCreateUser(voterAddress, event.block.timestamp);
  let project = getOrCreateProject(projectId);

  let voteId = projectId.toString() + "-" + voterAddress.toHexString();
  let vote = new Vote(voteId);
  vote.project = project.id;
  vote.voter = user.id;
  vote.voteType = voteType;
  vote.timestamp = event.block.timestamp;
  vote.blockNumber = event.block.number;
  vote.changed = false;
  vote.save();

  // Update user stats
  user.totalVotes = user.totalVotes.plus(BigInt.fromI32(1));
  if (voteType == 1) {
    user.upvotes = user.upvotes.plus(BigInt.fromI32(1));
  } else {
    user.downvotes = user.downvotes.plus(BigInt.fromI32(1));
  }
  user.lastActivityAt = event.block.timestamp;
  user.save();

  // Update project stats
  if (voteType == 1) {
    project.upvotes = project.upvotes.plus(BigInt.fromI32(1));
  } else {
    project.downvotes = project.downvotes.plus(BigInt.fromI32(1));
  }
  project.totalVoters = project.totalVoters.plus(BigInt.fromI32(1));
  project.updatedAt = event.block.timestamp;
  project.save();

  // Update global stats
  let stats = getOrCreateGlobalStats();
  stats.totalVotes = stats.totalVotes.plus(BigInt.fromI32(1));
  stats.save();

  // Update daily stats
  let daily = getDailyStats(event.block.timestamp);
  daily.newVotes = daily.newVotes.plus(BigInt.fromI32(1));
  daily.save();
}

export function handleVoteChanged(event: VoteChanged): void {
  let projectId = event.params.projectId;
  let voterAddress = event.params.voter;
  let newVoteType = event.params.newVoteType;

  let voteId = projectId.toString() + "-" + voterAddress.toHexString();
  let vote = Vote.load(voteId);

  if (vote) {
    let oldVoteType = vote.voteType;
    vote.voteType = newVoteType;
    vote.changed = true;
    vote.timestamp = event.block.timestamp;
    vote.save();

    // Update project vote counts
    let project = getOrCreateProject(projectId);
    if (oldVoteType == 1) {
      project.upvotes = project.upvotes.minus(BigInt.fromI32(1));
    } else {
      project.downvotes = project.downvotes.minus(BigInt.fromI32(1));
    }
    if (newVoteType == 1) {
      project.upvotes = project.upvotes.plus(BigInt.fromI32(1));
    } else {
      project.downvotes = project.downvotes.plus(BigInt.fromI32(1));
    }
    project.save();

    // Update user stats
    let user = User.load(voterAddress.toHexString());
    if (user) {
      if (oldVoteType == 1) {
        user.upvotes = user.upvotes.minus(BigInt.fromI32(1));
      } else {
        user.downvotes = user.downvotes.minus(BigInt.fromI32(1));
      }
      if (newVoteType == 1) {
        user.upvotes = user.upvotes.plus(BigInt.fromI32(1));
      } else {
        user.downvotes = user.downvotes.plus(BigInt.fromI32(1));
      }
      user.save();
    }
  }
}

export function handleRewardsClaimed(event: RewardsClaimed): void {
  let user = User.load(event.params.user.toHexString());

  if (user) {
    user.totalEarnings = user.totalEarnings.plus(event.params.amount);
    user.pendingRewards = BigInt.fromI32(0);
    user.lastActivityAt = event.block.timestamp;
    user.save();
  }
}

export function handleStaked(event: Staked): void {
  let user = getOrCreateUser(event.params.user, event.block.timestamp);
  user.stakedBalance = user.stakedBalance.plus(event.params.amount);
  user.lastActivityAt = event.block.timestamp;
  user.save();
}

export function handleUnstaked(event: Unstaked): void {
  let user = User.load(event.params.user.toHexString());

  if (user) {
    user.stakedBalance = user.stakedBalance.minus(event.params.amount);
    user.lastActivityAt = event.block.timestamp;
    user.save();
  }
}

export function handleProjectFlagged(event: ProjectFlagged): void {
  let project = getOrCreateProject(event.params.projectId);
  project.trustLevel = 4; // SuspectedScam
  project.updatedAt = event.block.timestamp;
  project.save();
}

export function handleProjectMarkedScam(event: ProjectMarkedScam): void {
  let project = getOrCreateProject(event.params.projectId);
  project.trustLevel = 5; // ProbableScam
  project.updatedAt = event.block.timestamp;
  project.save();

  let stats = getOrCreateGlobalStats();
  stats.totalScamsIdentified = stats.totalScamsIdentified.plus(BigInt.fromI32(1));
  stats.save();
}
