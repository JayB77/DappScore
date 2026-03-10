import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  BountyCreated,
  BountyFunded,
  SubmissionAdded,
  SubmissionApproved,
  BountyCompleted,
  BountySystem,
} from "../generated/BountySystem/BountySystem";
import {
  Bounty,
  BountySubmission,
  BountyContribution,
  Investigator,
  User,
  GlobalStats,
} from "../generated/schema";

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

function getOrCreateInvestigator(address: Address): Investigator {
  let id = address.toHexString();
  let investigator = Investigator.load(id);

  if (!investigator) {
    investigator = new Investigator(id);
    investigator.address = address;
    investigator.totalEarnings = BigInt.fromI32(0);
    investigator.completedBounties = BigInt.fromI32(0);
  }

  return investigator;
}

export function handleBountyCreated(event: BountyCreated): void {
  let bountyId = event.params.bountyId;
  let bounty = new Bounty(bountyId.toString());

  bounty.bountyId = bountyId;
  bounty.project = event.params.projectId.toString();
  bounty.creator = event.params.creator;
  bounty.totalFunding = event.params.amount;
  bounty.remainingFunding = event.params.amount;
  bounty.status = 0; // Active
  bounty.deadline = event.params.deadline;
  bounty.createdAt = event.block.timestamp;

  // Fetch description from contract
  let contract = BountySystem.bind(event.address);
  let result = contract.try_getBounty(bountyId);
  if (!result.reverted) {
    bounty.description = result.value.description;
  }

  bounty.save();

  // Record creator's initial contribution
  let contribId = bountyId.toString() + "-" + event.params.creator.toHexString();
  let contrib = new BountyContribution(contribId);
  contrib.bounty = bountyId.toString();
  contrib.contributor = event.params.creator;
  contrib.amount = event.params.amount;
  contrib.refunded = false;
  contrib.save();

  let stats = getOrCreateGlobalStats();
  stats.totalBounties = stats.totalBounties.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleBountyFunded(event: BountyFunded): void {
  let bounty = Bounty.load(event.params.bountyId.toString());
  if (!bounty) return;

  bounty.totalFunding = bounty.totalFunding.plus(event.params.amount);
  bounty.remainingFunding = bounty.remainingFunding.plus(event.params.amount);
  bounty.save();

  let contribId =
    event.params.bountyId.toString() + "-" + event.params.funder.toHexString();
  let contrib = BountyContribution.load(contribId);

  if (!contrib) {
    contrib = new BountyContribution(contribId);
    contrib.bounty = event.params.bountyId.toString();
    contrib.contributor = event.params.funder;
    contrib.amount = BigInt.fromI32(0);
    contrib.refunded = false;
  }

  contrib.amount = contrib.amount.plus(event.params.amount);
  contrib.save();
}

export function handleSubmissionAdded(event: SubmissionAdded): void {
  let bountyId = event.params.bountyId;
  let submissionIndex = event.params.submissionIndex;
  let investigatorAddress = event.params.investigator;

  let submissionId = bountyId.toString() + "-" + submissionIndex.toString();
  let submission = new BountySubmission(submissionId);
  submission.bounty = bountyId.toString();
  submission.investigator = investigatorAddress.toHexString();
  submission.approved = false;
  submission.rejected = false;
  submission.paidAmount = BigInt.fromI32(0);
  submission.submittedAt = event.block.timestamp;

  // Fetch evidence and requested amount from contract
  let contract = BountySystem.bind(event.address);
  let result = contract.try_getSubmissions(bountyId);
  if (!result.reverted && submissionIndex.toI32() < result.value.length) {
    let sub = result.value[submissionIndex.toI32()];
    submission.evidenceIpfsHash = sub.evidenceIpfsHash;
    submission.requestedAmount = sub.requestedAmount;
  } else {
    submission.evidenceIpfsHash = "";
    submission.requestedAmount = BigInt.fromI32(0);
  }

  submission.save();

  // Ensure investigator entity exists
  let user = getOrCreateUser(investigatorAddress, event.block.timestamp);
  user.lastActivityAt = event.block.timestamp;
  user.save();

  getOrCreateInvestigator(investigatorAddress).save();
}

export function handleSubmissionApproved(event: SubmissionApproved): void {
  let submissionId =
    event.params.bountyId.toString() + "-" + event.params.submissionIndex.toString();
  let submission = BountySubmission.load(submissionId);
  if (!submission) return;

  submission.approved = true;
  submission.paidAmount = event.params.paidAmount;
  submission.save();

  let bounty = Bounty.load(event.params.bountyId.toString());
  if (bounty) {
    bounty.remainingFunding = bounty.remainingFunding.minus(event.params.paidAmount);
    bounty.save();
  }

  // Update investigator stats
  let investigator = getOrCreateInvestigator(
    Address.fromBytes(submission.investigator)
  );
  investigator.totalEarnings = investigator.totalEarnings.plus(event.params.paidAmount);
  investigator.completedBounties = investigator.completedBounties.plus(
    BigInt.fromI32(1)
  );
  investigator.save();

  let stats = getOrCreateGlobalStats();
  stats.totalBountyPaid = stats.totalBountyPaid.plus(event.params.paidAmount);
  stats.save();
}

export function handleBountyCompleted(event: BountyCompleted): void {
  let bounty = Bounty.load(event.params.bountyId.toString());
  if (!bounty) return;

  bounty.status = 2; // Completed
  bounty.save();
}
