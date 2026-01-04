// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CuratorNFT
 * @notice DappScore achievement NFTs with 2 tiers
 * @dev ERC-1155 multi-token contract
 *
 * NFT Types:
 *   1. Early Curator (Purple) - For early voters
 *   2. Scam Hunter (Red) - For catching scams
 *   3. Top Validator (Blue) - For high accuracy
 *
 * Tiers:
 *   - Standard (B&W): Earned through activity
 *   - Legendary (Color): Bought with $SCORE tokens (burned)
 *
 * Benefits are applied off-chain based on NFT ownership
 */
contract CuratorNFT is ERC1155, Ownable, ReentrancyGuard {

    // ============ Constants ============

    // Token IDs
    uint256 public constant EARLY_CURATOR_STANDARD = 1;
    uint256 public constant EARLY_CURATOR_LEGENDARY = 2;
    uint256 public constant SCAM_HUNTER_STANDARD = 3;
    uint256 public constant SCAM_HUNTER_LEGENDARY = 4;
    uint256 public constant TOP_VALIDATOR_STANDARD = 5;
    uint256 public constant TOP_VALIDATOR_LEGENDARY = 6;

    // ============ Structs ============

    struct NFTConfig {
        uint256 scorePrice;      // $SCORE cost for legendary (0 for standard)
        uint256 maxSupply;       // 0 = unlimited
        uint256 totalMinted;
        bool mintable;           // Can be minted
        string metadataURI;      // Individual token URI
    }

    struct EarnRequirements {
        uint256 minVotes;
        uint256 minAccountAgeDays;
        uint256 minAccuracyBps;  // Basis points (8500 = 85%)
        uint256 minScamsFound;
    }

    // ============ State ============

    IERC20 public scoreToken;
    address public burnAddress = 0x000000000000000000000000000000000000dEaD;

    // Token configs (owner-adjustable)
    mapping(uint256 => NFTConfig) public nftConfigs;
    mapping(uint256 => EarnRequirements) public earnRequirements;

    // User tracking
    mapping(address => mapping(uint256 => bool)) public hasMinted;

    // Authorized minters (for backend to verify off-chain requirements)
    mapping(address => bool) public authorizedMinters;

    // ============ Events ============

    event NFTMinted(address indexed user, uint256 indexed tokenId, bool isLegendary);
    event NFTUpgraded(address indexed user, uint256 fromTokenId, uint256 toTokenId);
    event ConfigUpdated(uint256 indexed tokenId, uint256 scorePrice, uint256 maxSupply);
    event RequirementsUpdated(uint256 indexed tokenId, uint256 minVotes, uint256 minAccuracy);
    event MinterUpdated(address indexed minter, bool authorized);

    // ============ Constructor ============

    constructor(
        address _initialOwner,
        address _scoreToken,
        string memory _baseUri
    ) ERC1155(_baseUri) Ownable(_initialOwner) {
        scoreToken = IERC20(_scoreToken);

        // Initialize configs with default prices (adjustable later)

        // Early Curator
        nftConfigs[EARLY_CURATOR_STANDARD] = NFTConfig({
            scorePrice: 0,
            maxSupply: 0,  // Unlimited
            totalMinted: 0,
            mintable: true,
            metadataURI: "early-curator-standard.json"
        });
        nftConfigs[EARLY_CURATOR_LEGENDARY] = NFTConfig({
            scorePrice: 10_000 * 10**18,  // 10,000 $SCORE
            maxSupply: 500,  // Limited
            totalMinted: 0,
            mintable: true,
            metadataURI: "early-curator-legendary.json"
        });
        earnRequirements[EARLY_CURATOR_STANDARD] = EarnRequirements({
            minVotes: 50,
            minAccountAgeDays: 60,
            minAccuracyBps: 0,
            minScamsFound: 0
        });

        // Scam Hunter
        nftConfigs[SCAM_HUNTER_STANDARD] = NFTConfig({
            scorePrice: 0,
            maxSupply: 0,
            totalMinted: 0,
            mintable: true,
            metadataURI: "scam-hunter-standard.json"
        });
        nftConfigs[SCAM_HUNTER_LEGENDARY] = NFTConfig({
            scorePrice: 15_000 * 10**18,  // 15,000 $SCORE
            maxSupply: 300,
            totalMinted: 0,
            mintable: true,
            metadataURI: "scam-hunter-legendary.json"
        });
        earnRequirements[SCAM_HUNTER_STANDARD] = EarnRequirements({
            minVotes: 0,
            minAccountAgeDays: 30,
            minAccuracyBps: 0,
            minScamsFound: 3
        });

        // Top Validator
        nftConfigs[TOP_VALIDATOR_STANDARD] = NFTConfig({
            scorePrice: 0,
            maxSupply: 0,
            totalMinted: 0,
            mintable: true,
            metadataURI: "top-validator-standard.json"
        });
        nftConfigs[TOP_VALIDATOR_LEGENDARY] = NFTConfig({
            scorePrice: 25_000 * 10**18,  // 25,000 $SCORE
            maxSupply: 200,
            totalMinted: 0,
            mintable: true,
            metadataURI: "top-validator-legendary.json"
        });
        earnRequirements[TOP_VALIDATOR_STANDARD] = EarnRequirements({
            minVotes: 100,
            minAccountAgeDays: 90,
            minAccuracyBps: 8500,  // 85%
            minScamsFound: 0
        });
    }

    // ============ Mint Functions ============

    /**
     * @notice Mint a standard (B&W) NFT - called by authorized minter after verifying requirements
     * @param user Address to mint to
     * @param tokenId Standard token ID (1, 3, or 5)
     */
    function mintStandard(address user, uint256 tokenId) external nonReentrant {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized");
        require(_isStandardToken(tokenId), "Not a standard token");
        require(!hasMinted[user][tokenId], "Already minted");

        NFTConfig storage config = nftConfigs[tokenId];
        require(config.mintable, "Minting disabled");
        require(config.maxSupply == 0 || config.totalMinted < config.maxSupply, "Max supply reached");

        hasMinted[user][tokenId] = true;
        config.totalMinted++;

        _mint(user, tokenId, 1, "");
        emit NFTMinted(user, tokenId, false);
    }

    /**
     * @notice Mint a legendary (Color) NFT by burning $SCORE
     * @param tokenId Legendary token ID (2, 4, or 6)
     */
    function mintLegendary(uint256 tokenId) external nonReentrant {
        require(_isLegendaryToken(tokenId), "Not a legendary token");
        require(!hasMinted[msg.sender][tokenId], "Already minted");

        // Must own the standard version first
        uint256 standardId = tokenId - 1;
        require(balanceOf(msg.sender, standardId) > 0, "Must own standard version first");

        NFTConfig storage config = nftConfigs[tokenId];
        require(config.mintable, "Minting disabled");
        require(config.maxSupply == 0 || config.totalMinted < config.maxSupply, "Max supply reached");
        require(config.scorePrice > 0, "Price not set");

        // Burn $SCORE tokens
        require(scoreToken.transferFrom(msg.sender, burnAddress, config.scorePrice), "Burn failed");

        hasMinted[msg.sender][tokenId] = true;
        config.totalMinted++;

        _mint(msg.sender, tokenId, 1, "");
        emit NFTMinted(msg.sender, tokenId, true);
        emit NFTUpgraded(msg.sender, standardId, tokenId);
    }

    // ============ View Functions ============

    function _isStandardToken(uint256 tokenId) internal pure returns (bool) {
        return tokenId == EARLY_CURATOR_STANDARD ||
               tokenId == SCAM_HUNTER_STANDARD ||
               tokenId == TOP_VALIDATOR_STANDARD;
    }

    function _isLegendaryToken(uint256 tokenId) internal pure returns (bool) {
        return tokenId == EARLY_CURATOR_LEGENDARY ||
               tokenId == SCAM_HUNTER_LEGENDARY ||
               tokenId == TOP_VALIDATOR_LEGENDARY;
    }

    /**
     * @notice Get user's NFT holdings and benefits
     */
    function getUserNFTs(address user) external view returns (
        bool hasEarlyCuratorStd,
        bool hasEarlyCuratorLeg,
        bool hasScamHunterStd,
        bool hasScamHunterLeg,
        bool hasTopValidatorStd,
        bool hasTopValidatorLeg
    ) {
        return (
            balanceOf(user, EARLY_CURATOR_STANDARD) > 0,
            balanceOf(user, EARLY_CURATOR_LEGENDARY) > 0,
            balanceOf(user, SCAM_HUNTER_STANDARD) > 0,
            balanceOf(user, SCAM_HUNTER_LEGENDARY) > 0,
            balanceOf(user, TOP_VALIDATOR_STANDARD) > 0,
            balanceOf(user, TOP_VALIDATOR_LEGENDARY) > 0
        );
    }

    /**
     * @notice Calculate total vote weight multiplier for a user (in basis points)
     * @dev 10000 = 1x, 11000 = 1.1x, etc.
     */
    function getVoteWeightMultiplier(address user) external view returns (uint256) {
        uint256 multiplier = 10000; // Base 1x

        // Early Curator: +10% standard, +25% legendary
        if (balanceOf(user, EARLY_CURATOR_LEGENDARY) > 0) {
            multiplier += 2500;
        } else if (balanceOf(user, EARLY_CURATOR_STANDARD) > 0) {
            multiplier += 1000;
        }

        // Top Validator: +15% standard, +25% legendary (stacks)
        if (balanceOf(user, TOP_VALIDATOR_LEGENDARY) > 0) {
            multiplier += 2500;
        } else if (balanceOf(user, TOP_VALIDATOR_STANDARD) > 0) {
            multiplier += 1500;
        }

        return multiplier;
    }

    /**
     * @notice Calculate reward multiplier for a user (in basis points)
     */
    function getRewardMultiplier(address user) external view returns (uint256) {
        uint256 multiplier = 10000; // Base 1x

        // Top Validator: +15% standard, +50% legendary
        if (balanceOf(user, TOP_VALIDATOR_LEGENDARY) > 0) {
            multiplier += 5000;
        } else if (balanceOf(user, TOP_VALIDATOR_STANDARD) > 0) {
            multiplier += 1500;
        }

        return multiplier;
    }

    /**
     * @notice Get all prices for display
     */
    function getAllPrices() external view returns (
        uint256 earlyCuratorPrice,
        uint256 scamHunterPrice,
        uint256 topValidatorPrice
    ) {
        return (
            nftConfigs[EARLY_CURATOR_LEGENDARY].scorePrice,
            nftConfigs[SCAM_HUNTER_LEGENDARY].scorePrice,
            nftConfigs[TOP_VALIDATOR_LEGENDARY].scorePrice
        );
    }

    /**
     * @notice Get supply info for a token
     */
    function getSupplyInfo(uint256 tokenId) external view returns (
        uint256 totalMinted,
        uint256 maxSupply,
        uint256 remaining
    ) {
        NFTConfig memory config = nftConfigs[tokenId];
        uint256 rem = config.maxSupply == 0 ? type(uint256).max : config.maxSupply - config.totalMinted;
        return (config.totalMinted, config.maxSupply, rem);
    }

    // ============ Owner Functions ============

    /**
     * @notice Update $SCORE price for legendary NFTs
     */
    function setLegendaryPrice(uint256 tokenId, uint256 newPrice) external onlyOwner {
        require(_isLegendaryToken(tokenId), "Not legendary");
        nftConfigs[tokenId].scorePrice = newPrice;
        emit ConfigUpdated(tokenId, newPrice, nftConfigs[tokenId].maxSupply);
    }

    /**
     * @notice Update max supply for a token
     */
    function setMaxSupply(uint256 tokenId, uint256 newMaxSupply) external onlyOwner {
        require(newMaxSupply >= nftConfigs[tokenId].totalMinted, "Below minted");
        nftConfigs[tokenId].maxSupply = newMaxSupply;
        emit ConfigUpdated(tokenId, nftConfigs[tokenId].scorePrice, newMaxSupply);
    }

    /**
     * @notice Update earn requirements for standard NFTs
     */
    function setEarnRequirements(
        uint256 tokenId,
        uint256 minVotes,
        uint256 minAccountAgeDays,
        uint256 minAccuracyBps,
        uint256 minScamsFound
    ) external onlyOwner {
        require(_isStandardToken(tokenId), "Not standard");
        earnRequirements[tokenId] = EarnRequirements({
            minVotes: minVotes,
            minAccountAgeDays: minAccountAgeDays,
            minAccuracyBps: minAccuracyBps,
            minScamsFound: minScamsFound
        });
        emit RequirementsUpdated(tokenId, minVotes, minAccuracyBps);
    }

    /**
     * @notice Enable/disable minting for a token
     */
    function setMintable(uint256 tokenId, bool mintable) external onlyOwner {
        nftConfigs[tokenId].mintable = mintable;
    }

    /**
     * @notice Set authorized minter (backend service)
     */
    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        authorizedMinters[minter] = authorized;
        emit MinterUpdated(minter, authorized);
    }

    /**
     * @notice Update $SCORE token address
     */
    function setScoreToken(address _scoreToken) external onlyOwner {
        scoreToken = IERC20(_scoreToken);
    }

    /**
     * @notice Update burn address
     */
    function setBurnAddress(address _burnAddress) external onlyOwner {
        burnAddress = _burnAddress;
    }

    /**
     * @notice Update metadata URI for a token
     */
    function setTokenURI(uint256 tokenId, string calldata newUri) external onlyOwner {
        nftConfigs[tokenId].metadataURI = newUri;
    }

    /**
     * @notice Update base URI
     */
    function setBaseURI(string calldata newBaseUri) external onlyOwner {
        _setURI(newBaseUri);
    }

    /**
     * @notice Get URI for a specific token
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory baseUri = super.uri(tokenId);
        string memory tokenUri = nftConfigs[tokenId].metadataURI;
        return string(abi.encodePacked(baseUri, tokenUri));
    }

    /**
     * @notice Owner mint for giveaways/rewards
     */
    function ownerMint(address to, uint256 tokenId, uint256 amount) external onlyOwner {
        NFTConfig storage config = nftConfigs[tokenId];
        require(config.maxSupply == 0 || config.totalMinted + amount <= config.maxSupply, "Exceeds max");
        config.totalMinted += amount;
        _mint(to, tokenId, amount, "");
    }
}
