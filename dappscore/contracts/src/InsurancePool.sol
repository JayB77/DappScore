// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ScoreToken.sol";

/**
 * @title InsurancePool
 * @notice Stake SCORE to insure community against scam losses
 * @dev UUPS upgradeable proxy pattern.
 *      Implements IScamListener — register with ProjectRegistry.addScamListener().
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE — upgrade authority, full admin
 *   OPERATOR_ROLE      — claim approval, config updates, scam signal sender
 *                        (grant to ProjectRegistry so it can call onProjectScamConfirmed)
 *
 * Reward accounting uses the SushiSwap/MasterChef accumulator pattern:
 *   rewardsPerShare grows as premiums arrive.
 *   rewardDebt[user] = staked * rewardsPerShare at last checkpoint.
 *   pending = staked * rewardsPerShare - rewardDebt  (delta only).
 */
contract InsurancePool is Initializable, UUPSUpgradeable, AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

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

    struct UnstakeRequest {
        uint256 amount;
        uint256 requestedAt;
    }

    // ============ State ============

    ScoreToken public scoreToken;

    uint256 public totalStaked;
    uint256 public totalCoverage;
    uint256 public totalPremiumsCollected;
    uint256 public totalClaimsPaid;

    /**
     * @dev Accumulated rewards per staked token, scaled by 1e18.
     *      Monotonically increases as premiums arrive.
     */
    uint256 public rewardsPerShare;

    mapping(address => Staker)          public stakers;
    mapping(address => uint256)          public rewardDebt;
    mapping(address => UnstakeRequest)   public unstakeRequests;
    mapping(uint256 => Coverage)         public coverages;
    mapping(uint256 => Claim)            public claims;

    address[] public stakerList;
    uint256 public coverageCount;
    uint256 public claimCount;

    // Configuration (set in initialize, adjustable by admin/operator)
    uint256 public minStake;
    uint256 public unstakeCooldown;
    uint256 public coverageDuration;
    uint256 public premiumRateBps;
    uint256 public maxCoverageRatio;
    uint256 public claimDeductibleBps;

    /// @dev projectId => coverageIds — enables efficient lookup in onProjectScamConfirmed.
    mapping(uint256 => uint256[]) public projectCoverageIds;

    /// @dev projectId => confirmed scam — set by onProjectScamConfirmed; unlocks instant claim approval.
    mapping(uint256 => bool) public projectConfirmedScam;

    // Storage gap for future upgrade variables
    uint256[40] private __gap;

    // ============ Events ============

    event Staked(address indexed staker, uint256 amount);
    event UnstakeRequested(address indexed staker, uint256 amount, uint256 availableAt);
    event Unstaked(address indexed staker, uint256 amount);
    event RewardsClaimed(address indexed staker, uint256 amount);
    event CoveragePurchased(uint256 indexed coverageId, uint256 projectId, address purchaser, uint256 amount);
    event ClaimSubmitted(uint256 indexed claimId, uint256 coverageId, address claimant, uint256 amount);
    event ClaimApproved(uint256 indexed claimId, uint256 approvedAmount);
    event ClaimRejected(uint256 indexed claimId);
    event ClaimPaid(uint256 indexed claimId, address claimant, uint256 amount);
    event ProjectScamConfirmed(uint256 indexed projectId);

    // ============ Constructor / Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _scoreToken
    ) external initializer {
        require(_admin      != address(0), "Zero admin");
        require(_scoreToken != address(0), "Zero token");

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE,      _admin);

        scoreToken = ScoreToken(_scoreToken);

        minStake           = 100 * 10 ** 18; // 100 SCORE
        unstakeCooldown    = 7 days;
        coverageDuration   = 30 days;
        premiumRateBps     = 500;             // 5%
        maxCoverageRatio   = 5000;            // 50%
        claimDeductibleBps = 1000;            // 10%
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ============ IScamListener ============

    /**
     * @notice Called by ProjectRegistry when a project reaches ProbableScam trust level.
     *         Marks the project so any subsequent claim submissions auto-approve.
     *         Caller must hold OPERATOR_ROLE (grant to ProjectRegistry address).
     */
    function onProjectScamConfirmed(uint256 projectId) external onlyRole(OPERATOR_ROLE) {
        if (projectConfirmedScam[projectId]) return; // idempotent
        projectConfirmedScam[projectId] = true;
        emit ProjectScamConfirmed(projectId);
    }

    // ============ Staking Functions ============

    function stake(uint256 _amount) external nonReentrant {
        require(_amount >= minStake, "Below minimum");

        _checkpoint(msg.sender);

        require(scoreToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        if (stakers[msg.sender].stakedAmount == 0) {
            stakerList.push(msg.sender);
            stakers[msg.sender].stakedAt = block.timestamp;
        }

        stakers[msg.sender].stakedAmount += _amount;
        totalStaked += _amount;

        rewardDebt[msg.sender] = (stakers[msg.sender].stakedAmount * rewardsPerShare) / 1e18;

        emit Staked(msg.sender, _amount);
    }

    function requestUnstake(uint256 _amount) external {
        require(_amount > 0, "Amount must be > 0");
        require(stakers[msg.sender].stakedAmount >= _amount, "Insufficient stake");
        require(unstakeRequests[msg.sender].amount == 0, "Pending request exists");

        uint256 remainingStake = totalStaked - _amount;
        uint256 requiredStake  = (totalCoverage * 10000) / maxCoverageRatio;
        require(remainingStake >= requiredStake, "Would breach coverage ratio");

        unstakeRequests[msg.sender] = UnstakeRequest({amount: _amount, requestedAt: block.timestamp});

        emit UnstakeRequested(msg.sender, _amount, block.timestamp + unstakeCooldown);
    }

    function unstake() external nonReentrant {
        UnstakeRequest storage req = unstakeRequests[msg.sender];
        require(req.amount > 0, "No pending request");
        require(block.timestamp >= req.requestedAt + unstakeCooldown, "Cooldown not elapsed");

        uint256 amount = req.amount;
        require(stakers[msg.sender].stakedAmount >= amount, "Insufficient stake");

        uint256 remainingStake = totalStaked - amount;
        uint256 requiredStake  = (totalCoverage * 10000) / maxCoverageRatio;
        require(remainingStake >= requiredStake, "Would breach coverage ratio");

        _checkpoint(msg.sender);

        delete unstakeRequests[msg.sender];

        stakers[msg.sender].stakedAmount -= amount;
        totalStaked -= amount;

        rewardDebt[msg.sender] = (stakers[msg.sender].stakedAmount * rewardsPerShare) / 1e18;

        require(scoreToken.transfer(msg.sender, amount), "Transfer failed");

        emit Unstaked(msg.sender, amount);
    }

    function claimRewards() external nonReentrant {
        _checkpoint(msg.sender);

        uint256 rewards = stakers[msg.sender].pendingRewards;
        require(rewards > 0, "No rewards");

        stakers[msg.sender].pendingRewards = 0;
        stakers[msg.sender].lastClaimTime = block.timestamp;

        require(scoreToken.transfer(msg.sender, rewards), "Transfer failed");

        emit RewardsClaimed(msg.sender, rewards);
    }

    // ============ Coverage Functions ============

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
            projectId:      _projectId,
            purchaser:      msg.sender,
            coverageAmount: _coverageAmount,
            premiumPaid:    premium,
            purchasedAt:    block.timestamp,
            expiresAt:      block.timestamp + coverageDuration,
            active:         true,
            claimed:        false
        });

        projectCoverageIds[_projectId].push(coverageId);

        totalCoverage             += _coverageAmount;
        totalPremiumsCollected    += premium;

        _distributePremium(premium);

        emit CoveragePurchased(coverageId, _projectId, msg.sender, _coverageAmount);

        return coverageId;
    }

    /**
     * @notice Submit a claim against coverage.
     *         If the project has been confirmed a scam, the claim is auto-approved and paid.
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

        uint256 requestedAmount  = _lossAmount > coverage.coverageAmount
            ? coverage.coverageAmount
            : _lossAmount;
        uint256 afterDeductible  = requestedAmount - (requestedAmount * claimDeductibleBps / 10000);

        claimCount++;
        uint256 claimId = claimCount;

        claims[claimId] = Claim({
            coverageId:      _coverageId,
            claimant:        msg.sender,
            lossAmount:      _lossAmount,
            requestedAmount: afterDeductible,
            approvedAmount:  0,
            evidenceIpfs:    _evidenceIpfs,
            approved:        false,
            rejected:        false,
            paid:            false
        });

        emit ClaimSubmitted(claimId, _coverageId, msg.sender, afterDeductible);

        // Auto-approve + auto-pay for confirmed scam projects
        if (projectConfirmedScam[coverage.projectId]) {
            _approveClaim(claimId, afterDeductible);
            _payClaim(claimId);
        }

        return claimId;
    }

    function approveClaim(uint256 _claimId, uint256 _approvedAmount)
        external
        onlyRole(OPERATOR_ROLE)
    {
        _approveClaim(_claimId, _approvedAmount);
    }

    function rejectClaim(uint256 _claimId) external onlyRole(OPERATOR_ROLE) {
        Claim storage claim = claims[_claimId];
        require(!claim.approved && !claim.rejected, "Already processed");

        claim.rejected = true;

        emit ClaimRejected(_claimId);
    }

    function payClaim(uint256 _claimId) external nonReentrant {
        _payClaim(_claimId);
    }

    function expireCoverage(uint256 _coverageId) external {
        Coverage storage coverage = coverages[_coverageId];

        require(coverage.active, "Not active");
        require(block.timestamp > coverage.expiresAt, "Not expired");

        coverage.active = false;
        totalCoverage -= coverage.coverageAmount;
    }

    // ============ Internal ============

    function _checkpoint(address _staker) internal {
        Staker storage staker = stakers[_staker];
        if (staker.stakedAmount > 0) {
            uint256 totalAccrued = (staker.stakedAmount * rewardsPerShare) / 1e18;
            uint256 newReward    = totalAccrued - rewardDebt[_staker];
            if (newReward > 0) {
                staker.pendingRewards += newReward;
            }
        }
        rewardDebt[_staker] = (stakers[_staker].stakedAmount * rewardsPerShare) / 1e18;
    }

    function _distributePremium(uint256 _premium) internal {
        if (totalStaked > 0) {
            rewardsPerShare += (_premium * 1e18) / totalStaked;
        }
    }

    function _approveClaim(uint256 _claimId, uint256 _approvedAmount) internal {
        Claim storage claim = claims[_claimId];
        require(!claim.approved && !claim.rejected, "Already processed");
        require(_approvedAmount <= claim.requestedAmount, "Exceeds requested");

        claim.approved       = true;
        claim.approvedAmount = _approvedAmount;

        Coverage storage coverage = coverages[claim.coverageId];
        coverage.claimed = true;
        coverage.active  = false;
        totalCoverage   -= coverage.coverageAmount;

        emit ClaimApproved(_claimId, _approvedAmount);
    }

    function _payClaim(uint256 _claimId) internal {
        Claim storage claim = claims[_claimId];

        require(claim.approved, "Not approved");
        require(!claim.paid,    "Already paid");
        require(claim.approvedAmount <= scoreToken.balanceOf(address(this)), "Insufficient pool");

        claim.paid       = true;
        totalClaimsPaid += claim.approvedAmount;

        require(scoreToken.transfer(claim.claimant, claim.approvedAmount), "Transfer failed");

        emit ClaimPaid(_claimId, claim.claimant, claim.approvedAmount);
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

    function getProjectCoverageIds(uint256 _projectId) external view returns (uint256[] memory) {
        return projectCoverageIds[_projectId];
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
        uint256 available   = maxCoverage > totalCoverage ? maxCoverage - totalCoverage : 0;

        return (totalStaked, totalCoverage, totalPremiumsCollected, totalClaimsPaid, available, stakerList.length);
    }

    function getPendingRewards(address _staker) external view returns (uint256) {
        Staker memory staker = stakers[_staker];
        if (staker.stakedAmount == 0) return staker.pendingRewards;

        uint256 totalAccrued = (staker.stakedAmount * rewardsPerShare) / 1e18;
        uint256 delta        = totalAccrued - rewardDebt[_staker];
        return staker.pendingRewards + delta;
    }

    function calculatePremium(uint256 _coverageAmount) external view returns (uint256) {
        return (_coverageAmount * premiumRateBps) / 10000;
    }

    function getUnstakeRequest(address _staker) external view returns (UnstakeRequest memory) {
        return unstakeRequests[_staker];
    }

    // ============ Admin Functions ============

    function setConfig(
        uint256 _minStake,
        uint256 _premiumRateBps,
        uint256 _maxCoverageRatio,
        uint256 _deductibleBps,
        uint256 _duration
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_premiumRateBps  <= 2000, "Max 20% premium");
        require(_maxCoverageRatio <= 8000, "Max 80% coverage ratio");
        require(_deductibleBps   <= 3000, "Max 30% deductible");

        minStake           = _minStake;
        premiumRateBps     = _premiumRateBps;
        maxCoverageRatio   = _maxCoverageRatio;
        claimDeductibleBps = _deductibleBps;
        coverageDuration   = _duration;
    }

    function setUnstakeCooldown(uint256 _cooldown) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_cooldown <= 30 days, "Max 30 day cooldown");
        unstakeCooldown = _cooldown;
    }
}
