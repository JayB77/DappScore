import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  Staked,
  Unstaked,
  CoveragePurchased,
  ClaimSubmitted,
  ClaimApproved,
  ClaimPaid,
  InsurancePool,
} from "../generated/InsurancePool/InsurancePool";
import {
  InsuranceStaker,
  InsurancePoolStats,
  Coverage,
  InsuranceClaim,
  GlobalStats,
} from "../generated/schema";

function getOrCreatePoolStats(): InsurancePoolStats {
  let stats = InsurancePoolStats.load("pool");

  if (!stats) {
    stats = new InsurancePoolStats("pool");
    stats.totalStaked = BigInt.fromI32(0);
    stats.totalCoverage = BigInt.fromI32(0);
    stats.totalPremiums = BigInt.fromI32(0);
    stats.totalClaimsPaid = BigInt.fromI32(0);
    stats.stakerCount = 0;
  }

  return stats;
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

export function handleInsuranceStaked(event: Staked): void {
  let stakerAddress = event.params.staker;
  let id = stakerAddress.toHexString();

  let staker = InsuranceStaker.load(id);
  let isNew = staker == null;

  if (!staker) {
    staker = new InsuranceStaker(id);
    staker.address = stakerAddress;
    staker.stakedAmount = BigInt.fromI32(0);
    staker.pendingRewards = BigInt.fromI32(0);
    staker.totalEarnings = BigInt.fromI32(0);
    staker.stakedAt = event.block.timestamp;
  }

  staker.stakedAmount = staker.stakedAmount.plus(event.params.amount);
  staker.save();

  let poolStats = getOrCreatePoolStats();
  poolStats.totalStaked = poolStats.totalStaked.plus(event.params.amount);
  if (isNew) poolStats.stakerCount = poolStats.stakerCount + 1;
  poolStats.save();

  let globalStats = getOrCreateGlobalStats();
  globalStats.totalInsuranceStaked = globalStats.totalInsuranceStaked.plus(
    event.params.amount
  );
  globalStats.save();
}

export function handleInsuranceUnstaked(event: Unstaked): void {
  let staker = InsuranceStaker.load(event.params.staker.toHexString());
  if (!staker) return;

  staker.stakedAmount = staker.stakedAmount.minus(event.params.amount);
  staker.save();

  let poolStats = getOrCreatePoolStats();
  poolStats.totalStaked = poolStats.totalStaked.minus(event.params.amount);
  poolStats.save();

  let globalStats = getOrCreateGlobalStats();
  globalStats.totalInsuranceStaked = globalStats.totalInsuranceStaked.minus(
    event.params.amount
  );
  globalStats.save();
}

export function handleCoveragePurchased(event: CoveragePurchased): void {
  let coverageId = event.params.coverageId;
  let coverage = new Coverage(coverageId.toString());

  coverage.coverageId = coverageId;
  coverage.project = event.params.projectId.toString();
  coverage.purchaser = event.params.purchaser;
  coverage.coverageAmount = event.params.amount;
  coverage.active = true;
  coverage.claimed = false;
  coverage.purchasedAt = event.block.timestamp;

  // Fetch premium and expiry from contract
  let contract = InsurancePool.bind(event.address);
  let result = contract.try_getCoverage(coverageId);
  if (!result.reverted) {
    coverage.premiumPaid = result.value.premiumPaid;
    coverage.expiresAt = result.value.expiresAt;
  } else {
    coverage.premiumPaid = BigInt.fromI32(0);
    coverage.expiresAt = BigInt.fromI32(0);
  }

  coverage.save();

  let poolStats = getOrCreatePoolStats();
  poolStats.totalCoverage = poolStats.totalCoverage.plus(event.params.amount);
  poolStats.totalPremiums = poolStats.totalPremiums.plus(coverage.premiumPaid);
  poolStats.save();
}

export function handleClaimSubmitted(event: ClaimSubmitted): void {
  let claimId = event.params.claimId;
  let claim = new InsuranceClaim(claimId.toString());

  claim.claimId = claimId;
  claim.coverage = event.params.coverageId.toString();
  claim.claimant = event.params.claimant;
  claim.lossAmount = event.params.amount;
  claim.requestedAmount = event.params.amount;
  claim.approvedAmount = BigInt.fromI32(0);
  claim.approved = false;
  claim.rejected = false;
  claim.paid = false;
  claim.submittedAt = event.block.timestamp;
  claim.save();
}

export function handleClaimApproved(event: ClaimApproved): void {
  let claim = InsuranceClaim.load(event.params.claimId.toString());
  if (!claim) return;

  claim.approved = true;
  claim.approvedAmount = event.params.approvedAmount;
  claim.save();

  let coverage = Coverage.load(claim.coverage);
  if (coverage) {
    coverage.claimed = true;
    coverage.active = false;
    coverage.save();

    let poolStats = getOrCreatePoolStats();
    poolStats.totalCoverage = poolStats.totalCoverage.minus(coverage.coverageAmount);
    poolStats.save();
  }
}

export function handleClaimPaid(event: ClaimPaid): void {
  let claim = InsuranceClaim.load(event.params.claimId.toString());
  if (!claim) return;

  claim.paid = true;
  claim.save();

  let poolStats = getOrCreatePoolStats();
  poolStats.totalClaimsPaid = poolStats.totalClaimsPaid.plus(event.params.amount);
  poolStats.save();

  let globalStats = getOrCreateGlobalStats();
  globalStats.totalClaimsPaid = globalStats.totalClaimsPaid.plus(event.params.amount);
  globalStats.save();
}
