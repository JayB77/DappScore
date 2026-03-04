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
 */

interface IReputationSystem {
    function registerUser(address _user) external;
    function recordVote(address _user) external;
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
        uint256 upvotes;
        uint256 downvotes;
        uint256 totalVoters;
    }

    // ============ State ============

    ScoreToken public scoreToken;
    ProjectRegistry public projectRegistry;

    /// @notice ReputationSystem contract — set after deployment.
    ///         Zero address = reputation tracking disabled (safe default).
    IReputationSystem public reputationSystem;

    mapping(uint256 => ProjectVotes) public projectVotes;
    mapping(uint256 => mapping(address => Vote)) public userVotes;
    mapping(address => uint256) public userTotalVotes;
    mapping(address => uint256) public pendingRewards;

    // Reward configuration
    uint256 public rewardPerVote;    // SCORE tokens per new vote
    uint256 public downvoteThreshold; // Downvotes to flag
    uint256 public scamThreshold;     // Downvotes to mark as probable scam

    // Staking for vote-weight boost
    mapping(address => uint256) public stakedBalance;
    uint256 public totalStaked;

    // Storage gap for future upgrade variables
    uint256[40] private __gap;

    // ============ Events ============

    event Voted(uint256 indexed projectId, address indexed voter, VoteType voteType);
    event VoteChanged(uint256 indexed projectId, address indexed voter, VoteType newVoteType);
    event CommentAdded(uint256 indexed projectId, address indexed commenter, string ipfsHash);
    event RewardsClaimed(address indexed user, uint256 amount);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event ProjectFlagged(uint256 indexed projectId);
    event ProjectMarkedScam(uint256 indexed projectId);
    event ReputationSystemSet(address indexed system);

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

        if (!isNewVoter) {
            // Remove old vote count
            if (existingVote.voteType == VoteType.Upvote) {
                votes.upvotes--;
            } else {
                votes.downvotes--;
            }
            emit VoteChanged(_projectId, msg.sender, _voteType);
        } else {
            // First vote on this project
            votes.totalVoters++;
            userTotalVotes[msg.sender]++;

            // Accrue reward for new votes only
            pendingRewards[msg.sender] += calculateReward(msg.sender);

            // Wire-up: register + record vote in ReputationSystem (if set)
            if (address(reputationSystem) != address(0)) {
                // registerUser is idempotent — safe to call on every first vote
                try reputationSystem.registerUser(msg.sender) {} catch {}
                try reputationSystem.recordVote(msg.sender) {} catch {}
            }
        }

        // Apply new vote
        if (_voteType == VoteType.Upvote) {
            votes.upvotes++;
        } else {
            votes.downvotes++;
        }

        userVotes[_projectId][msg.sender] = Vote({
            voteType: _voteType,
            timestamp: block.timestamp,
            commentIpfsHash: _commentIpfsHash
        });

        emit Voted(_projectId, msg.sender, _voteType);

        if (bytes(_commentIpfsHash).length > 0) {
            emit CommentAdded(_projectId, msg.sender, _commentIpfsHash);
        }

        _updateTrustLevel(_projectId);
    }

    /**
     * @notice Calculate reward for a voter (base + staking boost)
     */
    function calculateReward(address _voter) public view returns (uint256) {
        uint256 baseReward = rewardPerVote;
        uint256 staked = stakedBalance[_voter];

        if (staked == 0) {
            return baseReward;
        }

        // Boost: sqrt(staked / 1000 SCORE), capped at 100 (= 2x)
        uint256 boost = sqrt(staked / (1000 * 10 ** 18));
        if (boost > 100) boost = 100;

        return baseReward + (baseReward * boost / 100);
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

    // ============ Internal ============

    function _updateTrustLevel(uint256 _projectId) internal {
        ProjectVotes storage votes = projectVotes[_projectId];

        int256 netVotes = int256(votes.upvotes) - int256(votes.downvotes);
        ProjectRegistry.TrustLevel newLevel;

        if (votes.totalVoters < 10) {
            newLevel = ProjectRegistry.TrustLevel.NewListing;
        } else if (votes.downvotes >= scamThreshold) {
            newLevel = ProjectRegistry.TrustLevel.ProbableScam;
            emit ProjectMarkedScam(_projectId);
        } else if (votes.downvotes >= downvoteThreshold) {
            newLevel = ProjectRegistry.TrustLevel.SuspectedScam;
            emit ProjectFlagged(_projectId);
        } else if (netVotes < -50) {
            newLevel = ProjectRegistry.TrustLevel.Suspicious;
        } else if (netVotes < 0) {
            newLevel = ProjectRegistry.TrustLevel.Neutral;
        } else if (netVotes >= 100) {
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
