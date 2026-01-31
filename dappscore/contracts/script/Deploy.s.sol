// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

// Core contracts
import "../src/ScoreToken.sol";
import "../src/ProjectRegistry.sol";
import "../src/VotingEngine.sol";
import "../src/TokenSale.sol";
import "../src/PremiumListings.sol";
import "../src/CuratorNFT.sol";

// Feature contracts
import "../src/ReputationSystem.sol";
import "../src/PredictionMarket.sol";
import "../src/BountySystem.sol";
import "../src/InsurancePool.sol";
import "../src/Watchlist.sol";
import "../src/AffiliateProgram.sol";

/**
 * @title Deploy
 * @notice Deploys all DappScore contracts to Base Sepolia
 *
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify
 *
 * Required env vars:
 *   PRIVATE_KEY - Deployer private key
 *   TREASURY_ADDRESS - Treasury wallet for fees
 *   USDC_ADDRESS - USDC token address (Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e)
 *   USDT_ADDRESS - USDT token address (or use USDC address if no USDT on testnet)
 *   NFT_BASE_URI - Base URI for NFT metadata (e.g., "ipfs://QmXXX/")
 */
contract Deploy is Script {
    // Core contracts
    ScoreToken public scoreToken;
    ProjectRegistry public projectRegistry;
    VotingEngine public votingEngine;
    TokenSale public tokenSale;
    PremiumListings public premiumListings;
    CuratorNFT public curatorNFT;

    // Feature contracts
    ReputationSystem public reputationSystem;
    PredictionMarket public predictionMarket;
    BountySystem public bountySystem;
    InsurancePool public insurancePool;
    Watchlist public watchlist;
    AffiliateProgram public affiliateProgram;

    // Configuration
    uint256 public listingFee = 0; // Free listings on testnet
    uint256 public verificationFee = 0.001 ether; // Small fee for verification

    function run() external {
        // Load configuration from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        address usdc = vm.envAddress("USDC_ADDRESS");
        address usdt = vm.envOr("USDT_ADDRESS", usdc); // Default to USDC if no USDT
        string memory nftBaseUri = vm.envOr("NFT_BASE_URI", string("https://dappscore.io/nft/"));

        console.log("=== DappScore Full Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);
        console.log("USDC:", usdc);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ============ CORE CONTRACTS ============
        console.log("--- Deploying Core Contracts ---");

        // 1. Deploy ScoreToken
        console.log("1. Deploying ScoreToken...");
        scoreToken = new ScoreToken(deployer);
        console.log("   ScoreToken:", address(scoreToken));

        // 2. Deploy ProjectRegistry
        console.log("2. Deploying ProjectRegistry...");
        projectRegistry = new ProjectRegistry(
            deployer,
            treasury,
            listingFee,
            verificationFee
        );
        console.log("   ProjectRegistry:", address(projectRegistry));

        // 3. Deploy VotingEngine
        console.log("3. Deploying VotingEngine...");
        votingEngine = new VotingEngine(
            deployer,
            address(scoreToken),
            address(projectRegistry)
        );
        console.log("   VotingEngine:", address(votingEngine));

        // 4. Deploy TokenSale
        console.log("4. Deploying TokenSale...");
        tokenSale = new TokenSale(
            deployer,
            address(scoreToken),
            usdc,
            usdt,
            treasury
        );
        console.log("   TokenSale:", address(tokenSale));

        // 5. Deploy PremiumListings
        console.log("5. Deploying PremiumListings...");
        premiumListings = new PremiumListings(
            deployer,
            address(scoreToken),
            address(projectRegistry),
            treasury,
            address(votingEngine)
        );
        console.log("   PremiumListings:", address(premiumListings));

        // 6. Deploy CuratorNFT
        console.log("6. Deploying CuratorNFT...");
        curatorNFT = new CuratorNFT(
            deployer,
            address(scoreToken),
            nftBaseUri
        );
        console.log("   CuratorNFT:", address(curatorNFT));

        // ============ FEATURE CONTRACTS ============
        console.log("");
        console.log("--- Deploying Feature Contracts ---");

        // 7. Deploy ReputationSystem
        console.log("7. Deploying ReputationSystem...");
        reputationSystem = new ReputationSystem(deployer);
        console.log("   ReputationSystem:", address(reputationSystem));

        // 8. Deploy PredictionMarket
        console.log("8. Deploying PredictionMarket...");
        predictionMarket = new PredictionMarket(deployer, address(scoreToken));
        console.log("   PredictionMarket:", address(predictionMarket));

        // 9. Deploy BountySystem
        console.log("9. Deploying BountySystem...");
        bountySystem = new BountySystem(deployer, address(scoreToken));
        console.log("   BountySystem:", address(bountySystem));

        // 10. Deploy InsurancePool
        console.log("10. Deploying InsurancePool...");
        insurancePool = new InsurancePool(deployer, address(scoreToken));
        console.log("   InsurancePool:", address(insurancePool));

        // 11. Deploy Watchlist
        console.log("11. Deploying Watchlist...");
        watchlist = new Watchlist(deployer);
        console.log("   Watchlist:", address(watchlist));

        // 12. Deploy AffiliateProgram
        console.log("12. Deploying AffiliateProgram...");
        affiliateProgram = new AffiliateProgram(deployer, address(scoreToken));
        console.log("   AffiliateProgram:", address(affiliateProgram));

        // ============ CONFIGURATION ============
        console.log("");
        console.log("--- Configuring Contracts ---");

        // Configure ScoreToken
        console.log("Configuring ScoreToken...");
        scoreToken.setRewardsPool(address(votingEngine));
        scoreToken.setTreasury(treasury);

        // Configure ProjectRegistry
        console.log("Configuring ProjectRegistry...");
        projectRegistry.setVotingEngine(address(votingEngine));

        // Initialize PremiumListings tiers
        console.log("Initializing PremiumListings tiers...");
        premiumListings.initializeTiers();

        // Configure ReputationSystem - authorize VotingEngine
        console.log("Configuring ReputationSystem...");
        reputationSystem.setAuthorizedUpdater(address(votingEngine), true);

        // Configure PredictionMarket - set resolver
        console.log("Configuring PredictionMarket...");
        predictionMarket.setResolver(deployer, true);

        // Configure InsurancePool - set claim approver
        console.log("Configuring InsurancePool...");
        insurancePool.setClaimApprover(deployer, true);

        // Configure AffiliateProgram - authorize ProjectRegistry
        console.log("Configuring AffiliateProgram...");
        affiliateProgram.setAuthorizedRecorder(address(projectRegistry), true);

        vm.stopBroadcast();

        // ============ OUTPUT ============
        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("");
        console.log("Core Contract Addresses:");
        console.log("------------------------");
        console.log("SCORE_TOKEN:", address(scoreToken));
        console.log("PROJECT_REGISTRY:", address(projectRegistry));
        console.log("VOTING_ENGINE:", address(votingEngine));
        console.log("TOKEN_SALE:", address(tokenSale));
        console.log("PREMIUM_LISTINGS:", address(premiumListings));
        console.log("CURATOR_NFT:", address(curatorNFT));
        console.log("");
        console.log("Feature Contract Addresses:");
        console.log("---------------------------");
        console.log("REPUTATION_SYSTEM:", address(reputationSystem));
        console.log("PREDICTION_MARKET:", address(predictionMarket));
        console.log("BOUNTY_SYSTEM:", address(bountySystem));
        console.log("INSURANCE_POOL:", address(insurancePool));
        console.log("WATCHLIST:", address(watchlist));
        console.log("AFFILIATE_PROGRAM:", address(affiliateProgram));
        console.log("");
        console.log("Next steps:");
        console.log("1. Run Setup.s.sol to mint initial tokens");
        console.log("2. Update dappscore/src/config/wagmi.ts with addresses above");
        console.log("3. Verify contracts on BaseScan if not auto-verified");
    }
}
