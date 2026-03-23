// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

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
import "../src/DisputeResolution.sol";
import "../src/Watchlist.sol";
import "../src/AffiliateProgram.sol";

/**
 * @title Deploy
 * @notice Deploys all DappScore contracts to Base Sepolia.
 *
 * UUPS proxy contracts (impl + ERC1967Proxy):
 *   ProjectRegistry, VotingEngine, ReputationSystem,
 *   InsurancePool, BountySystem, DisputeResolution
 *
 * Direct-deploy contracts (Ownable / Ownable2Step):
 *   ScoreToken, TokenSale, PremiumListings, CuratorNFT,
 *   PredictionMarket, Watchlist, AffiliateProgram
 *
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy --rpc-url base_sepolia --broadcast --verify
 *
 * Required env vars:
 *   PRIVATE_KEY        — Deployer private key
 *   TREASURY_ADDRESS   — Treasury wallet for fees
 *   USDC_ADDRESS       — USDC token address (Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e)
 *   USDT_ADDRESS       — USDT token address (optional, defaults to USDC)
 *   NFT_BASE_URI       — Base URI for NFT metadata (optional)
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
    DisputeResolution public disputeResolution;
    Watchlist public watchlist;
    AffiliateProgram public affiliateProgram;

    // Configuration
    uint256 public listingFee = 0;             // Free listings on testnet
    uint256 public verificationFee = 0.001 ether;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        address usdc     = vm.envAddress("USDC_ADDRESS");
        address usdt     = vm.envOr("USDT_ADDRESS", usdc);
        string memory nftBaseUri = vm.envOr("NFT_BASE_URI", string("https://dappscore.io/nft/"));

        console.log("=== DappScore Full Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);
        console.log("USDC:", usdc);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ============ CORE CONTRACTS ============
        console.log("--- Deploying Core Contracts ---");

        // 1. ScoreToken (Ownable2Step — direct deploy)
        console.log("1. Deploying ScoreToken...");
        scoreToken = new ScoreToken(deployer);
        console.log("   ScoreToken:", address(scoreToken));

        // 2. ProjectRegistry (UUPS proxy)
        console.log("2. Deploying ProjectRegistry...");
        {
            ProjectRegistry impl = new ProjectRegistry();
            projectRegistry = ProjectRegistry(
                address(new ERC1967Proxy(
                    address(impl),
                    abi.encodeCall(
                        ProjectRegistry.initialize,
                        (deployer, treasury, listingFee, verificationFee)
                    )
                ))
            );
        }
        console.log("   ProjectRegistry:", address(projectRegistry));

        // 3. VotingEngine (UUPS proxy)
        console.log("3. Deploying VotingEngine...");
        {
            VotingEngine impl = new VotingEngine();
            votingEngine = VotingEngine(
                address(new ERC1967Proxy(
                    address(impl),
                    abi.encodeCall(
                        VotingEngine.initialize,
                        (deployer, address(scoreToken), address(projectRegistry))
                    )
                ))
            );
        }
        console.log("   VotingEngine:", address(votingEngine));

        // 4. TokenSale (Ownable2Step — direct deploy)
        console.log("4. Deploying TokenSale...");
        tokenSale = new TokenSale(deployer, address(scoreToken), usdc, usdt, treasury);
        console.log("   TokenSale:", address(tokenSale));

        // 5. PremiumListings (Ownable — direct deploy)
        console.log("5. Deploying PremiumListings...");
        premiumListings = new PremiumListings(deployer, usdc, treasury);
        console.log("   PremiumListings:", address(premiumListings));

        // 6. CuratorNFT (Ownable2Step — direct deploy)
        console.log("6. Deploying CuratorNFT...");
        curatorNFT = new CuratorNFT(deployer, address(scoreToken), nftBaseUri);
        console.log("   CuratorNFT:", address(curatorNFT));

        // ============ FEATURE CONTRACTS ============
        console.log("");
        console.log("--- Deploying Feature Contracts ---");

        // 7. ReputationSystem (UUPS proxy)
        console.log("7. Deploying ReputationSystem...");
        {
            ReputationSystem impl = new ReputationSystem();
            reputationSystem = ReputationSystem(
                address(new ERC1967Proxy(
                    address(impl),
                    abi.encodeCall(ReputationSystem.initialize, (deployer))
                ))
            );
        }
        console.log("   ReputationSystem:", address(reputationSystem));

        // 8. PredictionMarket (Ownable — direct deploy)
        console.log("8. Deploying PredictionMarket...");
        predictionMarket = new PredictionMarket(deployer, address(scoreToken));
        console.log("   PredictionMarket:", address(predictionMarket));

        // 9. BountySystem (UUPS proxy)
        console.log("9. Deploying BountySystem...");
        {
            BountySystem impl = new BountySystem();
            bountySystem = BountySystem(
                address(new ERC1967Proxy(
                    address(impl),
                    abi.encodeCall(
                        BountySystem.initialize,
                        (deployer, address(scoreToken), treasury)
                    )
                ))
            );
        }
        console.log("   BountySystem:", address(bountySystem));

        // 10. InsurancePool (UUPS proxy)
        console.log("10. Deploying InsurancePool...");
        {
            InsurancePool impl = new InsurancePool();
            insurancePool = InsurancePool(
                address(new ERC1967Proxy(
                    address(impl),
                    abi.encodeCall(
                        InsurancePool.initialize,
                        (deployer, address(scoreToken))
                    )
                ))
            );
        }
        console.log("   InsurancePool:", address(insurancePool));

        // 11. DisputeResolution (UUPS proxy)
        console.log("11. Deploying DisputeResolution...");
        {
            DisputeResolution impl = new DisputeResolution();
            disputeResolution = DisputeResolution(
                address(new ERC1967Proxy(
                    address(impl),
                    abi.encodeCall(
                        DisputeResolution.initialize,
                        (deployer, address(scoreToken), address(projectRegistry), treasury)
                    )
                ))
            );
        }
        console.log("   DisputeResolution:", address(disputeResolution));

        // 12. Watchlist (Ownable — direct deploy)
        console.log("12. Deploying Watchlist...");
        watchlist = new Watchlist(deployer);
        console.log("   Watchlist:", address(watchlist));

        // 13. AffiliateProgram (Ownable2Step — direct deploy)
        console.log("13. Deploying AffiliateProgram...");
        affiliateProgram = new AffiliateProgram(deployer, address(scoreToken));
        console.log("   AffiliateProgram:", address(affiliateProgram));

        // ============ CONFIGURATION ============
        console.log("");
        console.log("--- Configuring Contracts ---");

        // ScoreToken: authorise VotingEngine to mint rewards
        console.log("Configuring ScoreToken...");
        scoreToken.setRewardsPool(address(votingEngine));
        scoreToken.setTreasury(treasury);

        // ProjectRegistry: grant VOTING_ENGINE_ROLE to VotingEngine
        console.log("Configuring ProjectRegistry...");
        projectRegistry.setVotingEngine(address(votingEngine));

        // ProjectRegistry: grant DISPUTE_ROLE to DisputeResolution
        projectRegistry.setDisputeResolution(address(disputeResolution));

        // ProjectRegistry: register InsurancePool + BountySystem as scam listeners
        projectRegistry.addScamListener(address(insurancePool));
        projectRegistry.addScamListener(address(bountySystem));

        // InsurancePool: grant OPERATOR_ROLE to ProjectRegistry (enables onProjectScamConfirmed)
        console.log("Configuring InsurancePool...");
        insurancePool.grantRole(insurancePool.OPERATOR_ROLE(), address(projectRegistry));

        // BountySystem: grant OPERATOR_ROLE to ProjectRegistry
        console.log("Configuring BountySystem...");
        bountySystem.grantRole(bountySystem.OPERATOR_ROLE(), address(projectRegistry));

        // PremiumListings: initialise tier pricing
        console.log("Initializing PremiumListings tiers...");
        premiumListings.initializeTiers();

        // ReputationSystem: grant UPDATER_ROLE to VotingEngine (fix: was setAuthorizedUpdater)
        console.log("Configuring ReputationSystem...");
        reputationSystem.setUpdater(address(votingEngine), true);

        // VotingEngine: wire in ReputationSystem + CuratorNFT
        console.log("Configuring VotingEngine...");
        votingEngine.setReputationSystem(address(reputationSystem));
        votingEngine.setCuratorNFT(address(curatorNFT));

        // PredictionMarket: set deployer as resolver
        console.log("Configuring PredictionMarket...");
        predictionMarket.setResolver(deployer, true);

        // AffiliateProgram: authorise ProjectRegistry as referral recorder
        console.log("Configuring AffiliateProgram...");
        affiliateProgram.setAuthorizedRecorder(address(projectRegistry), true);

        // DisputeResolution: grant ARBITRATOR_ROLE to deployer (add real arbitrators later)
        console.log("Configuring DisputeResolution...");
        disputeResolution.grantRole(disputeResolution.ARBITRATOR_ROLE(), deployer);

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
        console.log("DISPUTE_RESOLUTION:", address(disputeResolution));
        console.log("WATCHLIST:", address(watchlist));
        console.log("AFFILIATE_PROGRAM:", address(affiliateProgram));
        console.log("");
        console.log("Next steps:");
        console.log("1. Run Setup.s.sol to mint initial tokens");
        console.log("2. Update dappscore/src/config/wagmi.ts with addresses above");
        console.log("3. Verify contracts on BaseScan if not auto-verified");
        console.log("4. Add additional ARBITRATOR_ROLE addresses to DisputeResolution");
        console.log("5. Set Chainlink ETH/USD oracle: tokenSale.setEthOracle(<feed-address>)");
    }
}
