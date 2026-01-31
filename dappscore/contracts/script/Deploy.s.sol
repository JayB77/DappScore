// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/ScoreToken.sol";
import "../src/ProjectRegistry.sol";
import "../src/VotingEngine.sol";
import "../src/TokenSale.sol";
import "../src/PremiumListings.sol";
import "../src/CuratorNFT.sol";

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
    // Deployed contract addresses
    ScoreToken public scoreToken;
    ProjectRegistry public projectRegistry;
    VotingEngine public votingEngine;
    TokenSale public tokenSale;
    PremiumListings public premiumListings;
    CuratorNFT public curatorNFT;

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

        console.log("=== DappScore Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);
        console.log("USDC:", usdc);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy ScoreToken
        console.log("1. Deploying ScoreToken...");
        scoreToken = new ScoreToken(deployer);
        console.log("   ScoreToken deployed at:", address(scoreToken));

        // 2. Deploy ProjectRegistry
        console.log("2. Deploying ProjectRegistry...");
        projectRegistry = new ProjectRegistry(
            deployer,
            treasury,
            listingFee,
            verificationFee
        );
        console.log("   ProjectRegistry deployed at:", address(projectRegistry));

        // 3. Deploy VotingEngine
        console.log("3. Deploying VotingEngine...");
        votingEngine = new VotingEngine(
            deployer,
            address(scoreToken),
            address(projectRegistry)
        );
        console.log("   VotingEngine deployed at:", address(votingEngine));

        // 4. Deploy TokenSale
        console.log("4. Deploying TokenSale...");
        tokenSale = new TokenSale(
            deployer,
            address(scoreToken),
            usdc,
            usdt,
            treasury
        );
        console.log("   TokenSale deployed at:", address(tokenSale));

        // 5. Deploy PremiumListings
        console.log("5. Deploying PremiumListings...");
        premiumListings = new PremiumListings(
            deployer,
            address(scoreToken),
            address(projectRegistry),
            treasury,
            address(votingEngine) // Rewards go to voting engine
        );
        console.log("   PremiumListings deployed at:", address(premiumListings));

        // 6. Deploy CuratorNFT
        console.log("6. Deploying CuratorNFT...");
        curatorNFT = new CuratorNFT(
            deployer,
            address(scoreToken),
            nftBaseUri
        );
        console.log("   CuratorNFT deployed at:", address(curatorNFT));

        console.log("");
        console.log("=== Configuring Contracts ===");

        // Configure ScoreToken
        console.log("Setting ScoreToken rewards pool...");
        scoreToken.setRewardsPool(address(votingEngine));
        scoreToken.setTreasury(treasury);

        // Configure ProjectRegistry
        console.log("Setting ProjectRegistry voting engine...");
        projectRegistry.setVotingEngine(address(votingEngine));

        // Initialize PremiumListings tiers
        console.log("Initializing premium listing tiers...");
        premiumListings.initializeTiers();

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("");
        console.log("Contract Addresses (copy to wagmi.ts):");
        console.log("----------------------------------------");
        console.log("SCORE_TOKEN:", address(scoreToken));
        console.log("PROJECT_REGISTRY:", address(projectRegistry));
        console.log("VOTING_ENGINE:", address(votingEngine));
        console.log("TOKEN_SALE:", address(tokenSale));
        console.log("PREMIUM_LISTINGS:", address(premiumListings));
        console.log("CURATOR_NFT:", address(curatorNFT));
        console.log("----------------------------------------");
        console.log("");
        console.log("Next steps:");
        console.log("1. Run Setup.s.sol to mint initial tokens");
        console.log("2. Update dappscore/src/config/wagmi.ts with addresses above");
        console.log("3. Verify contracts on BaseScan if not auto-verified");
    }
}
