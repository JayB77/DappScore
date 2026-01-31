// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReputationSystem
 * @notice Tracks user reputation with decay, accuracy, and leaderboards
 * @dev Reputation decays over time if users don't stay active
 *
 * Features:
 * - Reputation points earned from accurate votes
 * - Decay: -1% per week of inactivity
 * - Accuracy tracking: % of votes that matched final trust level
 * - Leaderboards: Top scam hunters, most accurate, most active
 * - Multipliers: Higher rep = higher vote weight
 */
contract ReputationSystem is Ownable, ReentrancyGuard {

    struct UserReputation {
        uint256 points;              // Current reputation points
        uint256 totalVotes;          // Total votes cast
        uint256 accurateVotes;       // Votes that matched outcome
        uint256 scamsIdentified;     // Projects correctly flagged as scam
        uint256 lastActivityTime;    // Last vote/action timestamp
        uint256 accountCreatedAt;    // When user first interacted
        uint256 decayAppliedAt;      // Last time decay was calculated
    }

    struct LeaderboardEntry {
        address user;
        uint256 score;
    }

    // State
    mapping(address => UserReputation) public userReputation;
    address[] public allUsers;
    mapping(address => bool) public isRegistered;

    // Authorized updaters (VotingEngine, etc.)
    mapping(address => bool) public authorizedUpdaters;

    // Configuration
    uint256 public decayRateBps = 100;           // 1% per decay period
    uint256 public decayPeriod = 7 days;         // Weekly decay
    uint256 public basePointsPerVote = 10;       // Points per vote
    uint256 public accuracyBonusMultiplier = 5;  // 5x points for accurate votes
    uint256 public scamBonusPoints = 500;        // Bonus for identifying scams

    // Events
    event ReputationUpdated(address indexed user, uint256 newPoints, string reason);
    event AccuracyRecorded(address indexed user, uint256 projectId, bool wasAccurate);
    event ScamIdentified(address indexed user, uint256 projectId);
    event DecayApplied(address indexed user, uint256 decayAmount);
    event UserRegistered(address indexed user);

    constructor(address _initialOwner) Ownable(_initialOwner) {}

    // ============ Core Functions ============

    /**
     * @notice Register a new user (called on first interaction)
     */
    function registerUser(address _user) external onlyAuthorized {
        if (!isRegistered[_user]) {
            isRegistered[_user] = true;
            allUsers.push(_user);
            userReputation[_user] = UserReputation({
                points: 100,  // Starting reputation
                totalVotes: 0,
                accurateVotes: 0,
                scamsIdentified: 0,
                lastActivityTime: block.timestamp,
                accountCreatedAt: block.timestamp,
                decayAppliedAt: block.timestamp
            });
            emit UserRegistered(_user);
            emit ReputationUpdated(_user, 100, "initial");
        }
    }

    /**
     * @notice Record a vote and award base points
     */
    function recordVote(address _user) external onlyAuthorized {
        _applyDecay(_user);

        UserReputation storage rep = userReputation[_user];
        rep.totalVotes++;
        rep.points += basePointsPerVote;
        rep.lastActivityTime = block.timestamp;

        emit ReputationUpdated(_user, rep.points, "vote");
    }

    /**
     * @notice Record vote accuracy after project outcome is determined
     * @param _user The voter
     * @param _projectId The project ID
     * @param _wasAccurate Whether their vote matched the outcome
     * @param _wasScamCall Whether they correctly identified a scam
     */
    function recordAccuracy(
        address _user,
        uint256 _projectId,
        bool _wasAccurate,
        bool _wasScamCall
    ) external onlyAuthorized {
        _applyDecay(_user);

        UserReputation storage rep = userReputation[_user];

        if (_wasAccurate) {
            rep.accurateVotes++;
            rep.points += basePointsPerVote * accuracyBonusMultiplier;

            if (_wasScamCall) {
                rep.scamsIdentified++;
                rep.points += scamBonusPoints;
                emit ScamIdentified(_user, _projectId);
            }
        }

        emit AccuracyRecorded(_user, _projectId, _wasAccurate);
        emit ReputationUpdated(_user, rep.points, _wasAccurate ? "accurate_vote" : "inaccurate_vote");
    }

    /**
     * @notice Apply reputation decay for inactivity
     */
    function _applyDecay(address _user) internal {
        UserReputation storage rep = userReputation[_user];

        if (rep.points == 0 || rep.decayAppliedAt == 0) return;

        uint256 periodsPassed = (block.timestamp - rep.decayAppliedAt) / decayPeriod;

        if (periodsPassed > 0) {
            // Apply compound decay
            uint256 decayAmount = 0;
            uint256 currentPoints = rep.points;

            for (uint256 i = 0; i < periodsPassed && i < 52; i++) { // Max 1 year decay at once
                uint256 periodDecay = (currentPoints * decayRateBps) / 10000;
                if (periodDecay == 0) periodDecay = 1; // Minimum 1 point decay
                decayAmount += periodDecay;
                currentPoints -= periodDecay;
                if (currentPoints == 0) break;
            }

            if (decayAmount > rep.points) {
                decayAmount = rep.points;
            }

            rep.points -= decayAmount;
            rep.decayAppliedAt = block.timestamp;

            if (decayAmount > 0) {
                emit DecayApplied(_user, decayAmount);
            }
        }
    }

    /**
     * @notice Manually trigger decay calculation (callable by anyone)
     */
    function applyDecay(address _user) external {
        _applyDecay(_user);
    }

    // ============ View Functions ============

    /**
     * @notice Get user's current reputation (with pending decay applied)
     */
    function getReputation(address _user) external view returns (UserReputation memory) {
        UserReputation memory rep = userReputation[_user];

        // Calculate pending decay without modifying state
        if (rep.points > 0 && rep.decayAppliedAt > 0) {
            uint256 periodsPassed = (block.timestamp - rep.decayAppliedAt) / decayPeriod;

            for (uint256 i = 0; i < periodsPassed && i < 52; i++) {
                uint256 periodDecay = (rep.points * decayRateBps) / 10000;
                if (periodDecay == 0) periodDecay = 1;
                if (periodDecay >= rep.points) {
                    rep.points = 0;
                    break;
                }
                rep.points -= periodDecay;
            }
        }

        return rep;
    }

    /**
     * @notice Get user's accuracy percentage (basis points)
     */
    function getAccuracyBps(address _user) external view returns (uint256) {
        UserReputation memory rep = userReputation[_user];
        if (rep.totalVotes == 0) return 0;
        return (rep.accurateVotes * 10000) / rep.totalVotes;
    }

    /**
     * @notice Get vote weight multiplier based on reputation (basis points)
     * @dev 10000 = 1x, 15000 = 1.5x, etc.
     */
    function getVoteWeightMultiplier(address _user) external view returns (uint256) {
        UserReputation memory rep = userReputation[_user];

        // Base multiplier
        uint256 multiplier = 10000;

        // Reputation bonus: +0.1% per 100 rep points, max +50%
        uint256 repBonus = (rep.points / 100) * 10;
        if (repBonus > 5000) repBonus = 5000;
        multiplier += repBonus;

        // Accuracy bonus: +0.5% per 1% accuracy above 50%, max +25%
        if (rep.totalVotes >= 10) {
            uint256 accuracyPct = (rep.accurateVotes * 100) / rep.totalVotes;
            if (accuracyPct > 50) {
                uint256 accBonus = (accuracyPct - 50) * 50;
                if (accBonus > 2500) accBonus = 2500;
                multiplier += accBonus;
            }
        }

        // Account age bonus: +1% per month, max +12%
        uint256 monthsOld = (block.timestamp - rep.accountCreatedAt) / 30 days;
        uint256 ageBonus = monthsOld * 100;
        if (ageBonus > 1200) ageBonus = 1200;
        multiplier += ageBonus;

        return multiplier;
    }

    /**
     * @notice Get top users by reputation points
     */
    function getTopByReputation(uint256 _count) external view returns (LeaderboardEntry[] memory) {
        return _getTopUsers(_count, 0);
    }

    /**
     * @notice Get top scam hunters
     */
    function getTopScamHunters(uint256 _count) external view returns (LeaderboardEntry[] memory) {
        return _getTopUsers(_count, 1);
    }

    /**
     * @notice Get most accurate voters (min 20 votes)
     */
    function getMostAccurate(uint256 _count) external view returns (LeaderboardEntry[] memory) {
        return _getTopUsers(_count, 2);
    }

    function _getTopUsers(uint256 _count, uint256 _type) internal view returns (LeaderboardEntry[] memory) {
        uint256 len = allUsers.length;
        if (_count > len) _count = len;

        LeaderboardEntry[] memory entries = new LeaderboardEntry[](len);

        for (uint256 i = 0; i < len; i++) {
            address user = allUsers[i];
            UserReputation memory rep = userReputation[user];

            uint256 score;
            if (_type == 0) {
                score = rep.points;
            } else if (_type == 1) {
                score = rep.scamsIdentified;
            } else {
                // Accuracy - require min 20 votes
                if (rep.totalVotes >= 20) {
                    score = (rep.accurateVotes * 10000) / rep.totalVotes;
                }
            }

            entries[i] = LeaderboardEntry({user: user, score: score});
        }

        // Simple bubble sort for top N (fine for moderate user counts)
        for (uint256 i = 0; i < _count; i++) {
            for (uint256 j = i + 1; j < len; j++) {
                if (entries[j].score > entries[i].score) {
                    LeaderboardEntry memory temp = entries[i];
                    entries[i] = entries[j];
                    entries[j] = temp;
                }
            }
        }

        // Return top N
        LeaderboardEntry[] memory result = new LeaderboardEntry[](_count);
        for (uint256 i = 0; i < _count; i++) {
            result[i] = entries[i];
        }

        return result;
    }

    /**
     * @notice Get total registered users
     */
    function getTotalUsers() external view returns (uint256) {
        return allUsers.length;
    }

    // ============ Admin Functions ============

    function setAuthorizedUpdater(address _updater, bool _authorized) external onlyOwner {
        authorizedUpdaters[_updater] = _authorized;
    }

    function setDecayConfig(uint256 _rateBps, uint256 _period) external onlyOwner {
        require(_rateBps <= 1000, "Max 10% decay");
        decayRateBps = _rateBps;
        decayPeriod = _period;
    }

    function setPointsConfig(
        uint256 _basePoints,
        uint256 _accuracyMultiplier,
        uint256 _scamBonus
    ) external onlyOwner {
        basePointsPerVote = _basePoints;
        accuracyBonusMultiplier = _accuracyMultiplier;
        scamBonusPoints = _scamBonus;
    }

    modifier onlyAuthorized() {
        require(authorizedUpdaters[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
}
