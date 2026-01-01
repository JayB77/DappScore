// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ScoreToken.sol";
import "./ProjectRegistry.sol";

/**
 * @title VotingEngine
 * @notice Handles voting on projects and distributes rewards
 * @dev One vote per wallet per project, with reward distribution
 */
contract VotingEngine is Ownable, ReentrancyGuard {

    enum VoteType {
        None,
        Upvote,
        Downvote
    }

    struct Vote {
        VoteType voteType;
        uint256 timestamp;
        string commentIpfsHash;  // Optional comment stored on IPFS
    }

    struct ProjectVotes {
        uint256 upvotes;
        uint256 downvotes;
        uint256 totalVoters;
    }

    // Contracts
    ScoreToken public scoreToken;
    ProjectRegistry public projectRegistry;

    // State
    mapping(uint256 => ProjectVotes) public projectVotes;
    mapping(uint256 => mapping(address => Vote)) public userVotes;
    mapping(address => uint256) public userTotalVotes;
    mapping(address => uint256) public pendingRewards;

    // Reward configuration
    uint256 public rewardPerVote = 10 * 10**18;  // 10 SCORE per vote
    uint256 public downvoteThreshold = 100;       // Votes needed to flag
    uint256 public scamThreshold = 500;           // Votes needed to mark as scam

    // Staking boost (users can stake SCORE to boost voting power)
    mapping(address => uint256) public stakedBalance;
    uint256 public totalStaked;

    // Daily reward pool distribution
    uint256 public dailyRewardPool;
    uint256 public lastDistributionTime;

    // Events
    event Voted(uint256 indexed projectId, address indexed voter, VoteType voteType);
    event VoteChanged(uint256 indexed projectId, address indexed voter, VoteType newVoteType);
    event CommentAdded(uint256 indexed projectId, address indexed commenter, string ipfsHash);
    event RewardsClaimed(address indexed user, uint256 amount);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event ProjectFlagged(uint256 indexed projectId);
    event ProjectMarkedScam(uint256 indexed projectId);

    constructor(
        address _initialOwner,
        address _scoreToken,
        address _projectRegistry
    ) Ownable(_initialOwner) {
        scoreToken = ScoreToken(_scoreToken);
        projectRegistry = ProjectRegistry(_projectRegistry);
        lastDistributionTime = block.timestamp;
    }

    /**
     * @notice Vote on a project (upvote or downvote)
     * @param _projectId Project ID to vote on
     * @param _voteType 1 = Upvote, 2 = Downvote
     * @param _commentIpfsHash Optional IPFS hash of comment
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

        // Handle vote change
        if (existingVote.voteType != VoteType.None) {
            // Remove old vote
            if (existingVote.voteType == VoteType.Upvote) {
                votes.upvotes--;
            } else {
                votes.downvotes--;
            }
            emit VoteChanged(_projectId, msg.sender, _voteType);
        } else {
            // New voter
            votes.totalVoters++;
            userTotalVotes[msg.sender]++;

            // Award tokens for first vote on this project
            pendingRewards[msg.sender] += calculateReward(msg.sender);
        }

        // Apply new vote
        if (_voteType == VoteType.Upvote) {
            votes.upvotes++;
        } else {
            votes.downvotes++;
        }

        // Store vote
        userVotes[_projectId][msg.sender] = Vote({
            voteType: _voteType,
            timestamp: block.timestamp,
            commentIpfsHash: _commentIpfsHash
        });

        emit Voted(_projectId, msg.sender, _voteType);

        if (bytes(_commentIpfsHash).length > 0) {
            emit CommentAdded(_projectId, msg.sender, _commentIpfsHash);
        }

        // Check thresholds and update trust level
        _updateTrustLevel(_projectId);
    }

    /**
     * @notice Calculate reward for a voter (based on stake)
     */
    function calculateReward(address _voter) public view returns (uint256) {
        uint256 baseReward = rewardPerVote;
        uint256 staked = stakedBalance[_voter];

        if (staked == 0) {
            return baseReward;
        }

        // Boost: up to 2x for large stakers
        // sqrt(staked / 1000 SCORE) as multiplier, capped at 2x
        uint256 boost = sqrt(staked / (1000 * 10**18));
        if (boost > 100) boost = 100; // Cap at 2x

        return baseReward + (baseReward * boost / 100);
    }

    /**
     * @notice Claim pending rewards
     */
    function claimRewards() external nonReentrant {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No rewards to claim");

        pendingRewards[msg.sender] = 0;

        // Mint rewards from token
        scoreToken.mintRewards(msg.sender, amount);

        emit RewardsClaimed(msg.sender, amount);
    }

    /**
     * @notice Stake SCORE tokens for voting boost
     * @param _amount Amount to stake
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
     * @param _amount Amount to unstake
     */
    function unstake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(stakedBalance[msg.sender] >= _amount, "Insufficient staked balance");

        stakedBalance[msg.sender] -= _amount;
        totalStaked -= _amount;

        require(scoreToken.transfer(msg.sender, _amount), "Transfer failed");

        emit Unstaked(msg.sender, _amount);
    }

    /**
     * @notice Update trust level based on votes
     */
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

    /**
     * @notice Update reward per vote (admin)
     */
    function setRewardPerVote(uint256 _reward) external onlyOwner {
        rewardPerVote = _reward;
    }

    /**
     * @notice Update thresholds (admin)
     */
    function setThresholds(uint256 _downvote, uint256 _scam) external onlyOwner {
        downvoteThreshold = _downvote;
        scamThreshold = _scam;
    }

    // View functions

    function getProjectVotes(uint256 _projectId) external view returns (ProjectVotes memory) {
        return projectVotes[_projectId];
    }

    function getUserVote(uint256 _projectId, address _user) external view returns (Vote memory) {
        return userVotes[_projectId][_user];
    }

    function getUserStats(address _user) external view returns (
        uint256 totalVotes,
        uint256 pending,
        uint256 staked
    ) {
        return (
            userTotalVotes[_user],
            pendingRewards[_user],
            stakedBalance[_user]
        );
    }

    // Utility
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
}
