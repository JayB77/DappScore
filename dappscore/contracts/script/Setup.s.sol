// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/ScoreToken.sol";
import "../src/TokenSale.sol";

/**
 * @title Setup
 * @notice Post-deployment setup: mint initial tokens and configure token sale
 *
 * Usage:
 *   forge script script/Setup.s.sol:Setup --rpc-url base_sepolia --broadcast
 *
 * Required env vars:
 *   PRIVATE_KEY - Deployer/owner private key
 *   SCORE_TOKEN - ScoreToken contract address
 *   TOKEN_SALE - TokenSale contract address
 *   TREASURY_ADDRESS - Treasury wallet address
 */
contract Setup is Script {
    // Token allocation (500M total)
    uint256 constant LIQUIDITY_POOL = 200_000_000 * 10**18;  // 40%
    uint256 constant VOTING_REWARDS = 200_000_000 * 10**18;  // 40%
    uint256 constant AIRDROP = 25_000_000 * 10**18;          // 5%
    uint256 constant DEVELOPMENT = 25_000_000 * 10**18;      // 5%
    uint256 constant MARKETING = 25_000_000 * 10**18;        // 5%
    uint256 constant TEAM = 25_000_000 * 10**18;             // 5%

    // Token sale allocation (from liquidity pool)
    uint256 constant TOKEN_SALE_ALLOCATION = 2_500_000 * 10**18; // 2.5M for sale

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        address scoreTokenAddr = vm.envAddress("SCORE_TOKEN");
        address tokenSaleAddr = vm.envAddress("TOKEN_SALE");

        ScoreToken scoreToken = ScoreToken(scoreTokenAddr);
        TokenSale tokenSale = TokenSale(payable(tokenSaleAddr));

        console.log("=== DappScore Token Setup ===");
        console.log("ScoreToken:", scoreTokenAddr);
        console.log("TokenSale:", tokenSaleAddr);
        console.log("Treasury:", treasury);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Mint token allocations
        console.log("Minting token allocations...");

        // Mint to token sale contract for the sale
        console.log("  - Token Sale (500k)...");
        scoreToken.mint(tokenSaleAddr, TOKEN_SALE_ALLOCATION);

        // Mint to treasury for other allocations
        uint256 treasuryAllocation = LIQUIDITY_POOL - TOKEN_SALE_ALLOCATION + // Rest of liquidity
                                     AIRDROP +
                                     DEVELOPMENT +
                                     MARKETING +
                                     TEAM;
        console.log("  - Treasury (remaining allocations)...");
        scoreToken.mint(treasury, treasuryAllocation);

        // Note: Voting rewards are minted on-demand by VotingEngine via mintRewards()
        console.log("  - Voting rewards: minted on-demand by VotingEngine");

        console.log("");
        console.log("=== Token Sale Configuration ===");

        // Configure token sale stages (example: starting in 1 day, each stage 7 days)
        uint256 stage1Start = block.timestamp + 1 days;
        uint256 stage1End = stage1Start + 7 days;
        uint256 stage2Start = stage1End;
        uint256 stage2End = stage2Start + 7 days;
        uint256 stage3Start = stage2End;
        uint256 stage3End = stage3Start + 7 days;

        console.log("Configuring sale stages...");

        // Stage 1: $0.008 (8000 with 6 decimals)
        tokenSale.setStageConfig(
            TokenSale.Stage.Stage1,
            8000,                           // $0.008
            166_666 * 10**18,              // ~166k tokens
            stage1Start,
            stage1End
        );
        console.log("  Stage 1: $0.008, starts in 1 day");

        // Stage 2: $0.009
        tokenSale.setStageConfig(
            TokenSale.Stage.Stage2,
            9000,                           // $0.009
            166_667 * 10**18,              // ~166k tokens
            stage2Start,
            stage2End
        );
        console.log("  Stage 2: $0.009");

        // Stage 3: $0.01
        tokenSale.setStageConfig(
            TokenSale.Stage.Stage3,
            10000,                          // $0.01
            166_667 * 10**18,              // ~166k tokens
            stage3Start,
            stage3End
        );
        console.log("  Stage 3: $0.010");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Setup Complete ===");
        console.log("");
        console.log("Token Distribution:");
        console.log("  - Token Sale Contract: 2,500,000 SCORE");
        console.log("  - Treasury: 297,500,000 SCORE");
        console.log("  - Voting Rewards: minted on-demand (up to 200M)");
        console.log("");
        console.log("Token Sale Schedule:");
        console.log("  - Stage 1 starts:", stage1Start);
        console.log("  - Stage 2 starts:", stage2Start);
        console.log("  - Stage 3 starts:", stage3Start);
        console.log("  - Sale ends:", stage3End);
        console.log("");
        console.log("To start the sale, call: tokenSale.startStage(Stage.Stage1)");
    }
}
