import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  ProjectSubmitted,
  ProjectUpdated,
  ProjectStatusChanged,
  ProjectTrustLevelChanged,
  ProjectVerified,
  ProjectRegistry,
} from "../generated/ProjectRegistry/ProjectRegistry";
import { Project, GlobalStats, DailyStats } from "../generated/schema";

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

export function handleProjectSubmitted(event: ProjectSubmitted): void {
  let projectId = event.params.projectId;
  let id = projectId.toString();

  let project = new Project(id);
  project.projectId = projectId;
  project.owner = event.params.owner;
  project.name = event.params.name;
  project.status = 1; // Active — contracts set Active on submission
  project.trustLevel = 0; // NewListing
  project.upvotes = BigInt.fromI32(0);
  project.downvotes = BigInt.fromI32(0);
  project.totalVoters = BigInt.fromI32(0);
  project.isPremium = false;
  project.verified = false;
  project.createdAt = event.block.timestamp;
  project.updatedAt = event.block.timestamp;

  // Fetch remaining fields from contract
  let contract = ProjectRegistry.bind(event.address);
  let result = contract.try_getProject(projectId);
  if (!result.reverted) {
    let p = result.value;
    project.symbol = p.symbol;
    project.metadataIpfsHash = p.metadataIpfsHash;
    project.category = p.category;
    project.chain = p.chain;
  }

  project.save();

  let stats = getOrCreateGlobalStats();
  stats.totalProjects = stats.totalProjects.plus(BigInt.fromI32(1));
  stats.save();

  let daily = getDailyStats(event.block.timestamp);
  daily.newProjects = daily.newProjects.plus(BigInt.fromI32(1));
  daily.save();
}

export function handleProjectUpdated(event: ProjectUpdated): void {
  let project = Project.load(event.params.projectId.toString());
  if (!project) return;

  let contract = ProjectRegistry.bind(event.address);
  let result = contract.try_getProject(event.params.projectId);
  if (!result.reverted) {
    let p = result.value;
    project.metadataIpfsHash = p.metadataIpfsHash;
    project.symbol = p.symbol;
    project.category = p.category;
    project.chain = p.chain;
  }

  project.updatedAt = event.block.timestamp;
  project.save();
}

export function handleProjectStatusChanged(event: ProjectStatusChanged): void {
  let project = Project.load(event.params.projectId.toString());
  if (!project) return;

  project.status = event.params.newStatus;
  project.updatedAt = event.block.timestamp;
  project.save();
}

export function handleTrustLevelChanged(event: ProjectTrustLevelChanged): void {
  let project = Project.load(event.params.projectId.toString());
  if (!project) return;

  project.trustLevel = event.params.newLevel;
  project.updatedAt = event.block.timestamp;
  project.save();
}

export function handleProjectVerified(event: ProjectVerified): void {
  let project = Project.load(event.params.projectId.toString());
  if (!project) return;

  project.verified = true;
  project.updatedAt = event.block.timestamp;
  project.save();
}
