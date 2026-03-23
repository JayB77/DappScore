// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ScoreToken.sol";
import "./ProjectRegistry.sol";

/**
 * @title VotingEngine
 * @notice Handles voting on projects and distributes rewards
 * @dev UUPS upgradeable proxy pattern via OpenZeppelin Initializable + UUPSUpgradeable.
 *      Deploy via ERC1967Proxy pointing at this implementation.
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE — upgrade authority, config
 *   OPERATOR_ROLE      — can adjust thresholds and reward parameters
 *
 * Wire-up:
 *   On every new vote, calls IReputationSystem.registerUser() + .recordVote().
 *   The ReputationSystem must grant UPDATER_ROLE to this contract.
 *
 * Vote weights:
 *   Each vote is weighted by (repMultiplier_bps * nftMultiplier_bps) / 10000.
 *   Raw upvotes/downvotes are still tracked for quorum; weighted totals drive
 *   the trust-level thresholds. effectiveVotes = weightedVotes / 10000 to
 *   normalise back to a threshold-comparable scale.
 */

interface IReputationSystem {
    function registerUser(address _user) external;
    function recordVote(address _user) external;
    /// @dev Returns multiplier in bps (10 000 = 1x). View — no state change.
    function getVoteWeightMultiplier(address _user) external view returns (uint256);
    /// @dev Called after a project trust level finalises. Requires UPDATER_ROLE on caller.
    function recordAccuracy(
        address _user,
        uint256 _projectId,
        bool _wasAccurate,
        bool _wasScamCall
    ) external;
}

interface ICuratorNFT {
    /// @dev Returns vote-weight multiplier in bps (10 000 = 1x).
    function getVoteWeightMultiplier(address _user) external view returns (uint256);
    /// @dev Returns reward multiplier in bps (10 000 = 1x).
    function getRewardMultiplier(address _user) external view returns (uint256);
}

contract VotingEngine is Initializable, UUPSUpgradeable, AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum VoteType {
        None,
        Upvote,
        Downvote
    }

    struct Vote {
        VoteType voteType;
        uint256 timestamp;
        string commentIpfsHash; // Optional comment stored on IPFS
    }

    struct ProjectVotes {
        uint256 upvotes;           // Raw vote count
        uint256 downvotes;         // Raw vote count
        uint256 totalVoters;
        uint256 weightedUpvotes;   // Sum of per-voter combined_bps for upvoters
        uint256 weightedDownvotes; // Sum of per-voter combined_bps for downvoters
    }

    // ============ State ============

    ScoreToken public scoreToken;
    ProjectRegistry public projectRegistry;

    /// @notice ReputationSystem contract — set after deployment.
    ///         Zero address = reputation tracking disabled (safe default).
    IReputationSystem public reputationSystem;

    /// @notice CuratorNFT contract — set after deployment.
    ///         Zero address = NFT multiplier disabled (falls back to 1x).
    ICuratorNFT public curatorNFT;

    mapping(uint256 => ProjectVotes) public projectVotes;
    mapping(uint256 => mapping(address => Vote)) public userVotes;

    /// @dev Stores the combined weight (bps) applied when a user voted on a project.
    ///      Used when removing an old vote to reverse the correct weighted amount.
    mapping(uint256 => mapping(address => uint256)) public userVoteWeight;

    mapping(address => uint256) public userTotalVotes;
    mapping(address => uint256) public pendingRewards;

    // Reward configuration
    uint256 public rewardPerVote;     // SCORE tokens per new vote (base)
    uint256 public downvoteThreshold; // Effective downvotes to flag (raw threshold × 10000)
    uint256 public scamThreshold;     // Effective downvotes to mark as probable scam (raw × 10000)

    // Staking for vote-weight boost
    mapping(address => uint256) public stakedBalance;
    uint256 public totalStaked;

    /// @dev Tracks whether accuracy has been recorded for a project (prevents double-counting).
    mapping(uint256 => bool) public accuracyRecordedFor;

    // Storage gap for future upgrade variables (reduced by 3 new top-level slots used above)
    uint256[37] private __gap;

    // ============ Events ============

    event Voted(uint256 indexed projectId, address indexed voter, VoteType voteType, uint256 weightBps);
    event VoteChanged(uint256 indexed projectId, address indexed voter, VoteType newVoteType, uint256 weightBps);
    event CommentAdded(uint256 indexed projectId, address indexed commenter, string ipfsHash);
    event RewardsClaimed(address indexed user, uint256 amount);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event ProjectFlagged(uint256 indexed projectId);
    event ProjectMarkedScam(uint256 indexed projectId);
    event ReputationSystemSet(address indexed system);
    event CuratorNFTSet(address indexed nft);
    event AccuracyRecorded(uint256 indexed projectId, uint256 voterCount);

    // ============ Constructor / Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the proxy
     * @param _admin           Receives DEFAULT_ADMIN_ROLE
     * @param _scoreToken      ScoreToken address
     * @param _projectRegistry ProjectRegistry proxy address
     */
    function initialize(
        address _admin,
        address _scoreToken,
        address _projectRegistry
    ) external initializer {
        require(_admin           != address(0), "Zero admin");
        require(_scoreToken      != address(0), "Zero token");
        require(_projectRegistry != address(0), "Zero registry");

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE,      _admin);

        scoreToken      = ScoreToken(_scoreToken);
        projectRegistry = ProjectRegistry(_projectRegistry);

        rewardPerVote     = 10 * 10 ** 18; // 10 SCORE per vote
        // These thresholds are now in "effective vote units" (bps-weighted).
        // At 1x weight (10 000 bps), 100 downvotes = 1 000 000 weighted units → threshold = 1 000 000.
        // Keeping the raw numbers: comparison uses weightedDownvotes / 10000 against original values.
        downvoteThreshold = 100;
        scamThreshold     = 500;
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ============ Voting ============

    /**
     * @notice Vote on a project (upvote or downvote)
     * @param _projectId        Project ID to vote on
     * @param _voteType         Upvote or Downvote
     * @param _commentIpfsHash  Optional IPFS hash of comment
     */
    function vote(
        uint256 _projectId,
        VoteType _voteType,
        string calldata _commentIpfsHash
    ) external nonReentrant {
        require(_voteType == VoteType.Upvote || _voteType == VoteType.Downvote, "Invalid vote type");

        ProjectRegistry.Project memory project = projectRegistry.getProject(_projectId);
        require(project.id != 0, "Project not found");
        require(project.status == ProjectRegistry.ProjectStatus.Active, "Project not active");

        Vote storage existingVote = userVotes[_projectId][msg.sender];
        ProjectVotes storage votes = projectVotes[_projectId];

        bool isNewVoter = existingVote.voteType == VoteType.None;

        // Compute combined weight for this vote
        uint256 combinedBps = _getCombinedWeight(msg.sender);

        if (!isNewVoter) {
            // Remove old weighted contribution
            uint256 oldWeight = userVoteWeight[_projectId][msg.sender];
            if (existingVote.voteType == VoteType.Upvote) {
                votes.upvotes--;
                if (votes.weightedUpvotes >= oldWeight) votes.weightedUpvotes -= oldWeight;
            } else {
                votes.downvotes--;
                if (votes.weightedDownvotes >= oldWeight) votes.weightedDownvotes -= oldWeight;
            }
            emit VoteChanged(_projectId, msg.sender, _voteType, combinedBps);
        } else {
            // First vote on this project
            votes.totalVoters++;
            userTotalVotes[msg.sender]++;

            // Accrue reward for new votes only (with NFT multiplier applied)
            pendingRewards[msg.sender] += calculateReward(msg.sender);

            // Wire-up: register + record vote in ReputationSystem (if set)
            if (address(reputationSystem) != address(0)) {
                // registerUser is idempotent — safe to call on every first vote
                try reputationSystem.registerUser(msg.sender) {} catch {}
                try reputationSystem.recordVote(msg.sender) {} catch {}
            }

            emit Voted(_projectId, msg.sender, _voteType, combinedBps);
        }

        // Store weight used so we can reverse it on vote change
        userVoteWeight[_projectId][msg.sender] = combinedBps;

        // Apply new weighted vote
        if (_voteType == VoteType.Upvote) {
            votes.upvotes++;
            votes.weightedUpvotes += combinedBps;
        } else {
            votes.downvotes++;
            votes.weightedDownvotes += combinedBps;
        }

        userVotes[_projectId][msg.sender] = Vote({
            voteType: _voteType,
            timestamp: block.timestamp,
            commentIpfsHash: _commentIpfsHash
        });

        if (bytes(_commentIpfsHash).length > 0) {
            emit CommentAdded(_projectId, msg.sender, _commentIpfsHash);
        }

        _updateTrustLevel(_projectId);
    }

    /**
     * @notice Calculate reward for a voter.
     *         Base reward × staking boost × NFT reward multiplier.
     */
    function calculateReward(address _voter) public view returns (uint256) {
        uint256 baseReward = rewardPerVote;
        uint256 staked = stakedBalance[_voter];

        // Staking boost: sqrt(staked / 1000 SCORE), capped at 100% extra (= 2x)
        if (staked > 0) {
            uint256 boost = sqrt(staked / (1000 * 10 ** 18));
            if (boost > 100) boost = 100;
            baseReward = baseReward + (baseReward * boost / 100);
        }

        // NFT reward multiplier
        if (address(curatorNFT) != address(0)) {
            uint256 nftMultBps = 10000;
            try curatorNFT.getRewardMultiplier(_voter) returns (uint256 m) {
                nftMultBps = m;
            } catch {}
            baseReward = (baseReward * nftMultBps) / 10000;
        }

        return baseReward;
    }

    /**
     * @notice Claim pending SCORE rewards
     */
    function claimRewards() external nonReentrant {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No rewards to claim");

        pendingRewards[msg.sender] = 0;

        scoreToken.mintRewards(msg.sender, amount);

        emit RewardsClaimed(msg.sender, amount);
    }

    /**
     * @notice Stake SCORE tokens to boost vote rewards
     */
    function stake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(scoreToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        stakedBalance[msg.sender] += _amount;
        totalStaked += _amount;

        emit Staked(msg.sender, _amount);
    }

    /**
     * @notice Unstake SCORE tokens
     */
    function unstake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(stakedBalance[msg.sender] >= _amount, "Insufficient staked balance");

        stakedBalance[msg.sender] -= _amount;
        totalStaked -= _amount;

        require(scoreToken.transfer(msg.sender, _amount), "Transfer failed");

        emit Unstaked(msg.sender, _amount);
    }

    // ============ Accuracy Recording ============

    /**
     * @notice After a project's trust level finalises (ProbableScam), an operator
     *         calls this to credit/penalise voters for their accuracy.
     *         Safe to batch in chunks — the per-address hasVoted guard prevents
     *         double-counting within one call; `accuracyRecordedFor` prevents a
     *         second call for the whole project.
     *
     * @param _projectId     Project that finalised.
     * @param _voters        Addresses of voters to process in this batch.
     * @param _scamConfirmed True if the project was confirmed a scam (ProbableScam);
     *                       false if it was cleared (Trusted).
     * @param _finalBatch    Set true on the last batch to lock the project against
     *                       further calls.
     */
    function batchRecordAccuracy(
        uint256 _projectId,
        address[] calldata _voters,
        bool _scamConfirmed,
        bool _finalBatch
    ) external onlyRole(OPERATOR_ROLE) {
        require(!accuracyRecordedFor[_projectId], "Already recorded");
        require(address(reputationSystem) != address(0), "No reputation system");

        for (uint256 i = 0; i < _voters.length; ) {
            address voter = _voters[i];
            Vote storage v = userVotes[_projectId][voter];

            if (v.voteType != VoteType.None) {
                bool votedDown = v.voteType == VoteType.Downvote;
                bool wasAccurate = _scamConfirmed ? votedDown : !votedDown;

                try reputationSystem.recordAccuracy(
                    voter,
                    _projectId,
                    wasAccurate,
                    wasAccurate && _scamConfirmed
                ) {} catch {}
            }

            unchecked { i++; }
        }

        if (_finalBatch) {
            accuracyRecordedFor[_projectId] = true;
            emit AccuracyRecorded(_projectId, _voters.length);
        }
    }

    // ============ Internal ============

    /**
     * @dev Returns the combined vote-weight multiplier for `_user` in bps.
     *      combined = (repBps * nftBps) / 10 000.
     *      Falls back to 10 000 (1x) if either integration is absent.
     */
    function _getCombinedWeight(address _user) internal view returns (uint256) {
        uint256 repBps = 10000;
        uint256 nftBps = 10000;

        if (address(reputationSystem) != address(0)) {
            try reputationSystem.getVoteWeightMultiplier(_user) returns (uint256 m) {
                repBps = m;
            } catch {}
        }

        if (address(curatorNFT) != address(0)) {
            try curatorNFT.getVoteWeightMultiplier(_user) returns (uint256 m) {
                nftBps = m;
            } catch {}
        }

        return (repBps * nftBps) / 10000;
    }

    function _updateTrustLevel(uint256 _projectId) internal {
        ProjectVotes storage votes = projectVotes[_projectId];

        // Use effective votes (weighted / 10 000) for threshold comparison so
        // 1x-weight users hit thresholds at the same raw counts as before.
        uint256 effDown = votes.weightedDownvotes / 10000;
        uint256 effUp   = votes.weightedUpvotes   / 10000;
        int256  netEff  = int256(effUp) - int256(effDown);

        ProjectRegistry.TrustLevel newLevel;

        if (votes.totalVoters < 10) {
            newLevel = ProjectRegistry.TrustLevel.NewListing;
        } else if (effDown >= scamThreshold) {
            newLevel = ProjectRegistry.TrustLevel.ProbableScam;
            emit ProjectMarkedScam(_projectId);
        } else if (effDown >= downvoteThreshold) {
            newLevel = ProjectRegistry.TrustLevel.SuspectedScam;
            emit ProjectFlagged(_projectId);
        } else if (netEff < -50) {
            newLevel = ProjectRegistry.TrustLevel.Suspicious;
        } else if (netEff < 0) {
            newLevel = ProjectRegistry.TrustLevel.Neutral;
        } else if (netEff >= 100) {
            newLevel = ProjectRegistry.TrustLevel.Trusted;
        } else {
            newLevel = ProjectRegistry.TrustLevel.Neutral;
        }

        projectRegistry.setTrustLevel(_projectId, newLevel);
    }

    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set (or unset) the ReputationSystem integration address.
     *         The ReputationSystem must have granted UPDATER_ROLE to this contract.
     */
    function setReputationSystem(address _system) external onlyRole(DEFAULT_ADMIN_ROLE) {
        reputationSystem = IReputationSystem(_system);
        emit ReputationSystemSet(_system);
    }

    /**
     * @notice Set (or unset) the CuratorNFT integration address.
     */
    function setCuratorNFT(address _nft) external onlyRole(DEFAULT_ADMIN_ROLE) {
        curatorNFT = ICuratorNFT(_nft);
        emit CuratorNFTSet(_nft);
    }

    function setRewardPerVote(uint256 _reward) external onlyRole(OPERATOR_ROLE) {
        rewardPerVote = _reward;
    }

    function setThresholds(uint256 _downvote, uint256 _scam) external onlyRole(OPERATOR_ROLE) {
        downvoteThreshold = _downvote;
        scamThreshold = _scam;
    }

    // ============ View Functions ============

    function getProjectVotes(uint256 _projectId) external view returns (ProjectVotes memory) {
        return projectVotes[_projectId];
    }

    function getUserVote(uint256 _projectId, address _user) external view returns (Vote memory) {
        return userVotes[_projectId][_user];
    }

    function getUserStats(address _user)
        external
        view
        returns (uint256 totalVotes, uint256 pending, uint256 staked)
    {
        return (userTotalVotes[_user], pendingRewards[_user], stakedBalance[_user]);
    }
}
