// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ScoreToken.sol";

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
 *   - Legendary (Color): Bought with $SCORE tokens (burned via burnFrom)
 *
 * Benefits are applied off-chain based on NFT ownership
 */
contract CuratorNFT is ERC1155, Ownable2Step, ReentrancyGuard {
    // ============ Constants ============

    uint256 public constant EARLY_CURATOR_STANDARD = 1;
    uint256 public constant EARLY_CURATOR_LEGENDARY = 2;
    uint256 public constant SCAM_HUNTER_STANDARD = 3;
    uint256 public constant SCAM_HUNTER_LEGENDARY = 4;
    uint256 public constant TOP_VALIDATOR_STANDARD = 5;
    uint256 public constant TOP_VALIDATOR_LEGENDARY = 6;

    // ============ Structs ============

    struct NFTConfig {
        uint256 scorePrice; // $SCORE cost for legendary (0 for standard)
        uint256 maxSupply; // 0 = unlimited
        uint256 totalMinted;
        bool mintable;
        string metadataURI;
    }

    struct EarnRequirements {
        uint256 minVotes;
        uint256 minAccountAgeDays;
        uint256 minAccuracyBps; // Basis points (8500 = 85%)
        uint256 minScamsFound;
    }

    // ============ State ============

    /**
     * @dev Using ScoreToken (not plain IERC20) so we can call burnFrom() directly,
     *      ensuring burns are correctly tracked in ScoreToken.totalBurned.
     */
    ScoreToken public scoreToken;

    mapping(uint256 => NFTConfig) public nftConfigs;
    mapping(uint256 => EarnRequirements) public earnRequirements;

    mapping(address => mapping(uint256 => bool)) public hasMinted;

    mapping(address => bool) public authorizedMinters;

    // ============ Events ============

    event NFTMinted(address indexed user, uint256 indexed tokenId, bool isLegendary);
    event NFTUpgraded(address indexed user, uint256 fromTokenId, uint256 toTokenId);
    event ConfigUpdated(uint256 indexed tokenId, uint256 scorePrice, uint256 maxSupply);
    event RequirementsUpdated(uint256 indexed tokenId, uint256 minVotes, uint256 minAccuracy);
    event MinterUpdated(address indexed minter, bool authorized);

    // ============ Constructor ============

    constructor(address _initialOwner, address _scoreToken, string memory _baseUri)
        ERC1155(_baseUri)
        Ownable(_initialOwner)
    {
        scoreToken = ScoreToken(_scoreToken);

        // Early Curator
        nftConfigs[EARLY_CURATOR_STANDARD] =
            NFTConfig({scorePrice: 0, maxSupply: 0, totalMinted: 0, mintable: true, metadataURI: "early-curator-standard.json"});
        nftConfigs[EARLY_CURATOR_LEGENDARY] = NFTConfig({
            scorePrice: 10_000 * 10 ** 18, // 10,000 $SCORE
            maxSupply: 500,
            totalMinted: 0,
            mintable: true,
            metadataURI: "early-curator-legendary.json"
        });
        earnRequirements[EARLY_CURATOR_STANDARD] =
            EarnRequirements({minVotes: 50, minAccountAgeDays: 60, minAccuracyBps: 0, minScamsFound: 0});

        // Scam Hunter
        nftConfigs[SCAM_HUNTER_STANDARD] =
            NFTConfig({scorePrice: 0, maxSupply: 0, totalMinted: 0, mintable: true, metadataURI: "scam-hunter-standard.json"});
        nftConfigs[SCAM_HUNTER_LEGENDARY] = NFTConfig({
            scorePrice: 15_000 * 10 ** 18, // 15,000 $SCORE
            maxSupply: 300,
            totalMinted: 0,
            mintable: true,
            metadataURI: "scam-hunter-legendary.json"
        });
        earnRequirements[SCAM_HUNTER_STANDARD] =
            EarnRequirements({minVotes: 0, minAccountAgeDays: 30, minAccuracyBps: 0, minScamsFound: 3});

        // Top Validator
        nftConfigs[TOP_VALIDATOR_STANDARD] =
            NFTConfig({scorePrice: 0, maxSupply: 0, totalMinted: 0, mintable: true, metadataURI: "top-validator-standard.json"});
        nftConfigs[TOP_VALIDATOR_LEGENDARY] = NFTConfig({
            scorePrice: 25_000 * 10 ** 18, // 25,000 $SCORE
            maxSupply: 200,
            totalMinted: 0,
            mintable: true,
            metadataURI: "top-validator-legendary.json"
        });
        earnRequirements[TOP_VALIDATOR_STANDARD] =
            EarnRequirements({minVotes: 100, minAccountAgeDays: 90, minAccuracyBps: 8500, minScamsFound: 0});
    }

    // ============ Mint Functions ============

    /**
     * @notice Mint a standard (B&W) NFT - called by authorised minter after verifying requirements
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
     * @notice Mint a legendary (Color) NFT by burning $SCORE tokens
     * @dev Uses burnFrom() so ScoreToken.totalBurned is correctly updated.
     *      Caller must have approved this contract for the required amount.
     */
    function mintLegendary(uint256 tokenId) external nonReentrant {
        require(_isLegendaryToken(tokenId), "Not a legendary token");
        require(!hasMinted[msg.sender][tokenId], "Already minted");

        uint256 standardId = tokenId - 1;
        require(balanceOf(msg.sender, standardId) > 0, "Must own standard version first");

        NFTConfig storage config = nftConfigs[tokenId];
        require(config.mintable, "Minting disabled");
        require(config.maxSupply == 0 || config.totalMinted < config.maxSupply, "Max supply reached");
        require(config.scorePrice > 0, "Price not set");

        // FIX: use burnFrom() instead of transfer-to-dead-address so that:
        //   1. ScoreToken.totalBurned is incremented correctly
        //   2. totalSupply() is reduced (proper deflationary accounting)
        //   3. The TokensBurned event is emitted from ScoreToken
        scoreToken.burnFrom(msg.sender, config.scorePrice);

        hasMinted[msg.sender][tokenId] = true;
        config.totalMinted++;

        _mint(msg.sender, tokenId, 1, "");
        emit NFTMinted(msg.sender, tokenId, true);
        emit NFTUpgraded(msg.sender, standardId, tokenId);
    }

    // ============ View Functions ============

    function _isStandardToken(uint256 tokenId) internal pure returns (bool) {
        return tokenId == EARLY_CURATOR_STANDARD || tokenId == SCAM_HUNTER_STANDARD
            || tokenId == TOP_VALIDATOR_STANDARD;
    }

    function _isLegendaryToken(uint256 tokenId) internal pure returns (bool) {
        return tokenId == EARLY_CURATOR_LEGENDARY || tokenId == SCAM_HUNTER_LEGENDARY
            || tokenId == TOP_VALIDATOR_LEGENDARY;
    }

    function getUserNFTs(address user)
        external
        view
        returns (
            bool hasEarlyCuratorStd,
            bool hasEarlyCuratorLeg,
            bool hasScamHunterStd,
            bool hasScamHunterLeg,
            bool hasTopValidatorStd,
            bool hasTopValidatorLeg
        )
    {
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
        uint256 multiplier = 10000;

        if (balanceOf(user, EARLY_CURATOR_LEGENDARY) > 0) {
            multiplier += 2500;
        } else if (balanceOf(user, EARLY_CURATOR_STANDARD) > 0) {
            multiplier += 1000;
        }

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
        uint256 multiplier = 10000;

        if (balanceOf(user, TOP_VALIDATOR_LEGENDARY) > 0) {
            multiplier += 5000;
        } else if (balanceOf(user, TOP_VALIDATOR_STANDARD) > 0) {
            multiplier += 1500;
        }

        return multiplier;
    }

    function getAllPrices()
        external
        view
        returns (uint256 earlyCuratorPrice, uint256 scamHunterPrice, uint256 topValidatorPrice)
    {
        return (
            nftConfigs[EARLY_CURATOR_LEGENDARY].scorePrice,
            nftConfigs[SCAM_HUNTER_LEGENDARY].scorePrice,
            nftConfigs[TOP_VALIDATOR_LEGENDARY].scorePrice
        );
    }

    function getSupplyInfo(uint256 tokenId)
        external
        view
        returns (uint256 totalMinted, uint256 maxSupply, uint256 remaining)
    {
        NFTConfig memory config = nftConfigs[tokenId];
        uint256 rem = config.maxSupply == 0 ? type(uint256).max : config.maxSupply - config.totalMinted;
        return (config.totalMinted, config.maxSupply, rem);
    }

    // ============ Owner Functions ============

    function setLegendaryPrice(uint256 tokenId, uint256 newPrice) external onlyOwner {
        require(_isLegendaryToken(tokenId), "Not legendary");
        nftConfigs[tokenId].scorePrice = newPrice;
        emit ConfigUpdated(tokenId, newPrice, nftConfigs[tokenId].maxSupply);
    }

    function setMaxSupply(uint256 tokenId, uint256 newMaxSupply) external onlyOwner {
        require(newMaxSupply >= nftConfigs[tokenId].totalMinted, "Below minted");
        nftConfigs[tokenId].maxSupply = newMaxSupply;
        emit ConfigUpdated(tokenId, nftConfigs[tokenId].scorePrice, newMaxSupply);
    }

    function setEarnRequirements(
        uint256 tokenId,
        uint256 minVotes,
        uint256 minAccountAgeDays,
        uint256 minAccuracyBps,
        uint256 minScamsFound
    ) external onlyOwner {
        require(_isStandardToken(tokenId), "Not standard");
        earnRequirements[tokenId] =
            EarnRequirements({minVotes: minVotes, minAccountAgeDays: minAccountAgeDays, minAccuracyBps: minAccuracyBps, minScamsFound: minScamsFound});
        emit RequirementsUpdated(tokenId, minVotes, minAccuracyBps);
    }

    function setMintable(uint256 tokenId, bool mintable) external onlyOwner {
        nftConfigs[tokenId].mintable = mintable;
    }

    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        authorizedMinters[minter] = authorized;
        emit MinterUpdated(minter, authorized);
    }

    function setScoreToken(address _scoreToken) external onlyOwner {
        require(_scoreToken != address(0), "Invalid address");
        scoreToken = ScoreToken(_scoreToken);
    }

    function setTokenURI(uint256 tokenId, string calldata newUri) external onlyOwner {
        nftConfigs[tokenId].metadataURI = newUri;
    }

    function setBaseURI(string calldata newBaseUri) external onlyOwner {
        _setURI(newBaseUri);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory baseUri = super.uri(tokenId);
        string memory tokenUri = nftConfigs[tokenId].metadataURI;
        return string(abi.encodePacked(baseUri, tokenUri));
    }

    /**
     * @notice Owner mint for giveaways/rewards (bypasses standard earn requirements)
     */
    function ownerMint(address to, uint256 tokenId, uint256 amount) external onlyOwner {
        NFTConfig storage config = nftConfigs[tokenId];
        require(config.maxSupply == 0 || config.totalMinted + amount <= config.maxSupply, "Exceeds max");
        config.totalMinted += amount;
        _mint(to, tokenId, amount, "");
    }
}
