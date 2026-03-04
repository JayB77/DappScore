// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ScoreToken.sol";

/**
 * @title TokenSale
 * @notice DappScore's fair launch token sale with 3 stages
 * @dev Features:
 *      - 3 stages with increasing prices (incentivises early participation)
 *      - Fair launch: no private rounds, no whitelist
 *      - Multi-currency: ETH, USDC, USDT
 *      - Per-user investment cap (prevents whales from buying all)
 *      - Claim-based: tokens are held until sale ends, then users claim
 *      - All parameters owner-adjustable via contract
 *
 * NOTE: Deployed on BASE SEPOLIA (testnet) only. Do not deploy on mainnet.
 *
 * Typical Stage Pricing:
 *   Stage 1: $0.008 (20% discount - early supporters)
 *   Stage 2: $0.009 (10% discount - growth phase)
 *   Stage 3: $0.010 (full price - final sale)
 */
contract TokenSale is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum Stage {
        NotStarted,
        Stage1,
        Stage2,
        Stage3,
        Ended
    }

    // ============ Structs ============

    struct StageConfig {
        uint256 tokenPriceUsd; // Price in USD with 6 decimals (e.g., 8000 = $0.008)
        uint256 allocation; // Tokens available in this stage
        uint256 sold; // Tokens sold in this stage
        uint256 startTime; // Unix timestamp
        uint256 endTime; // Unix timestamp
    }

    // ============ State Variables ============

    ScoreToken public scoreToken;

    IERC20 public usdc;
    IERC20 public usdt;

    Stage public currentStage;

    mapping(Stage => StageConfig) public stageConfigs;

    uint256 public ethPriceUsd; // 6 decimals (e.g., 3000_000000 = $3000)

    uint256 public minPurchaseUsd; // Minimum per transaction
    uint256 public maxPurchaseUsd; // Maximum per wallet

    mapping(address => uint256) public userPurchasedUsd;
    mapping(address => uint256) public userTokensOwed;
    mapping(address => bool) public hasClaimed;

    uint256 public totalRaisedUsd;
    uint256 public totalTokensSold;
    uint256 public totalTokensClaimed; // FIX: track claimed separately for withdrawUnsoldTokens
    uint256 public totalContributors;

    address public treasury;

    bool public claimEnabled;

    // ============ Events ============

    event StageStarted(Stage stage, uint256 startTime, uint256 endTime);
    event StageEnded(Stage stage);
    event TokensPurchasedWithEth(
        address indexed buyer, Stage stage, uint256 ethAmount, uint256 usdValue, uint256 tokenAmount
    );
    event TokensPurchasedWithToken(
        address indexed buyer, Stage stage, address token, uint256 amount, uint256 tokenAmount
    );
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

        ethPriceUsd = 3000_000000; // $3000 per ETH (update before sale)
        minPurchaseUsd = 20_000000; // $20 minimum
        maxPurchaseUsd = 5000_000000; // $5,000 max per wallet

        stageConfigs[Stage.Stage1] = StageConfig({
            tokenPriceUsd: 8000, // $0.008
            allocation: 166_666 * 10 ** 18,
            sold: 0,
            startTime: 0,
            endTime: 0
        });

        stageConfigs[Stage.Stage2] = StageConfig({
            tokenPriceUsd: 9000, // $0.009
            allocation: 166_667 * 10 ** 18,
            sold: 0,
            startTime: 0,
            endTime: 0
        });

        stageConfigs[Stage.Stage3] = StageConfig({
            tokenPriceUsd: 10000, // $0.010
            allocation: 166_667 * 10 ** 18,
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

        uint256 usdValue = (msg.value * ethPriceUsd) / 1 ether;
        uint256 tokenAmount = _processPurchase(usdValue, config);

        (bool sent,) = treasury.call{value: msg.value}("");
        require(sent, "ETH transfer failed");

        emit TokensPurchasedWithEth(msg.sender, currentStage, msg.value, usdValue, tokenAmount);
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

        uint256 usdValue = amount; // stablecoins have 6 decimals = USD value
        uint256 tokenAmount = _processPurchase(usdValue, config);

        IERC20(token).safeTransferFrom(msg.sender, treasury, amount);

        emit TokensPurchasedWithToken(msg.sender, currentStage, token, amount, tokenAmount);
    }

    function _processPurchase(uint256 usdValue, StageConfig storage config) internal returns (uint256) {
        require(usdValue >= minPurchaseUsd, "Below minimum purchase");
        require(userPurchasedUsd[msg.sender] + usdValue <= maxPurchaseUsd, "Exceeds maximum per wallet");

        uint256 tokenAmount = _calculateTokens(usdValue, config.tokenPriceUsd);
        require(config.sold + tokenAmount <= config.allocation, "Exceeds stage allocation");

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
        return (usdValue * 10 ** 18) / priceUsd;
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
        totalTokensClaimed += amount; // Track for withdrawUnsoldTokens

        scoreToken.transfer(msg.sender, amount);

        emit TokensClaimed(msg.sender, amount);
    }

    // ============ Owner Functions ============

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

    function startStage(Stage _stage) external onlyOwner {
        require(_stage >= Stage.Stage1 && _stage <= Stage.Stage3, "Invalid stage");
        require(
            currentStage == Stage.NotStarted || uint8(_stage) == uint8(currentStage) + 1, "Invalid stage order"
        );

        StageConfig storage config = stageConfigs[_stage];
        require(config.startTime > 0 && config.endTime > 0, "Stage not configured");

        uint256 totalNeeded = stageConfigs[Stage.Stage1].allocation + stageConfigs[Stage.Stage2].allocation
            + stageConfigs[Stage.Stage3].allocation;
        require(scoreToken.balanceOf(address(this)) >= totalNeeded, "Insufficient token balance");

        currentStage = _stage;
        emit StageStarted(_stage, config.startTime, config.endTime);
    }

    function endCurrentStage() external onlyOwner {
        require(currentStage >= Stage.Stage1 && currentStage <= Stage.Stage3, "No active stage");

        emit StageEnded(currentStage);

        if (currentStage == Stage.Stage3) {
            currentStage = Stage.Ended;
        } else {
            currentStage = Stage(uint8(currentStage) + 1);
        }
    }

    function extendCurrentStage(uint256 additionalTime) external onlyOwner {
        require(currentStage >= Stage.Stage1 && currentStage <= Stage.Stage3, "No active stage");
        require(additionalTime > 0, "Must extend by > 0");

        StageConfig storage config = stageConfigs[currentStage];
        config.endTime += additionalTime;

        emit StageExtended(currentStage, config.endTime);
    }

    function setStageEndTime(uint256 newEndTime) external onlyOwner {
        require(currentStage >= Stage.Stage1 && currentStage <= Stage.Stage3, "No active stage");

        StageConfig storage config = stageConfigs[currentStage];
        require(newEndTime > block.timestamp, "End time must be in future");
        require(newEndTime > config.startTime, "End must be after start");

        config.endTime = newEndTime;

        emit StageExtended(currentStage, newEndTime);
    }

    function enableClaiming() external onlyOwner {
        require(currentStage == Stage.Ended, "Sale not ended");
        claimEnabled = true;
        emit ClaimEnabled();
    }

    function setLimits(uint256 _minUsd, uint256 _maxUsd) external onlyOwner {
        require(_maxUsd >= _minUsd, "Max must be >= min");
        minPurchaseUsd = _minUsd;
        maxPurchaseUsd = _maxUsd;
        emit LimitsUpdated(_minUsd, _maxUsd);
    }

    function setEthPrice(uint256 _ethPriceUsd) external onlyOwner {
        require(_ethPriceUsd > 0, "Price must be > 0");
        ethPriceUsd = _ethPriceUsd;
        emit EthPriceUpdated(_ethPriceUsd);
    }

    function setUsdc(address _usdc) external onlyOwner {
        usdc = IERC20(_usdc);
    }

    function setUsdt(address _usdt) external onlyOwner {
        usdt = IERC20(_usdt);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
    }

    /**
     * @notice Withdraw unsold tokens after sale ends
     * @dev Uses `totalTokensSold - totalTokensClaimed` to correctly calculate
     *      tokens still owed to buyers who haven't claimed yet, so we never
     *      withdraw tokens that belong to claimants.
     */
    function withdrawUnsoldTokens() external onlyOwner {
        require(currentStage == Stage.Ended, "Sale not ended");

        uint256 balance = scoreToken.balanceOf(address(this));
        uint256 stillOwed = totalTokensSold - totalTokensClaimed; // tokens not yet claimed

        require(balance > stillOwed, "No excess tokens");

        scoreToken.transfer(treasury, balance - stillOwed);
    }

    /**
     * @notice Emergency withdraw any ERC20 token (not SCORE)
     */
    function emergencyWithdraw(address token) external onlyOwner {
        require(token != address(scoreToken), "Use withdrawUnsoldTokens for SCORE");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No balance");
        IERC20(token).safeTransfer(treasury, balance);
    }

    // ============ View Functions ============

    function getSaleInfo()
        external
        view
        returns (Stage stage, uint256 raisedUsd, uint256 tokensSold, uint256 contributors, bool claiming)
    {
        return (currentStage, totalRaisedUsd, totalTokensSold, totalContributors, claimEnabled);
    }

    function getStageInfo(Stage _stage)
        external
        view
        returns (
            uint256 priceUsd,
            uint256 allocation,
            uint256 sold,
            uint256 startTime,
            uint256 endTime,
            uint256 remaining
        )
    {
        StageConfig memory config = stageConfigs[_stage];
        return (config.tokenPriceUsd, config.allocation, config.sold, config.startTime, config.endTime,
            config.allocation - config.sold);
    }

    function getCurrentStageInfo()
        external
        view
        returns (
            uint256 priceUsd,
            uint256 allocation,
            uint256 sold,
            uint256 startTime,
            uint256 endTime,
            uint256 remaining
        )
    {
        if (currentStage == Stage.NotStarted || currentStage == Stage.Ended) {
            return (0, 0, 0, 0, 0, 0);
        }
        StageConfig memory config = stageConfigs[currentStage];
        return (config.tokenPriceUsd, config.allocation, config.sold, config.startTime, config.endTime,
            config.allocation - config.sold);
    }

    function getUserInfo(address user)
        external
        view
        returns (uint256 purchasedUsd, uint256 tokensOwed, uint256 remainingAllowance, bool claimed)
    {
        uint256 remaining =
            maxPurchaseUsd > userPurchasedUsd[user] ? maxPurchaseUsd - userPurchasedUsd[user] : 0;
        return (userPurchasedUsd[user], userTokensOwed[user], remaining, hasClaimed[user]);
    }

    function calculateTokens(uint256 usdAmount) external view returns (uint256) {
        if (currentStage == Stage.NotStarted || currentStage == Stage.Ended) return 0;
        return _calculateTokens(usdAmount, stageConfigs[currentStage].tokenPriceUsd);
    }

    function calculateTokensForEth(uint256 ethAmount) external view returns (uint256) {
        if (currentStage == Stage.NotStarted || currentStage == Stage.Ended) return 0;
        uint256 usdValue = (ethAmount * ethPriceUsd) / 1 ether;
        return _calculateTokens(usdValue, stageConfigs[currentStage].tokenPriceUsd);
    }

    function getAllStagePrices()
        external
        view
        returns (uint256 stage1Price, uint256 stage2Price, uint256 stage3Price)
    {
        return (
            stageConfigs[Stage.Stage1].tokenPriceUsd,
            stageConfigs[Stage.Stage2].tokenPriceUsd,
            stageConfigs[Stage.Stage3].tokenPriceUsd
        );
    }

    receive() external payable {
        revert("Use buyWithEth()");
    }
}
