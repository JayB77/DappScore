// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PremiumListings
 * @notice Projects pay USDC to get featured placement at the top of the directory
 * @dev Daily rate is configurable by owner. Payment goes directly to treasury.
 *      Premium status is tracked on-chain; the subgraph reads it to surface
 *      isPremium / premiumExpiresAt on the Project entity.
 */
contract PremiumListings is Ownable, ReentrancyGuard {

    IERC20 public immutable usdc;
    address public treasury;

    /// @notice Cost per day in USDC (6 decimals). Default: $100.
    uint256 public dailyRate = 100 * 10 ** 6;

    /// @notice projectId => timestamp when premium expires (0 = not premium)
    mapping(uint256 => uint256) public premiumExpiry;

    event PremiumPurchased(
        uint256 indexed projectId,
        address indexed buyer,
        uint256 numDays,
        uint256 expiresAt
    );
    event DailyRateUpdated(uint256 newRate);
    event TreasuryUpdated(address newTreasury);

    constructor(address _initialOwner, address _usdc, address _treasury) Ownable(_initialOwner) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    // ============ Core ============

    /**
     * @notice Purchase featured placement for a project
     * @param _projectId Project to feature
     * @param _numDays Number of days to purchase (stacks on existing premium)
     */
    function purchasePremium(uint256 _projectId, uint256 _numDays) external nonReentrant {
        require(_numDays > 0, "Days must be > 0");

        uint256 cost = _numDays * dailyRate;
        require(usdc.transferFrom(msg.sender, treasury, cost), "Payment failed");

        // Stack on top of existing expiry if still active
        uint256 current = premiumExpiry[_projectId];
        uint256 start = current > block.timestamp ? current : block.timestamp;
        uint256 newExpiry = start + (_numDays * 1 days);
        premiumExpiry[_projectId] = newExpiry;

        emit PremiumPurchased(_projectId, msg.sender, _numDays, newExpiry);
    }

    // ============ View ============

    function isPremiumActive(uint256 _projectId) external view returns (bool) {
        return premiumExpiry[_projectId] > block.timestamp;
    }

    // ============ Admin ============

    function setDailyRate(uint256 _newRate) external onlyOwner {
        require(_newRate > 0, "Rate must be > 0");
        dailyRate = _newRate;
        emit DailyRateUpdated(_newRate);
    }

    function setTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid treasury");
        treasury = _newTreasury;
        emit TreasuryUpdated(_newTreasury);
    }

    /// @dev No-op kept for deploy script compatibility
    function initializeTiers() external onlyOwner {}
}
