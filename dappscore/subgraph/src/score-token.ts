import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  Transfer,
  TokensBurned,
  ProtocolBurn,
} from "../generated/ScoreToken/ScoreToken";
import { Token, TokenBurn, DailyStats } from "../generated/schema";

function getOrCreateToken(): Token {
  let token = Token.load("token");

  if (!token) {
    token = new Token("token");
    token.totalSupply = BigInt.fromI32(0);
    token.totalBurned = BigInt.fromI32(0);
    token.circulatingSupply = BigInt.fromI32(0);
    token.holderCount = 0;
  }

  return token;
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

export function handleTransfer(event: Transfer): void {
  let token = getOrCreateToken();
  let zero = Address.zero();

  if (event.params.from == zero) {
    // Mint — increase supply
    token.totalSupply = token.totalSupply.plus(event.params.value);
    token.circulatingSupply = token.circulatingSupply.plus(event.params.value);
  } else if (event.params.to == zero) {
    // ERC20 base burn — decrease circulating supply
    token.circulatingSupply = token.circulatingSupply.minus(event.params.value);
  }

  token.save();
}

export function handleTokensBurned(event: TokensBurned): void {
  let token = getOrCreateToken();
  token.totalBurned = token.totalBurned.plus(event.params.amount);
  token.save();

  let burnId = event.transaction.hash.toHexString();
  let burn = new TokenBurn(burnId);
  burn.burner = event.params.burner;
  burn.amount = event.params.amount;
  burn.isProtocolBurn = false;
  burn.timestamp = event.block.timestamp;
  burn.blockNumber = event.block.number;
  burn.save();

  let daily = getDailyStats(event.block.timestamp);
  daily.tokensBurned = daily.tokensBurned.plus(event.params.amount);
  daily.save();
}

export function handleProtocolBurn(event: ProtocolBurn): void {
  let token = getOrCreateToken();
  token.totalBurned = token.totalBurned.plus(event.params.amount);
  token.save();

  // Use tx hash + "protocol" suffix to avoid collision with TokensBurned entry
  let burnId = event.transaction.hash.toHexString() + "-protocol";
  let burn = new TokenBurn(burnId);
  burn.burner = Address.zero(); // Treasury address not available in event
  burn.amount = event.params.amount;
  burn.reason = event.params.reason;
  burn.isProtocolBurn = true;
  burn.timestamp = event.block.timestamp;
  burn.blockNumber = event.block.number;
  burn.save();

  let daily = getDailyStats(event.block.timestamp);
  daily.tokensBurned = daily.tokensBurned.plus(event.params.amount);
  daily.save();
}
