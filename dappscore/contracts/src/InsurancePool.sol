// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ScoreToken.sol";

/**
 * @title InsurancePool
 * @notice Stake SCORE to insure community against scam losses
 * @dev Stakers earn yield from premiums, but cover claims when scams occur
 *
 * Features:
 * - Users stake SCORE to provide insurance coverage
 * - Projects can purchase coverage (premium paid in SCORE)
 * - If project is marked as scam, affected users can claim
 * - Stakers share losses proportionally, but earn premium yield
 * - Tiered coverage levels with different premiums
 *
 * Reward accounting uses the SushiSwap/MasterChef accumulator pattern:
 *   rewardsPerShare grows as premiums arrive.
 *   rewardDebt[user] = staked * rewardsPerShare at last checkpoint.
 *   pending = staked * rewardsPerShare - rewardDebt  (delta only).
 */
contract InsurancePool is Ownable2Step, ReentrancyGuard {
    struct Staker {
        uint256 stakedAmount;
        uint256 stakedAt;
        uint256 lastClaimTime;
        uint256 pendingRewards;
    }

    struct Coverage {
        uint256 projectId;
        address purchaser;
        uint256 coverageAmount; // Max payout
        uint256 premiumPaid;
        uint256 purchasedAt;
        uint256 expiresAt;
        bool active;
        bool claimed;
    }

    struct Claim {
        uint256 coverageId;
        address claimant;
        uint256 lossAmount;
        uint256 requestedAmount;
        uint256 approvedAmount;
        string evidenceIpfs;
        bool approved;
        bool rejected;
        bool paid;
    }

    // ============ Unstake cooldown request ============

    struct UnstakeRequest {
        uint256 amount;
        uint256 requestedAt;
    }

    // Contracts
    ScoreToken public scoreToken;

    // Pool State
    uint256 public totalStaked;
    uint256 public totalCoverage; // Total active coverage amount
    uint256 public totalPremiumsCollected;
    uint256 public totalClaimsPaid;

    /**
     * @dev Accumulated rewards per staked token, scaled by 1e18.
     *      Monotonically increases as premiums arrive.
     */
    uint256 public rewardsPerShare;

    // Staker accounting
    mapping(address => Staker) public stakers;
    /**
     * @dev rewardDebt[user] = staked * rewardsPerShare at last checkpoint.
     *      Tracks how much of rewardsPerShare has already been accounted for.
     */
    mapping(address => uint256) public rewardDebt;

    mapping(address => UnstakeRequest) public unstakeRequests;

    mapping(uint256 => Coverage) public coverages;
    mapping(uint256 => Claim) public claims;
    address[] public stakerList;
    uint256 public coverageCount;
    uint256 public claimCount;

    // Configuration
    uint256 public minStake = 100 * 10 ** 18; // 100 SCORE min stake
    uint256 public unstakeCooldown = 7 days; // Cooldown between request and execution
    uint256 public coverageDuration = 30 days; // Coverage period
    uint256 public premiumRateBps = 500; // 5% premium for coverage
    uint256 public maxCoverageRatio = 5000; // Max 50% of pool can be covered
    uint256 public claimDeductibleBps = 1000; // 10% deductible on claims

    // Authorized claim approvers
    mapping(address => bool) public claimApprovers;

    // Events
    event Staked(address indexed staker, uint256 amount);
    event UnstakeRequested(address indexed staker, uint256 amount, uint256 availableAt);
    event Unstaked(address indexed staker, uint256 amount);
    event RewardsClaimed(address indexed staker, uint256 amount);
    event CoveragePurchased(uint256 indexed coverageId, uint256 projectId, address purchaser, uint256 amount);
    event ClaimSubmitted(uint256 indexed claimId, uint256 coverageId, address claimant, uint256 amount);
    event ClaimApproved(uint256 indexed claimId, uint256 approvedAmount);
    event ClaimRejected(uint256 indexed claimId);
    event ClaimPaid(uint256 indexed claimId, address claimant, uint256 amount);

    constructor(address _initialOwner, address _scoreToken) Ownable(_initialOwner) {
        scoreToken = ScoreToken(_scoreToken);
    }

    // ============ Staking Functions ============

    /**
     * @notice Stake SCORE to provide insurance coverage and earn premium yield
     */
    function stake(uint256 _amount) external nonReentrant {
        require(_amount >= minStake, "Below minimum");

        // Checkpoint rewards with OLD amount before changing stake
        _checkpoint(msg.sender);

        require(scoreToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        if (stakers[msg.sender].stakedAmount == 0) {
            stakerList.push(msg.sender);
            stakers[msg.sender].stakedAt = block.timestamp;
        }

        stakers[msg.sender].stakedAmount += _amount;
        totalStaked += _amount;

        // Reset debt to new balance so future rewards start from here
        rewardDebt[msg.sender] = (stakers[msg.sender].stakedAmount * rewardsPerShare) / 1e18;

        emit Staked(msg.sender, _amount);
    }

    /**
     * @notice Request an unstake (begins cooldown period)
     * @param _amount Amount to unstake
     */
    function requestUnstake(uint256 _amount) external {
        require(_amount > 0, "Amount must be > 0");
        require(stakers[msg.sender].stakedAmount >= _amount, "Insufficient stake");
        require(unstakeRequests[msg.sender].amount == 0, "Pending request exists");

        // Ensure pool remains solvent for active coverage
        uint256 remainingStake = totalStaked - _amount;
        uint256 requiredStake = (totalCoverage * 10000) / maxCoverageRatio;
        require(remainingStake >= requiredStake, "Would breach coverage ratio");

        unstakeRequests[msg.sender] = UnstakeRequest({amount: _amount, requestedAt: block.timestamp});

        emit UnstakeRequested(msg.sender, _amount, block.timestamp + unstakeCooldown);
    }

    /**
     * @notice Execute an unstake after the cooldown period has elapsed
     */
    function unstake() external nonReentrant {
        UnstakeRequest storage req = unstakeRequests[msg.sender];
        require(req.amount > 0, "No pending request");
        require(block.timestamp >= req.requestedAt + unstakeCooldown, "Cooldown not elapsed");

        uint256 amount = req.amount;
        require(stakers[msg.sender].stakedAmount >= amount, "Insufficient stake");

        // Re-check solvency at execution time (coverage may have grown)
        uint256 remainingStake = totalStaked - amount;
        uint256 requiredStake = (totalCoverage * 10000) / maxCoverageRatio;
        require(remainingStake >= requiredStake, "Would breach coverage ratio");

        // Checkpoint rewards before amount changes
        _checkpoint(msg.sender);

        delete unstakeRequests[msg.sender];

        stakers[msg.sender].stakedAmount -= amount;
        totalStaked -= amount;

        // Update debt for new (lower) balance
        rewardDebt[msg.sender] = (stakers[msg.sender].stakedAmount * rewardsPerShare) / 1e18;

        require(scoreToken.transfer(msg.sender, amount), "Transfer failed");

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Claim accumulated staking rewards
     */
    function claimRewards() external nonReentrant {
        _checkpoint(msg.sender);

        uint256 rewards = stakers[msg.sender].pendingRewards;
        require(rewards > 0, "No rewards");

        stakers[msg.sender].pendingRewards = 0;
        stakers[msg.sender].lastClaimTime = block.timestamp;

        require(scoreToken.transfer(msg.sender, rewards), "Transfer failed");

        emit RewardsClaimed(msg.sender, rewards);
    }

    /**
     * @dev Checkpoint: move new rewards (delta) from rewardsPerShare into pendingRewards.
     *      Must be called BEFORE any change to stakedAmount.
     *
     *      Standard MasterChef pattern:
     *        newPending = stakedAmount * rewardsPerShare / 1e18 - rewardDebt
     */
    function _checkpoint(address _staker) internal {
        Staker storage staker = stakers[_staker];
        if (staker.stakedAmount > 0) {
            uint256 totalAccrued = (staker.stakedAmount * rewardsPerShare) / 1e18;
            uint256 newReward = totalAccrued - rewardDebt[_staker];
            if (newReward > 0) {
                staker.pendingRewards += newReward;
            }
        }
        // Debt is updated AFTER the pending calculation, but BEFORE any amount change
        // (caller must update debt again if amount changes)
        rewardDebt[_staker] = (stakers[_staker].stakedAmount * rewardsPerShare) / 1e18;
    }

    /**
     * @dev Distribute a premium payment across all stakers by incrementing rewardsPerShare.
     */
    function _distributePremium(uint256 _premium) internal {
        if (totalStaked > 0) {
            rewardsPerShare += (_premium * 1e18) / totalStaked;
        }
    }

    // ============ Coverage Functions ============

    /**
     * @notice Purchase insurance coverage for a project
     */
    function purchaseCoverage(uint256 _projectId, uint256 _coverageAmount)
        external
        nonReentrant
        returns (uint256)
    {
        uint256 maxNewCoverage = (totalStaked * maxCoverageRatio / 10000) - totalCoverage;
        require(_coverageAmount <= maxNewCoverage, "Exceeds available coverage");

        uint256 premium = (_coverageAmount * premiumRateBps) / 10000;
        require(premium > 0, "Coverage too small");

        require(scoreToken.transferFrom(msg.sender, address(this), premium), "Premium transfer failed");

        coverageCount++;
        uint256 coverageId = coverageCount;

        coverages[coverageId] = Coverage({
            projectId: _projectId,
            purchaser: msg.sender,
            coverageAmount: _coverageAmount,
            premiumPaid: premium,
            purchasedAt: block.timestamp,
            expiresAt: block.timestamp + coverageDuration,
            active: true,
            claimed: false
        });

        totalCoverage += _coverageAmount;
        totalPremiumsCollected += premium;

        _distributePremium(premium);

        emit CoveragePurchased(coverageId, _projectId, msg.sender, _coverageAmount);

        return coverageId;
    }

    /**
     * @notice Submit a claim against coverage
     */
    function submitClaim(uint256 _coverageId, uint256 _lossAmount, string calldata _evidenceIpfs)
        external
        nonReentrant
        returns (uint256)
    {
        Coverage storage coverage = coverages[_coverageId];

        require(coverage.purchaser == msg.sender, "Not coverage owner");
        require(coverage.active, "Coverage not active");
        require(!coverage.claimed, "Already claimed");
        require(block.timestamp <= coverage.expiresAt, "Coverage expired");

        uint256 requestedAmount = _lossAmount > coverage.coverageAmount ? coverage.coverageAmount : _lossAmount;

        // Apply deductible
        uint256 afterDeductible = requestedAmount - (requestedAmount * claimDeductibleBps / 10000);

        claimCount++;
        uint256 claimId = claimCount;

        claims[claimId] = Claim({
            coverageId: _coverageId,
            claimant: msg.sender,
            lossAmount: _lossAmount,
            requestedAmount: afterDeductible,
            approvedAmount: 0,
            evidenceIpfs: _evidenceIpfs,
            approved: false,
            rejected: false,
            paid: false
        });

        emit ClaimSubmitted(claimId, _coverageId, msg.sender, afterDeductible);

        return claimId;
    }

    /**
     * @notice Approve a claim (authorized approvers only)
     */
    function approveClaim(uint256 _claimId, uint256 _approvedAmount) external {
        require(claimApprovers[msg.sender] || msg.sender == owner(), "Not authorized");

        Claim storage claim = claims[_claimId];
        require(!claim.approved && !claim.rejected, "Already processed");
        require(_approvedAmount <= claim.requestedAmount, "Exceeds requested");

        claim.approved = true;
        claim.approvedAmount = _approvedAmount;

        Coverage storage coverage = coverages[claim.coverageId];
        coverage.claimed = true;
        coverage.active = false;
        totalCoverage -= coverage.coverageAmount;

        emit ClaimApproved(_claimId, _approvedAmount);
    }

    /**
     * @notice Reject a claim
     */
    function rejectClaim(uint256 _claimId) external {
        require(claimApprovers[msg.sender] || msg.sender == owner(), "Not authorized");

        Claim storage claim = claims[_claimId];
        require(!claim.approved && !claim.rejected, "Already processed");

        claim.rejected = true;

        emit ClaimRejected(_claimId);
    }

    /**
     * @notice Pay out an approved claim
     */
    function payClaim(uint256 _claimId) external nonReentrant {
        Claim storage claim = claims[_claimId];

        require(claim.approved, "Not approved");
        require(!claim.paid, "Already paid");
        require(claim.approvedAmount <= scoreToken.balanceOf(address(this)), "Insufficient pool");

        claim.paid = true;
        totalClaimsPaid += claim.approvedAmount;

        require(scoreToken.transfer(claim.claimant, claim.approvedAmount), "Transfer failed");

        emit ClaimPaid(_claimId, claim.claimant, claim.approvedAmount);
    }

    /**
     * @notice Expire an inactive coverage (anyone can call)
     */
    function expireCoverage(uint256 _coverageId) external {
        Coverage storage coverage = coverages[_coverageId];

        require(coverage.active, "Not active");
        require(block.timestamp > coverage.expiresAt, "Not expired");

        coverage.active = false;
        totalCoverage -= coverage.coverageAmount;
    }

    // ============ View Functions ============

    function getStaker(address _staker) external view returns (Staker memory) {
        return stakers[_staker];
    }

    function getCoverage(uint256 _coverageId) external view returns (Coverage memory) {
        return coverages[_coverageId];
    }

    function getClaim(uint256 _claimId) external view returns (Claim memory) {
        return claims[_claimId];
    }

    function getPoolStats()
        external
        view
        returns (
            uint256 staked,
            uint256 coverage,
            uint256 premiums,
            uint256 claimsPaid,
            uint256 availableCoverage,
            uint256 stakerCount
        )
    {
        uint256 maxCoverage = (totalStaked * maxCoverageRatio) / 10000;
        uint256 available = maxCoverage > totalCoverage ? maxCoverage - totalCoverage : 0;

        return (totalStaked, totalCoverage, totalPremiumsCollected, totalClaimsPaid, available, stakerList.length);
    }

    /**
     * @notice Preview pending rewards without modifying state
     */
    function getPendingRewards(address _staker) external view returns (uint256) {
        Staker memory staker = stakers[_staker];
        if (staker.stakedAmount == 0) return staker.pendingRewards;

        uint256 totalAccrued = (staker.stakedAmount * rewardsPerShare) / 1e18;
        uint256 delta = totalAccrued - rewardDebt[_staker];
        return staker.pendingRewards + delta;
    }

    function calculatePremium(uint256 _coverageAmount) external view returns (uint256) {
        return (_coverageAmount * premiumRateBps) / 10000;
    }

    function getUnstakeRequest(address _staker) external view returns (UnstakeRequest memory) {
        return unstakeRequests[_staker];
    }

    // ============ Admin Functions ============

    function setClaimApprover(address _approver, bool _authorized) external onlyOwner {
        claimApprovers[_approver] = _authorized;
    }

    function setConfig(
        uint256 _minStake,
        uint256 _premiumRateBps,
        uint256 _maxCoverageRatio,
        uint256 _deductibleBps,
        uint256 _duration
    ) external onlyOwner {
        require(_premiumRateBps <= 2000, "Max 20% premium");
        require(_maxCoverageRatio <= 8000, "Max 80% coverage ratio");
        require(_deductibleBps <= 3000, "Max 30% deductible");

        minStake = _minStake;
        premiumRateBps = _premiumRateBps;
        maxCoverageRatio = _maxCoverageRatio;
        claimDeductibleBps = _deductibleBps;
        coverageDuration = _duration;
    }

    function setUnstakeCooldown(uint256 _cooldown) external onlyOwner {
        require(_cooldown <= 30 days, "Max 30 day cooldown");
        unstakeCooldown = _cooldown;
    }
}
