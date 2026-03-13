// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ScoreToken.sol";

/**
 * @title BountySystem
 * @notice Post and claim bounties for investigating suspicious projects
 * @dev Users can fund bounties, investigators submit evidence, bounty poster approves
 *
 * Features:
 * - Anyone can post a bounty on a project
 * - Multiple funders can contribute to a bounty
 * - Investigators submit evidence (IPFS hash)
 * - Bounty poster or DAO approves payout
 * - Partial payouts for partial investigations
 */
contract BountySystem is Ownable, ReentrancyGuard {

    enum BountyStatus {
        Active,      // Accepting submissions
        UnderReview, // Has submissions being reviewed
        Completed,   // Bounty paid out
        Expired,     // Deadline passed, refunds available
        Cancelled    // Cancelled by creator
    }

    struct Bounty {
        uint256 projectId;
        address creator;
        uint256 totalFunding;
        uint256 remainingFunding;
        uint256 createdAt;
        uint256 deadline;
        string description;       // IPFS hash with bounty details
        BountyStatus status;
        uint256 submissionCount;
    }

    struct Submission {
        address investigator;
        uint256 submittedAt;
        string evidenceIpfsHash;  // IPFS hash with investigation report
        uint256 requestedAmount;  // Amount requested by investigator
        bool approved;
        bool rejected;
        uint256 paidAmount;
    }

    struct Contribution {
        uint256 amount;
        bool refunded;
    }

    // Contracts
    ScoreToken public scoreToken;
    address public treasury;

    // State
    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => Submission[]) public submissions;
    mapping(uint256 => mapping(address => Contribution)) public contributions;
    mapping(uint256 => address[]) public contributors;
    uint256 public bountyCount;

    // Investigator stats
    mapping(address => uint256) public investigatorEarnings;
    mapping(address => uint256) public investigatorCompletedBounties;

    // Configuration
    uint256 public minBountyAmount = 100 * 10**18;      // 100 SCORE minimum
    uint256 public platformFeeBps = 500;                 // 5% platform fee
    uint256 public minDeadline = 3 days;
    uint256 public maxDeadline = 90 days;

    // Events
    event BountyCreated(uint256 indexed bountyId, uint256 indexed projectId, address creator, uint256 amount, uint256 deadline);
    event BountyFunded(uint256 indexed bountyId, address funder, uint256 amount);
    event SubmissionAdded(uint256 indexed bountyId, uint256 submissionIndex, address investigator);
    event SubmissionApproved(uint256 indexed bountyId, uint256 submissionIndex, uint256 paidAmount);
    event SubmissionRejected(uint256 indexed bountyId, uint256 submissionIndex);
    event BountyCompleted(uint256 indexed bountyId);
    event BountyCancelled(uint256 indexed bountyId);
    event BountyExpired(uint256 indexed bountyId);
    event RefundClaimed(uint256 indexed bountyId, address contributor, uint256 amount);

    constructor(address _initialOwner, address _scoreToken, address _treasury) Ownable(_initialOwner) {
        scoreToken = ScoreToken(_scoreToken);
        treasury = _treasury;
    }

    // ============ Bounty Creation ============

    /**
     * @notice Create a new bounty for investigating a project
     * @param _projectId Project to investigate
     * @param _amount Initial funding amount
     * @param _deadline When bounty expires
     * @param _descriptionIpfs IPFS hash with bounty details
     */
    function createBounty(
        uint256 _projectId,
        uint256 _amount,
        uint256 _deadline,
        string calldata _descriptionIpfs
    ) external nonReentrant returns (uint256) {
        require(_amount >= minBountyAmount, "Below minimum");
        require(_deadline >= block.timestamp + minDeadline, "Deadline too soon");
        require(_deadline <= block.timestamp + maxDeadline, "Deadline too far");

        require(scoreToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        bountyCount++;
        uint256 bountyId = bountyCount;

        bounties[bountyId] = Bounty({
            projectId: _projectId,
            creator: msg.sender,
            totalFunding: _amount,
            remainingFunding: _amount,
            createdAt: block.timestamp,
            deadline: _deadline,
            description: _descriptionIpfs,
            status: BountyStatus.Active,
            submissionCount: 0
        });

        contributions[bountyId][msg.sender] = Contribution({
            amount: _amount,
            refunded: false
        });
        contributors[bountyId].push(msg.sender);

        emit BountyCreated(bountyId, _projectId, msg.sender, _amount, _deadline);

        return bountyId;
    }

    /**
     * @notice Add additional funding to a bounty
     */
    function fundBounty(uint256 _bountyId, uint256 _amount) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == BountyStatus.Active, "Bounty not active");
        require(block.timestamp < bounty.deadline, "Bounty expired");
        require(_amount > 0, "Amount must be > 0");

        require(scoreToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        bounty.totalFunding += _amount;
        bounty.remainingFunding += _amount;

        if (contributions[_bountyId][msg.sender].amount == 0) {
            contributors[_bountyId].push(msg.sender);
        }
        contributions[_bountyId][msg.sender].amount += _amount;

        emit BountyFunded(_bountyId, msg.sender, _amount);
    }

    // ============ Investigation Submissions ============

    /**
     * @notice Submit investigation evidence for a bounty
     * @param _bountyId Bounty to submit for
     * @param _evidenceIpfs IPFS hash with evidence/report
     * @param _requestedAmount Amount of bounty requested
     */
    function submitEvidence(
        uint256 _bountyId,
        string calldata _evidenceIpfs,
        uint256 _requestedAmount
    ) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == BountyStatus.Active, "Bounty not active");
        require(block.timestamp < bounty.deadline, "Bounty expired");
        require(_requestedAmount <= bounty.remainingFunding, "Exceeds remaining");
        require(bytes(_evidenceIpfs).length > 0, "Evidence required");

        // Check not already submitted
        for (uint256 i = 0; i < submissions[_bountyId].length; i++) {
            require(submissions[_bountyId][i].investigator != msg.sender, "Already submitted");
        }

        submissions[_bountyId].push(Submission({
            investigator: msg.sender,
            submittedAt: block.timestamp,
            evidenceIpfsHash: _evidenceIpfs,
            requestedAmount: _requestedAmount,
            approved: false,
            rejected: false,
            paidAmount: 0
        }));

        bounty.submissionCount++;
        bounty.status = BountyStatus.UnderReview;

        emit SubmissionAdded(_bountyId, submissions[_bountyId].length - 1, msg.sender);
    }

    /**
     * @notice Approve a submission and pay the investigator
     * @param _bountyId Bounty ID
     * @param _submissionIndex Index of submission to approve
     * @param _payAmount Amount to pay (can be less than requested)
     */
    function approveSubmission(
        uint256 _bountyId,
        uint256 _submissionIndex,
        uint256 _payAmount
    ) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(msg.sender == bounty.creator || msg.sender == owner(), "Not authorized");
        require(bounty.status == BountyStatus.UnderReview || bounty.status == BountyStatus.Active, "Invalid status");
        require(_submissionIndex < submissions[_bountyId].length, "Invalid submission");

        Submission storage sub = submissions[_bountyId][_submissionIndex];
        require(!sub.approved && !sub.rejected, "Already processed");
        require(_payAmount <= bounty.remainingFunding, "Exceeds remaining");

        sub.approved = true;
        sub.paidAmount = _payAmount;
        bounty.remainingFunding -= _payAmount;

        // Calculate fee
        uint256 fee = (_payAmount * platformFeeBps) / 10000;
        uint256 payout = _payAmount - fee;

        // Send fee to treasury
        if (fee > 0) {
            require(scoreToken.transfer(treasury, fee), "Fee transfer failed");
        }

        // Pay investigator
        require(scoreToken.transfer(sub.investigator, payout), "Transfer failed");

        // Update investigator stats
        investigatorEarnings[sub.investigator] += payout;
        investigatorCompletedBounties[sub.investigator]++;

        emit SubmissionApproved(_bountyId, _submissionIndex, payout);

        // Check if bounty is complete
        if (bounty.remainingFunding == 0) {
            bounty.status = BountyStatus.Completed;
            emit BountyCompleted(_bountyId);
        }
    }

    /**
     * @notice Reject a submission
     */
    function rejectSubmission(uint256 _bountyId, uint256 _submissionIndex) external {
        Bounty storage bounty = bounties[_bountyId];
        require(msg.sender == bounty.creator || msg.sender == owner(), "Not authorized");

        Submission storage sub = submissions[_bountyId][_submissionIndex];
        require(!sub.approved && !sub.rejected, "Already processed");

        sub.rejected = true;

        emit SubmissionRejected(_bountyId, _submissionIndex);

        // Check if all submissions rejected, revert to Active
        bool allRejected = true;
        for (uint256 i = 0; i < submissions[_bountyId].length; i++) {
            if (!submissions[_bountyId][i].rejected && !submissions[_bountyId][i].approved) {
                allRejected = false;
                break;
            }
        }
        if (allRejected && bounty.remainingFunding > 0) {
            bounty.status = BountyStatus.Active;
        }
    }

    /**
     * @notice Mark expired bounties and enable refunds
     */
    function markExpired(uint256 _bountyId) external {
        Bounty storage bounty = bounties[_bountyId];
        require(block.timestamp >= bounty.deadline, "Not expired");
        require(bounty.status == BountyStatus.Active || bounty.status == BountyStatus.UnderReview, "Invalid status");
        require(bounty.remainingFunding > 0, "No funds to refund");

        bounty.status = BountyStatus.Expired;
        emit BountyExpired(_bountyId);
    }

    /**
     * @notice Cancel bounty (creator only, before any approvals)
     */
    function cancelBounty(uint256 _bountyId) external {
        Bounty storage bounty = bounties[_bountyId];
        require(msg.sender == bounty.creator, "Not creator");
        require(bounty.status == BountyStatus.Active, "Cannot cancel");
        require(bounty.remainingFunding == bounty.totalFunding, "Funds already paid");

        bounty.status = BountyStatus.Cancelled;
        emit BountyCancelled(_bountyId);
    }

    /**
     * @notice Claim refund from expired or cancelled bounty
     */
    function claimRefund(uint256 _bountyId) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.status == BountyStatus.Expired || bounty.status == BountyStatus.Cancelled, "Not refundable");

        Contribution storage contrib = contributions[_bountyId][msg.sender];
        require(contrib.amount > 0, "No contribution");
        require(!contrib.refunded, "Already refunded");

        // Calculate proportional refund
        uint256 refundAmount = (contrib.amount * bounty.remainingFunding) / bounty.totalFunding;
        contrib.refunded = true;

        require(scoreToken.transfer(msg.sender, refundAmount), "Transfer failed");

        emit RefundClaimed(_bountyId, msg.sender, refundAmount);
    }

    // ============ View Functions ============

    function getBounty(uint256 _bountyId) external view returns (Bounty memory) {
        return bounties[_bountyId];
    }

    function getSubmissions(uint256 _bountyId) external view returns (Submission[] memory) {
        return submissions[_bountyId];
    }

    function getContribution(uint256 _bountyId, address _contributor) external view returns (Contribution memory) {
        return contributions[_bountyId][_contributor];
    }

    function getContributors(uint256 _bountyId) external view returns (address[] memory) {
        return contributors[_bountyId];
    }

    function getInvestigatorStats(address _investigator) external view returns (uint256 earnings, uint256 completed) {
        return (investigatorEarnings[_investigator], investigatorCompletedBounties[_investigator]);
    }

    function getActiveBounties(uint256 _offset, uint256 _limit) external view returns (Bounty[] memory) {
        uint256 count = 0;

        for (uint256 i = 1; i <= bountyCount; i++) {
            if (bounties[i].status == BountyStatus.Active || bounties[i].status == BountyStatus.UnderReview) {
                count++;
            }
        }

        if (_offset >= count) return new Bounty[](0);

        uint256 resultCount = _limit;
        if (_offset + _limit > count) resultCount = count - _offset;

        Bounty[] memory result = new Bounty[](resultCount);
        uint256 found = 0;
        uint256 added = 0;

        for (uint256 i = 1; i <= bountyCount && added < resultCount; i++) {
            if (bounties[i].status == BountyStatus.Active || bounties[i].status == BountyStatus.UnderReview) {
                if (found >= _offset) {
                    result[added] = bounties[i];
                    added++;
                }
                found++;
            }
        }

        return result;
    }

    // ============ Admin Functions ============

    function setConfig(
        uint256 _minAmount,
        uint256 _feeBps,
        uint256 _minDeadline,
        uint256 _maxDeadline
    ) external onlyOwner {
        require(_feeBps <= 1000, "Max 10% fee");
        minBountyAmount = _minAmount;
        platformFeeBps = _feeBps;
        minDeadline = _minDeadline;
        maxDeadline = _maxDeadline;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }
}
