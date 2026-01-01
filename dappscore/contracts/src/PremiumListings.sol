// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PremiumListings
 * @notice Handles premium/featured placement for projects
 * @dev Projects can pay in ETH or SCORE for premium placement
 *
 * Tiers: Bronze (1d), Silver (3d), Gold (7d), Platinum (14d), Diamond (30d)
 */
contract PremiumListings is Ownable, ReentrancyGuard {

    enum PremiumTier { None, Bronze, Silver, Gold, Platinum, Diamond }

    struct PremiumListing {
        uint256 projectId;
        PremiumTier tier;
        uint256 startTime;
        uint256 endTime;
        bool active;
    }

    struct TierConfig {
        uint256 durationDays;
        uint256 priceEth;
    }

    // Contracts
    IERC20 public scoreToken;
    address public projectRegistry;

    // State
    mapping(PremiumTier => TierConfig) public tierConfigs;
    mapping(uint256 => PremiumListing) public premiumListings;
    uint256[] public activePremiumIds;

    // Revenue
    address public treasury;
    address public rewardsPool;
    uint256 public rewardsShare = 7000;  // 70%
    uint256 public treasuryShare = 3000; // 30%

    // Stats
    uint256 public totalRevenue;

    event PremiumPurchased(uint256 indexed projectId, PremiumTier tier, uint256 amount, uint256 endTime);
    event PremiumExpired(uint256 indexed projectId);
    event TierConfigUpdated(PremiumTier tier, uint256 duration, uint256 price);

    constructor(
        address _initialOwner,
        address _scoreToken,
        address _projectRegistry,
        address _treasury,
        address _rewardsPool
    ) Ownable(_initialOwner) {
        scoreToken = IERC20(_scoreToken);
        projectRegistry = _projectRegistry;
        treasury = _treasury;
        rewardsPool = _rewardsPool;
    }

    /**
     * @notice Initialize tier configs (call after deployment)
     */
    function initializeTiers() external onlyOwner {
        tierConfigs[PremiumTier.Bronze] = TierConfig(1, 0.05 ether);
        tierConfigs[PremiumTier.Silver] = TierConfig(3, 0.12 ether);
        tierConfigs[PremiumTier.Gold] = TierConfig(7, 0.25 ether);
        tierConfigs[PremiumTier.Platinum] = TierConfig(14, 0.45 ether);
        tierConfigs[PremiumTier.Diamond] = TierConfig(30, 0.80 ether);
    }

    /**
     * @notice Purchase premium listing with ETH
     */
    function purchaseWithEth(uint256 _projectId, PremiumTier _tier) external payable nonReentrant {
        require(_tier != PremiumTier.None, "Invalid tier");
        TierConfig memory config = tierConfigs[_tier];
        require(config.durationDays > 0, "Tier not configured");
        require(msg.value >= config.priceEth, "Insufficient ETH");

        _activatePremium(_projectId, _tier, config.durationDays);
        _distributeRevenue(msg.value);
        totalRevenue += msg.value;

        emit PremiumPurchased(_projectId, _tier, msg.value, premiumListings[_projectId].endTime);
    }

    /**
     * @notice Activate premium listing
     */
    function _activatePremium(uint256 _projectId, PremiumTier _tier, uint256 _days) internal {
        PremiumListing storage listing = premiumListings[_projectId];

        uint256 startTime = block.timestamp;
        if (listing.active && listing.endTime > block.timestamp) {
            startTime = listing.endTime;
        }

        listing.projectId = _projectId;
        listing.tier = _tier;
        listing.startTime = startTime;
        listing.endTime = startTime + (_days * 1 days);
        listing.active = true;

        // Track active
        bool found = false;
        for (uint256 i = 0; i < activePremiumIds.length; i++) {
            if (activePremiumIds[i] == _projectId) {
                found = true;
                break;
            }
        }
        if (!found) {
            activePremiumIds.push(_projectId);
        }
    }

    /**
     * @notice Distribute ETH revenue
     */
    function _distributeRevenue(uint256 _amount) internal {
        uint256 rewardsAmount = (_amount * rewardsShare) / 10000;
        uint256 treasuryAmount = _amount - rewardsAmount;

        if (rewardsAmount > 0 && rewardsPool != address(0)) {
            (bool sent1, ) = rewardsPool.call{value: rewardsAmount}("");
            require(sent1, "Rewards transfer failed");
        }

        if (treasuryAmount > 0) {
            (bool sent2, ) = treasury.call{value: treasuryAmount}("");
            require(sent2, "Treasury transfer failed");
        }
    }

    // View functions

    function isPremium(uint256 _projectId) external view returns (bool) {
        PremiumListing memory listing = premiumListings[_projectId];
        return listing.active && listing.endTime > block.timestamp;
    }

    function getPremiumListing(uint256 _projectId) external view returns (PremiumListing memory) {
        return premiumListings[_projectId];
    }

    function getTierConfig(PremiumTier _tier) external view returns (TierConfig memory) {
        return tierConfigs[_tier];
    }

    function getActivePremiumCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < activePremiumIds.length; i++) {
            if (premiumListings[activePremiumIds[i]].endTime > block.timestamp) {
                count++;
            }
        }
        return count;
    }

    // Admin functions

    function setTierConfig(PremiumTier _tier, uint256 _days, uint256 _price) external onlyOwner {
        tierConfigs[_tier] = TierConfig(_days, _price);
        emit TierConfigUpdated(_tier, _days, _price);
    }

    function setShares(uint256 _rewards, uint256 _treasury) external onlyOwner {
        require(_rewards + _treasury == 10000, "Must equal 100%");
        rewardsShare = _rewards;
        treasuryShare = _treasury;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setRewardsPool(address _pool) external onlyOwner {
        rewardsPool = _pool;
    }
}
