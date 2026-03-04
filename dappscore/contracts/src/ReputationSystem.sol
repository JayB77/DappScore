// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReputationSystem
 * @notice Tracks user reputation with decay, accuracy, and leaderboards
 * @dev UUPS upgradeable proxy pattern via OpenZeppelin Initializable + UUPSUpgradeable.
 *      Deploy via ERC1967Proxy pointing at this implementation.
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE — upgrade authority + config changes
 *   UPDATER_ROLE       — can call registerUser / recordVote / recordAccuracy
 *                        (granted to VotingEngine)
 *
 * Reputation decays over time if users don't stay active (-1% per week default).
 * Accuracy is recorded by the VotingEngine when project trust levels change.
 *
 * Bug fixes vs v1:
 *   - decayAppliedAt now advances by (periodsPassed * decayPeriod) instead of
 *     block.timestamp so partial periods are not lost.
 *   - Ownable replaced with AccessControl (proxy-compatible, role-based).
 *   - authorizedUpdaters mapping replaced with UPDATER_ROLE.
 */
contract ReputationSystem is Initializable, UUPSUpgradeable, AccessControl, ReentrancyGuard {
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    struct UserReputation {
        uint256 points;           // Current reputation points
        uint256 totalVotes;       // Total votes cast
        uint256 accurateVotes;    // Votes that matched outcome
        uint256 scamsIdentified;  // Projects correctly flagged as scam
        uint256 lastActivityTime; // Last vote/action timestamp
        uint256 accountCreatedAt; // When user first interacted
        uint256 decayAppliedAt;   // Last time decay was calculated
    }

    struct LeaderboardEntry {
        address user;
        uint256 score;
    }

    // ============ State ============

    mapping(address => UserReputation) public userReputation;
    address[] public allUsers;
    mapping(address => bool) public isRegistered;

    uint256 public decayRateBps;          // e.g. 100 = 1% per decay period
    uint256 public decayPeriod;           // e.g. 7 days
    uint256 public basePointsPerVote;
    uint256 public accuracyBonusMultiplier;
    uint256 public scamBonusPoints;

    // Storage gap for future upgrade variables (50 - ~7 state slots used)
    uint256[43] private __gap;

    // ============ Events ============

    event ReputationUpdated(address indexed user, uint256 newPoints, string reason);
    event AccuracyRecorded(address indexed user, uint256 projectId, bool wasAccurate);
    event ScamIdentified(address indexed user, uint256 projectId);
    event DecayApplied(address indexed user, uint256 decayAmount);
    event UserRegistered(address indexed user);

    // ============ Constructor / Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the proxy (called once via ERC1967Proxy constructor data)
     * @param _admin Address granted DEFAULT_ADMIN_ROLE (and thus upgrade authority)
     */
    function initialize(address _admin) external initializer {
        require(_admin != address(0), "Zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        decayRateBps = 100;          // 1% per period
        decayPeriod = 7 days;
        basePointsPerVote = 10;
        accuracyBonusMultiplier = 5;
        scamBonusPoints = 500;
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ============ Core Functions ============

    /**
     * @notice Register a new user on first interaction
     */
    function registerUser(address _user) external onlyRole(UPDATER_ROLE) {
        if (!isRegistered[_user]) {
            isRegistered[_user] = true;
            allUsers.push(_user);
            userReputation[_user] = UserReputation({
                points: 100,
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
     * @notice Record a vote and award base reputation points
     */
    function recordVote(address _user) external onlyRole(UPDATER_ROLE) {
        _applyDecay(_user);

        UserReputation storage rep = userReputation[_user];
        rep.totalVotes++;
        rep.points += basePointsPerVote;
        rep.lastActivityTime = block.timestamp;

        emit ReputationUpdated(_user, rep.points, "vote");
    }

    /**
     * @notice Record vote accuracy after a project's trust level is resolved
     * @param _user        The voter whose accuracy is being recorded
     * @param _projectId   The project ID
     * @param _wasAccurate Whether their vote matched the final trust outcome
     * @param _wasScamCall Whether they correctly identified a scam
     */
    function recordAccuracy(
        address _user,
        uint256 _projectId,
        bool _wasAccurate,
        bool _wasScamCall
    ) external onlyRole(UPDATER_ROLE) {
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
     * @notice Trigger decay calculation for a user (callable by anyone)
     */
    function applyDecay(address _user) external {
        _applyDecay(_user);
    }

    function _applyDecay(address _user) internal {
        UserReputation storage rep = userReputation[_user];

        if (rep.points == 0 || rep.decayAppliedAt == 0) return;

        uint256 periodsPassed = (block.timestamp - rep.decayAppliedAt) / decayPeriod;

        if (periodsPassed > 0) {
            uint256 decayAmount = 0;
            uint256 currentPoints = rep.points;

            for (uint256 i = 0; i < periodsPassed && i < 52; i++) {
                uint256 periodDecay = (currentPoints * decayRateBps) / 10000;
                if (periodDecay == 0) periodDecay = 1;
                decayAmount += periodDecay;
                currentPoints -= periodDecay;
                if (currentPoints == 0) break;
            }

            if (decayAmount > rep.points) {
                decayAmount = rep.points;
            }

            rep.points -= decayAmount;

            // FIX: advance by full periods only so the partial period carries over.
            // Previously this was `rep.decayAppliedAt = block.timestamp` which
            // silently discarded the remainder and caused slightly early next decay.
            rep.decayAppliedAt += periodsPassed * decayPeriod;

            if (decayAmount > 0) {
                emit DecayApplied(_user, decayAmount);
            }
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get user's reputation with pending decay simulated (read-only, no state change)
     */
    function getReputation(address _user) external view returns (UserReputation memory) {
        UserReputation memory rep = userReputation[_user];

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
     * @notice Get user's accuracy percentage (basis points, 10000 = 100%)
     */
    function getAccuracyBps(address _user) external view returns (uint256) {
        UserReputation memory rep = userReputation[_user];
        if (rep.totalVotes == 0) return 0;
        return (rep.accurateVotes * 10000) / rep.totalVotes;
    }

    /**
     * @notice Get vote weight multiplier based on reputation (basis points, 10000 = 1x)
     */
    function getVoteWeightMultiplier(address _user) external view returns (uint256) {
        UserReputation memory rep = userReputation[_user];

        uint256 multiplier = 10000;

        // Reputation bonus: +0.1% per 100 rep points, capped at +50%
        uint256 repBonus = (rep.points / 100) * 10;
        if (repBonus > 5000) repBonus = 5000;
        multiplier += repBonus;

        // Accuracy bonus: +0.5% per 1% accuracy above 50%, capped at +25%
        if (rep.totalVotes >= 10) {
            uint256 accuracyPct = (rep.accurateVotes * 100) / rep.totalVotes;
            if (accuracyPct > 50) {
                uint256 accBonus = (accuracyPct - 50) * 50;
                if (accBonus > 2500) accBonus = 2500;
                multiplier += accBonus;
            }
        }

        // Account age bonus: +1% per month, capped at +12%
        uint256 monthsOld = (block.timestamp - rep.accountCreatedAt) / 30 days;
        uint256 ageBonus = monthsOld * 100;
        if (ageBonus > 1200) ageBonus = 1200;
        multiplier += ageBonus;

        return multiplier;
    }

    function getTopByReputation(uint256 _count) external view returns (LeaderboardEntry[] memory) {
        return _getTopUsers(_count, 0);
    }

    function getTopScamHunters(uint256 _count) external view returns (LeaderboardEntry[] memory) {
        return _getTopUsers(_count, 1);
    }

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
                if (rep.totalVotes >= 20) {
                    score = (rep.accurateVotes * 10000) / rep.totalVotes;
                }
            }

            entries[i] = LeaderboardEntry({user: user, score: score});
        }

        // Partial selection sort — O(n * _count), acceptable for moderate user counts
        for (uint256 i = 0; i < _count; i++) {
            for (uint256 j = i + 1; j < len; j++) {
                if (entries[j].score > entries[i].score) {
                    LeaderboardEntry memory temp = entries[i];
                    entries[i] = entries[j];
                    entries[j] = temp;
                }
            }
        }

        LeaderboardEntry[] memory result = new LeaderboardEntry[](_count);
        for (uint256 i = 0; i < _count; i++) {
            result[i] = entries[i];
        }

        return result;
    }

    function getTotalUsers() external view returns (uint256) {
        return allUsers.length;
    }

    // ============ Admin Functions ============

    function setDecayConfig(uint256 _rateBps, uint256 _period) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_rateBps <= 1000, "Max 10% decay");
        decayRateBps = _rateBps;
        decayPeriod = _period;
    }

    function setPointsConfig(
        uint256 _basePoints,
        uint256 _accuracyMultiplier,
        uint256 _scamBonus
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        basePointsPerVote = _basePoints;
        accuracyBonusMultiplier = _accuracyMultiplier;
        scamBonusPoints = _scamBonus;
    }

    /**
     * @notice Grant or revoke UPDATER_ROLE (e.g. VotingEngine address)
     */
    function setUpdater(address _updater, bool _authorized) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_authorized) {
            _grantRole(UPDATER_ROLE, _updater);
        } else {
            _revokeRole(UPDATER_ROLE, _updater);
        }
    }
}
