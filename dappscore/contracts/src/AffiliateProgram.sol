// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ScoreToken.sol";

/**
 * @title AffiliateProgram
 * @notice Referral tracking and rewards for DappScore
 * @dev Earn SCORE for referring projects and users
 *
 * Features:
 * - Generate unique referral codes
 * - Track project submissions via referral
 * - Track new user signups via referral
 * - Tiered commission rates based on performance
 * - Lifetime referral tracking
 */
contract AffiliateProgram is Ownable2Step, ReentrancyGuard {
    enum AffiliateLevel {
        Bronze, // 0-10 referrals: 5%
        Silver, // 11-50 referrals: 7.5%
        Gold, // 51-100 referrals: 10%
        Platinum, // 101-500 referrals: 12.5%
        Diamond // 500+ referrals: 15%
    }

    struct Affiliate {
        bytes32 referralCode;
        uint256 totalReferrals;
        uint256 projectReferrals;
        uint256 userReferrals;
        uint256 totalEarnings;
        uint256 pendingEarnings;
        uint256 joinedAt;
        AffiliateLevel level;
        bool active;
    }

    struct ReferralEvent {
        address referrer;
        address referred;
        uint256 timestamp;
        uint256 rewardAmount;
        bool isProject; // true = project submission, false = user signup
        uint256 projectId; // if project referral
    }

    // Contracts
    ScoreToken public scoreToken;

    // State
    mapping(address => Affiliate) public affiliates;
    mapping(bytes32 => address) public codeToAffiliate;
    mapping(address => address) public referredBy; // user => referrer
    mapping(uint256 => address) public projectReferrer; // projectId => referrer

    // Per-affiliate referral index for O(1) pagination (avoids unbounded scan)
    mapping(address => uint256[]) private affiliateReferralIndices;
    ReferralEvent[] public referralHistory;
    address[] public affiliateList;

    // Commission rates in BASIS POINTS (divide by 10000).
    // e.g. 500 = 5%, 750 = 7.5%, 1000 = 10%, 1250 = 12.5%, 1500 = 15%
    uint256[5] public commissionRates = [500, 750, 1000, 1250, 1500];

    // Thresholds for levels
    uint256[5] public levelThresholds = [0, 11, 51, 101, 501];

    // Configuration
    uint256 public projectReferralReward = 50 * 10 ** 18; // 50 SCORE per project
    uint256 public userReferralReward = 10 * 10 ** 18; // 10 SCORE per user
    uint256 public minWithdraw = 10 * 10 ** 18; // 10 SCORE minimum

    // Authorized recorders (ProjectRegistry, etc.)
    mapping(address => bool) public authorizedRecorders;

    // Events
    event AffiliateRegistered(address indexed affiliate, bytes32 referralCode);
    event ReferralRecorded(address indexed referrer, address indexed referred, bool isProject, uint256 reward);
    event EarningsWithdrawn(address indexed affiliate, uint256 amount);
    event LevelUpgraded(address indexed affiliate, AffiliateLevel newLevel);
    event CommissionRateUpdated(AffiliateLevel level, uint256 rateBps);

    constructor(address _initialOwner, address _scoreToken) Ownable(_initialOwner) {
        scoreToken = ScoreToken(_scoreToken);
    }

    // ============ Registration ============

    /**
     * @notice Register as an affiliate (auto-generated code)
     */
    function registerAffiliate() external returns (bytes32) {
        require(!affiliates[msg.sender].active, "Already registered");

        bytes32 code = keccak256(abi.encodePacked(msg.sender, block.timestamp, block.prevrandao));

        _createAffiliate(msg.sender, code);
        return code;
    }

    /**
     * @notice Register with a custom human-readable code
     */
    function registerWithCode(string calldata _customCode) external returns (bytes32) {
        require(!affiliates[msg.sender].active, "Already registered");
        require(bytes(_customCode).length >= 4 && bytes(_customCode).length <= 20, "Invalid code length");

        bytes32 code = keccak256(abi.encodePacked(_customCode));
        require(codeToAffiliate[code] == address(0), "Code taken");

        _createAffiliate(msg.sender, code);
        return code;
    }

    function _createAffiliate(address _user, bytes32 _code) internal {
        affiliates[_user] = Affiliate({
            referralCode: _code,
            totalReferrals: 0,
            projectReferrals: 0,
            userReferrals: 0,
            totalEarnings: 0,
            pendingEarnings: 0,
            joinedAt: block.timestamp,
            level: AffiliateLevel.Bronze,
            active: true
        });

        codeToAffiliate[_code] = _user;
        affiliateList.push(_user);

        emit AffiliateRegistered(_user, _code);
    }

    // ============ Referral Recording ============

    /**
     * @notice Record a user referral (called when new user signs up with code)
     */
    function recordUserReferral(address _newUser, bytes32 _referralCode) external onlyAuthorized {
        require(referredBy[_newUser] == address(0), "Already referred");

        address referrer = codeToAffiliate[_referralCode];
        require(referrer != address(0), "Invalid code");
        require(referrer != _newUser, "Cannot self-refer");

        Affiliate storage aff = affiliates[referrer];
        require(aff.active, "Affiliate not active");

        referredBy[_newUser] = referrer;
        aff.userReferrals++;
        aff.totalReferrals++;

        // FIX: commission rates are in basis points → divide by 10000 (not 1000)
        uint256 reward = (userReferralReward * commissionRates[uint256(aff.level)]) / 10000;
        aff.pendingEarnings += reward;
        aff.totalEarnings += reward;

        uint256 idx = referralHistory.length;
        referralHistory.push(
            ReferralEvent({
                referrer: referrer,
                referred: _newUser,
                timestamp: block.timestamp,
                rewardAmount: reward,
                isProject: false,
                projectId: 0
            })
        );
        affiliateReferralIndices[referrer].push(idx);

        _checkLevelUp(referrer);

        emit ReferralRecorded(referrer, _newUser, false, reward);
    }

    /**
     * @notice Record a project referral (called when project is submitted with code)
     */
    function recordProjectReferral(uint256 _projectId, address _submitter, bytes32 _referralCode)
        external
        onlyAuthorized
    {
        require(projectReferrer[_projectId] == address(0), "Already referred");

        address referrer = codeToAffiliate[_referralCode];
        require(referrer != address(0), "Invalid code");
        require(referrer != _submitter, "Cannot self-refer");

        Affiliate storage aff = affiliates[referrer];
        require(aff.active, "Affiliate not active");

        projectReferrer[_projectId] = referrer;
        aff.projectReferrals++;
        aff.totalReferrals++;

        // FIX: commission rates are in basis points → divide by 10000 (not 1000)
        uint256 reward = (projectReferralReward * commissionRates[uint256(aff.level)]) / 10000;
        aff.pendingEarnings += reward;
        aff.totalEarnings += reward;

        uint256 idx = referralHistory.length;
        referralHistory.push(
            ReferralEvent({
                referrer: referrer,
                referred: _submitter,
                timestamp: block.timestamp,
                rewardAmount: reward,
                isProject: true,
                projectId: _projectId
            })
        );
        affiliateReferralIndices[referrer].push(idx);

        _checkLevelUp(referrer);

        emit ReferralRecorded(referrer, _submitter, true, reward);
    }

    function _checkLevelUp(address _affiliate) internal {
        Affiliate storage aff = affiliates[_affiliate];
        uint256 total = aff.totalReferrals;

        AffiliateLevel newLevel = AffiliateLevel.Bronze;

        if (total >= levelThresholds[4]) {
            newLevel = AffiliateLevel.Diamond;
        } else if (total >= levelThresholds[3]) {
            newLevel = AffiliateLevel.Platinum;
        } else if (total >= levelThresholds[2]) {
            newLevel = AffiliateLevel.Gold;
        } else if (total >= levelThresholds[1]) {
            newLevel = AffiliateLevel.Silver;
        }

        if (newLevel > aff.level) {
            aff.level = newLevel;
            emit LevelUpgraded(_affiliate, newLevel);
        }
    }

    // ============ Withdrawals ============

    /**
     * @notice Withdraw pending earnings
     */
    function withdrawEarnings() external nonReentrant {
        Affiliate storage aff = affiliates[msg.sender];
        require(aff.active, "Not an affiliate");
        require(aff.pendingEarnings >= minWithdraw, "Below minimum");

        uint256 amount = aff.pendingEarnings;
        aff.pendingEarnings = 0;

        scoreToken.mintRewards(msg.sender, amount);

        emit EarningsWithdrawn(msg.sender, amount);
    }

    // ============ View Functions ============

    function getAffiliate(address _affiliate) external view returns (Affiliate memory) {
        return affiliates[_affiliate];
    }

    function getAffiliateByCode(bytes32 _code) external view returns (address, Affiliate memory) {
        address addr = codeToAffiliate[_code];
        return (addr, affiliates[addr]);
    }

    function getReferrer(address _user) external view returns (address) {
        return referredBy[_user];
    }

    function getProjectReferrer(uint256 _projectId) external view returns (address) {
        return projectReferrer[_projectId];
    }

    function getCommissionRate(AffiliateLevel _level) external view returns (uint256) {
        return commissionRates[uint256(_level)];
    }

    function getTotalAffiliates() external view returns (uint256) {
        return affiliateList.length;
    }

    function getReferralHistory(uint256 _offset, uint256 _limit) external view returns (ReferralEvent[] memory) {
        uint256 total = referralHistory.length;
        if (_offset >= total) return new ReferralEvent[](0);

        uint256 count = _limit;
        if (_offset + _limit > total) count = total - _offset;

        ReferralEvent[] memory result = new ReferralEvent[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = referralHistory[_offset + i];
        }
        return result;
    }

    /**
     * @notice Get referral events for a specific affiliate (O(n) on their events only, not global history)
     */
    function getAffiliateReferrals(address _affiliate, uint256 _limit) external view returns (ReferralEvent[] memory) {
        uint256[] storage indices = affiliateReferralIndices[_affiliate];
        uint256 total = indices.length;
        if (total == 0) return new ReferralEvent[](0);

        uint256 resultSize = total < _limit ? total : _limit;
        ReferralEvent[] memory result = new ReferralEvent[](resultSize);

        // Most recent first
        for (uint256 i = 0; i < resultSize; i++) {
            result[i] = referralHistory[indices[total - 1 - i]];
        }
        return result;
    }

    /**
     * @notice Get top affiliates by total earnings
     */
    function getTopAffiliates(uint256 _count) external view returns (address[] memory, Affiliate[] memory) {
        uint256 len = affiliateList.length;
        if (_count > len) _count = len;

        address[] memory sorted = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            sorted[i] = affiliateList[i];
        }

        for (uint256 i = 0; i < _count; i++) {
            for (uint256 j = i + 1; j < len; j++) {
                if (affiliates[sorted[j]].totalEarnings > affiliates[sorted[i]].totalEarnings) {
                    address temp = sorted[i];
                    sorted[i] = sorted[j];
                    sorted[j] = temp;
                }
            }
        }

        address[] memory topAddrs = new address[](_count);
        Affiliate[] memory topAffs = new Affiliate[](_count);

        for (uint256 i = 0; i < _count; i++) {
            topAddrs[i] = sorted[i];
            topAffs[i] = affiliates[sorted[i]];
        }

        return (topAddrs, topAffs);
    }

    // ============ Admin Functions ============

    function setAuthorizedRecorder(address _recorder, bool _authorized) external onlyOwner {
        authorizedRecorders[_recorder] = _authorized;
    }

    function setCommissionRate(AffiliateLevel _level, uint256 _rateBps) external onlyOwner {
        require(_rateBps <= 2500, "Max 25%");
        commissionRates[uint256(_level)] = _rateBps;
        emit CommissionRateUpdated(_level, _rateBps);
    }

    function setRewards(uint256 _projectReward, uint256 _userReward) external onlyOwner {
        projectReferralReward = _projectReward;
        userReferralReward = _userReward;
    }

    function setLevelThresholds(uint256[5] calldata _thresholds) external onlyOwner {
        levelThresholds = _thresholds;
    }

    function deactivateAffiliate(address _affiliate) external onlyOwner {
        affiliates[_affiliate].active = false;
    }

    modifier onlyAuthorized() {
        require(authorizedRecorders[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
}
