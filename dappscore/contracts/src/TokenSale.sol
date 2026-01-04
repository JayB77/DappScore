// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ScoreToken.sol";

/**
 * @title TokenSale
 * @notice DappScore's fair launch token sale with 3 stages
 * @dev Features:
 *      - 3 stages with increasing prices (incentivizes early participation)
 *      - Fair launch: no private rounds, no whitelist
 *      - Multi-currency: ETH, USDC, USDT
 *      - Per-user investment cap (prevents whales from buying all)
 *      - Claim-based: tokens are held until sale ends, then users claim
 *      - All parameters owner-adjustable via contract
 *
 * Typical Stage Pricing:
 *   Stage 1: $0.008 (20% discount - early supporters)
 *   Stage 2: $0.009 (10% discount - growth phase)
 *   Stage 3: $0.010 (full price - final sale)
 */
contract TokenSale is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum Stage { NotStarted, Stage1, Stage2, Stage3, Ended }

    // ============ Structs ============

    struct StageConfig {
        uint256 tokenPriceUsd;   // Price in USD with 6 decimals (e.g., 8000 = $0.008)
        uint256 allocation;       // Tokens available in this stage
        uint256 sold;             // Tokens sold in this stage
        uint256 startTime;        // Unix timestamp
        uint256 endTime;          // Unix timestamp
    }

    // ============ State Variables ============

    // Token being sold
    ScoreToken public scoreToken;

    // Accepted payment tokens
    IERC20 public usdc;
    IERC20 public usdt;

    // Current stage
    Stage public currentStage;

    // Stage configurations (owner-adjustable)
    mapping(Stage => StageConfig) public stageConfigs;

    // ETH/USD price (owner-adjustable for ETH purchases)
    uint256 public ethPriceUsd;  // 6 decimals (e.g., 3000_000000 = $3000)

    // Purchase limits (owner-adjustable)
    uint256 public minPurchaseUsd;   // Minimum per transaction
    uint256 public maxPurchaseUsd;   // Maximum per wallet (investment cap)

    // User tracking
    mapping(address => uint256) public userPurchasedUsd;   // Total USD invested
    mapping(address => uint256) public userTokensOwed;     // Tokens to claim
    mapping(address => bool) public hasClaimed;

    // Totals
    uint256 public totalRaisedUsd;
    uint256 public totalTokensSold;
    uint256 public totalContributors;

    // Treasury (receives funds)
    address public treasury;

    // Claim enabled (set by owner after sale ends)
    bool public claimEnabled;

    // ============ Events ============

    event StageStarted(Stage stage, uint256 startTime, uint256 endTime);
    event StageEnded(Stage stage);
    event TokensPurchasedWithEth(address indexed buyer, Stage stage, uint256 ethAmount, uint256 usdValue, uint256 tokenAmount);
    event TokensPurchasedWithToken(address indexed buyer, Stage stage, address token, uint256 amount, uint256 tokenAmount);
    event TokensClaimed(address indexed buyer, uint256 amount);
    event StageConfigUpdated(Stage stage, uint256 price, uint256 allocation, uint256 startTime, uint256 endTime);
    event StageExtended(Stage stage, uint256 newEndTime);
    event LimitsUpdated(uint256 minUsd, uint256 maxUsd);
    event EthPriceUpdated(uint256 newPrice);
    event ClaimEnabled();

    // ============ Constructor ============

    constructor(
        address _initialOwner,
        address _scoreToken,
        address _usdc,
        address _usdt,
        address _treasury
    ) Ownable(_initialOwner) {
        scoreToken = ScoreToken(_scoreToken);
        usdc = IERC20(_usdc);
        usdt = IERC20(_usdt);
        treasury = _treasury;
        currentStage = Stage.NotStarted;

        // Default configuration
        ethPriceUsd = 3000_000000;        // $3000 per ETH
        minPurchaseUsd = 20_000000;       // $20 minimum
        maxPurchaseUsd = 5000_000000;     // $5,000 max per wallet

        // Default stage configs (can be adjusted before sale starts)
        // Stage 1: Early supporters - 20% discount
        stageConfigs[Stage.Stage1] = StageConfig({
            tokenPriceUsd: 8000,           // $0.008
            allocation: 166_666 * 10**18,  // ~1/3 of 500k
            sold: 0,
            startTime: 0,
            endTime: 0
        });

        // Stage 2: Growth phase - 10% discount
        stageConfigs[Stage.Stage2] = StageConfig({
            tokenPriceUsd: 9000,           // $0.009
            allocation: 166_667 * 10**18,  // ~1/3 of 500k
            sold: 0,
            startTime: 0,
            endTime: 0
        });

        // Stage 3: Final sale - full price
        stageConfigs[Stage.Stage3] = StageConfig({
            tokenPriceUsd: 10000,          // $0.01
            allocation: 166_667 * 10**18,  // ~1/3 of 500k
            sold: 0,
            startTime: 0,
            endTime: 0
        });
    }

    // ============ Purchase Functions ============

    /**
     * @notice Buy tokens with ETH
     */
    function buyWithEth() external payable nonReentrant {
        require(currentStage >= Stage.Stage1 && currentStage <= Stage.Stage3, "Sale not active");
        require(msg.value > 0, "No ETH sent");

        StageConfig storage config = stageConfigs[currentStage];
        require(block.timestamp >= config.startTime, "Stage not started");
        require(block.timestamp <= config.endTime, "Stage ended");

        // Calculate USD value of ETH sent
        uint256 usdValue = (msg.value * ethPriceUsd) / 1 ether;

        _processPurchase(usdValue, config);

        // Transfer ETH to treasury
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "ETH transfer failed");

        emit TokensPurchasedWithEth(msg.sender, currentStage, msg.value, usdValue, _calculateTokens(usdValue, config.tokenPriceUsd));
    }

    /**
     * @notice Buy tokens with USDC
     */
    function buyWithUsdc(uint256 amount) external nonReentrant {
        _buyWithStablecoin(address(usdc), amount);
    }

    /**
     * @notice Buy tokens with USDT
     */
    function buyWithUsdt(uint256 amount) external nonReentrant {
        _buyWithStablecoin(address(usdt), amount);
    }

    function _buyWithStablecoin(address token, uint256 amount) internal {
        require(currentStage >= Stage.Stage1 && currentStage <= Stage.Stage3, "Sale not active");
        require(token != address(0), "Token not configured");
        require(amount > 0, "Amount must be > 0");

        StageConfig storage config = stageConfigs[currentStage];
        require(block.timestamp >= config.startTime, "Stage not started");
        require(block.timestamp <= config.endTime, "Stage ended");

        // For stablecoins, amount IS the USD value (both have 6 decimals)
        uint256 usdValue = amount;
        uint256 tokenAmount = _processPurchase(usdValue, config);

        // Transfer stablecoin to treasury
        IERC20(token).safeTransferFrom(msg.sender, treasury, amount);

        emit TokensPurchasedWithToken(msg.sender, currentStage, token, amount, tokenAmount);
    }

    function _processPurchase(uint256 usdValue, StageConfig storage config) internal returns (uint256) {
        // Validate limits
        require(usdValue >= minPurchaseUsd, "Below minimum purchase");
        require(userPurchasedUsd[msg.sender] + usdValue <= maxPurchaseUsd, "Exceeds maximum per wallet");

        // Calculate tokens
        uint256 tokenAmount = _calculateTokens(usdValue, config.tokenPriceUsd);
        require(config.sold + tokenAmount <= config.allocation, "Exceeds stage allocation");

        // Update state
        if (userPurchasedUsd[msg.sender] == 0) {
            totalContributors++;
        }

        userPurchasedUsd[msg.sender] += usdValue;
        userTokensOwed[msg.sender] += tokenAmount;
        config.sold += tokenAmount;
        totalRaisedUsd += usdValue;
        totalTokensSold += tokenAmount;

        return tokenAmount;
    }

    function _calculateTokens(uint256 usdValue, uint256 priceUsd) internal pure returns (uint256) {
        // usdValue has 6 decimals, priceUsd has 6 decimals
        // Result should have 18 decimals (token decimals)
        return (usdValue * 10**18) / priceUsd;
    }

    // ============ Claim Function ============

    /**
     * @notice Claim purchased tokens (after sale ends and claiming is enabled)
     */
    function claimTokens() external nonReentrant {
        require(claimEnabled, "Claiming not enabled yet");
        require(userTokensOwed[msg.sender] > 0, "No tokens to claim");
        require(!hasClaimed[msg.sender], "Already claimed");

        uint256 amount = userTokensOwed[msg.sender];
        hasClaimed[msg.sender] = true;

        scoreToken.transfer(msg.sender, amount);

        emit TokensClaimed(msg.sender, amount);
    }

    // ============ Owner Functions ============

    /**
     * @notice Configure a stage (must be done before stage starts)
     */
    function setStageConfig(
        Stage _stage,
        uint256 _priceUsd,
        uint256 _allocation,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyOwner {
        require(_stage >= Stage.Stage1 && _stage <= Stage.Stage3, "Invalid stage");
        require(_endTime > _startTime, "Invalid times");
        require(_priceUsd > 0, "Price must be > 0");

        StageConfig storage config = stageConfigs[_stage];
        require(config.sold == 0, "Cannot modify after sales");

        config.tokenPriceUsd = _priceUsd;
        config.allocation = _allocation;
        config.startTime = _startTime;
        config.endTime = _endTime;

        emit StageConfigUpdated(_stage, _priceUsd, _allocation, _startTime, _endTime);
    }

    /**
     * @notice Start a specific stage
     */
    function startStage(Stage _stage) external onlyOwner {
        require(_stage >= Stage.Stage1 && _stage <= Stage.Stage3, "Invalid stage");
        require(currentStage == Stage.NotStarted || uint8(_stage) == uint8(currentStage) + 1, "Invalid stage order");

        StageConfig storage config = stageConfigs[_stage];
        require(config.startTime > 0 && config.endTime > 0, "Stage not configured");

        // Ensure we have enough tokens for all stages
        uint256 totalNeeded = stageConfigs[Stage.Stage1].allocation +
                              stageConfigs[Stage.Stage2].allocation +
                              stageConfigs[Stage.Stage3].allocation;
        require(scoreToken.balanceOf(address(this)) >= totalNeeded, "Insufficient token balance");

        currentStage = _stage;
        emit StageStarted(_stage, config.startTime, config.endTime);
    }

    /**
     * @notice End current stage and optionally move to next
     */
    function endCurrentStage() external onlyOwner {
        require(currentStage >= Stage.Stage1 && currentStage <= Stage.Stage3, "No active stage");

        emit StageEnded(currentStage);

        if (currentStage == Stage.Stage3) {
            currentStage = Stage.Ended;
        } else {
            // Move to next stage
            currentStage = Stage(uint8(currentStage) + 1);
        }
    }

    /**
     * @notice Extend the current stage's end time
     * @param additionalTime Extra seconds to add to the current stage
     */
    function extendCurrentStage(uint256 additionalTime) external onlyOwner {
        require(currentStage >= Stage.Stage1 && currentStage <= Stage.Stage3, "No active stage");
        require(additionalTime > 0, "Must extend by > 0");

        StageConfig storage config = stageConfigs[currentStage];
        config.endTime += additionalTime;

        emit StageExtended(currentStage, config.endTime);
    }

    /**
     * @notice Set a new end time for the current stage
     * @param newEndTime New unix timestamp for stage end
     */
    function setStageEndTime(uint256 newEndTime) external onlyOwner {
        require(currentStage >= Stage.Stage1 && currentStage <= Stage.Stage3, "No active stage");

        StageConfig storage config = stageConfigs[currentStage];
        require(newEndTime > block.timestamp, "End time must be in future");
        require(newEndTime > config.startTime, "End must be after start");

        config.endTime = newEndTime;

        emit StageExtended(currentStage, newEndTime);
    }

    /**
     * @notice Enable token claiming (call after sale ends)
     */
    function enableClaiming() external onlyOwner {
        require(currentStage == Stage.Ended, "Sale not ended");
        claimEnabled = true;
        emit ClaimEnabled();
    }

    /**
     * @notice Update purchase limits
     */
    function setLimits(uint256 _minUsd, uint256 _maxUsd) external onlyOwner {
        require(_maxUsd >= _minUsd, "Max must be >= min");
        minPurchaseUsd = _minUsd;
        maxPurchaseUsd = _maxUsd;
        emit LimitsUpdated(_minUsd, _maxUsd);
    }

    /**
     * @notice Update ETH/USD price
     */
    function setEthPrice(uint256 _ethPriceUsd) external onlyOwner {
        require(_ethPriceUsd > 0, "Price must be > 0");
        ethPriceUsd = _ethPriceUsd;
        emit EthPriceUpdated(_ethPriceUsd);
    }

    /**
     * @notice Update USDC address
     */
    function setUsdc(address _usdc) external onlyOwner {
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Update USDT address
     */
    function setUsdt(address _usdt) external onlyOwner {
        usdt = IERC20(_usdt);
    }

    /**
     * @notice Update treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
    }

    /**
     * @notice Withdraw unsold tokens after sale ends
     */
    function withdrawUnsoldTokens() external onlyOwner {
        require(currentStage == Stage.Ended, "Sale not ended");

        uint256 balance = scoreToken.balanceOf(address(this));
        uint256 owed = totalTokensSold;

        // Only withdraw tokens not owed to buyers
        // After everyone claims, this will be just unsold tokens
        require(balance > owed, "No excess tokens");

        scoreToken.transfer(treasury, balance - owed);
    }

    /**
     * @notice Emergency withdraw any ERC20 token
     */
    function emergencyWithdraw(address token) external onlyOwner {
        require(token != address(scoreToken), "Use withdrawUnsoldTokens for SCORE");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No balance");
        IERC20(token).safeTransfer(treasury, balance);
    }

    // ============ View Functions ============

    function getSaleInfo() external view returns (
        Stage stage,
        uint256 raisedUsd,
        uint256 tokensSold,
        uint256 contributors,
        bool claiming
    ) {
        return (currentStage, totalRaisedUsd, totalTokensSold, totalContributors, claimEnabled);
    }

    function getStageInfo(Stage _stage) external view returns (
        uint256 priceUsd,
        uint256 allocation,
        uint256 sold,
        uint256 startTime,
        uint256 endTime,
        uint256 remaining
    ) {
        StageConfig memory config = stageConfigs[_stage];
        return (
            config.tokenPriceUsd,
            config.allocation,
            config.sold,
            config.startTime,
            config.endTime,
            config.allocation - config.sold
        );
    }

    function getCurrentStageInfo() external view returns (
        uint256 priceUsd,
        uint256 allocation,
        uint256 sold,
        uint256 startTime,
        uint256 endTime,
        uint256 remaining
    ) {
        if (currentStage == Stage.NotStarted || currentStage == Stage.Ended) {
            return (0, 0, 0, 0, 0, 0);
        }
        StageConfig memory config = stageConfigs[currentStage];
        return (
            config.tokenPriceUsd,
            config.allocation,
            config.sold,
            config.startTime,
            config.endTime,
            config.allocation - config.sold
        );
    }

    function getUserInfo(address user) external view returns (
        uint256 purchasedUsd,
        uint256 tokensOwed,
        uint256 remainingAllowance,
        bool claimed
    ) {
        uint256 remaining = maxPurchaseUsd > userPurchasedUsd[user]
            ? maxPurchaseUsd - userPurchasedUsd[user]
            : 0;
        return (
            userPurchasedUsd[user],
            userTokensOwed[user],
            remaining,
            hasClaimed[user]
        );
    }

    /**
     * @notice Calculate tokens for a given USD amount at current stage price
     */
    function calculateTokens(uint256 usdAmount) external view returns (uint256) {
        if (currentStage == Stage.NotStarted || currentStage == Stage.Ended) {
            return 0;
        }
        return _calculateTokens(usdAmount, stageConfigs[currentStage].tokenPriceUsd);
    }

    /**
     * @notice Calculate tokens for a given ETH amount at current stage price
     */
    function calculateTokensForEth(uint256 ethAmount) external view returns (uint256) {
        if (currentStage == Stage.NotStarted || currentStage == Stage.Ended) {
            return 0;
        }
        uint256 usdValue = (ethAmount * ethPriceUsd) / 1 ether;
        return _calculateTokens(usdValue, stageConfigs[currentStage].tokenPriceUsd);
    }

    /**
     * @notice Get all stage prices for display
     */
    function getAllStagePrices() external view returns (
        uint256 stage1Price,
        uint256 stage2Price,
        uint256 stage3Price
    ) {
        return (
            stageConfigs[Stage.Stage1].tokenPriceUsd,
            stageConfigs[Stage.Stage2].tokenPriceUsd,
            stageConfigs[Stage.Stage3].tokenPriceUsd
        );
    }

    // No direct ETH transfers - use buyWithEth()
    receive() external payable {
        revert("Use buyWithEth()");
    }
}
