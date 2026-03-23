// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ScoreToken.sol";

/**
 * @title BountySystem
 * @notice Post and claim bounties for investigating suspicious projects
 * @dev UUPS upgradeable proxy pattern.
 *      Implements IScamListener — register with ProjectRegistry.addScamListener().
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE — upgrade authority, full admin
 *   OPERATOR_ROLE      — config, submission approval, scam signal sender
 *                        (grant to ProjectRegistry so it can call onProjectScamConfirmed)
 */
contract BountySystem is Initializable, UUPSUpgradeable, AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum BountyStatus {
        Active,       // Accepting submissions
        UnderReview,  // Has submissions being reviewed
        Completed,    // Bounty paid out
        Expired,      // Deadline passed, refunds available
        Cancelled     // Cancelled by creator
    }

    struct Bounty {
        uint256 projectId;
        address creator;
        uint256 totalFunding;
        uint256 remainingFunding;
        uint256 createdAt;
        uint256 deadline;
        string description;
        BountyStatus status;
        uint256 submissionCount;
    }

    struct Submission {
        address investigator;
        uint256 submittedAt;
        string evidenceIpfsHash;
        uint256 requestedAmount;
        bool approved;
        bool rejected;
        uint256 paidAmount;
    }

    struct Contribution {
        uint256 amount;
        bool refunded;
    }

    // ============ State ============

    ScoreToken public scoreToken;
    address public treasury;

    mapping(uint256 => Bounty)                           public bounties;
    mapping(uint256 => Submission[])                     public submissions;
    mapping(uint256 => mapping(address => Contribution)) public contributions;
    mapping(uint256 => address[])                        public contributors;
    uint256 public bountyCount;

    mapping(address => uint256) public investigatorEarnings;
    mapping(address => uint256) public investigatorCompletedBounties;

    uint256 public minBountyAmount;
    uint256 public platformFeeBps;
    uint256 public minDeadline;
    uint256 public maxDeadline;

    /// @dev projectId => confirmed scam flag — set by onProjectScamConfirmed.
    ///      Bounties on confirmed-scam projects auto-approve any pending submissions.
    mapping(uint256 => bool) public projectConfirmedScam;

    // Storage gap for future upgrade variables
    uint256[44] private __gap;

    // ============ Events ============

    event BountyCreated(uint256 indexed bountyId, uint256 indexed projectId, address creator, uint256 amount, uint256 deadline);
    event BountyFunded(uint256 indexed bountyId, address funder, uint256 amount);
    event SubmissionAdded(uint256 indexed bountyId, uint256 submissionIndex, address investigator);
    event SubmissionApproved(uint256 indexed bountyId, uint256 submissionIndex, uint256 paidAmount);
    event SubmissionRejected(uint256 indexed bountyId, uint256 submissionIndex);
    event BountyCompleted(uint256 indexed bountyId);
    event BountyCancelled(uint256 indexed bountyId);
    event BountyExpired(uint256 indexed bountyId);
    event RefundClaimed(uint256 indexed bountyId, address contributor, uint256 amount);
    event ProjectScamConfirmed(uint256 indexed projectId);

    // ============ Constructor / Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _scoreToken,
        address _treasury
    ) external initializer {
        require(_admin      != address(0), "Zero admin");
        require(_scoreToken != address(0), "Zero token");
        require(_treasury   != address(0), "Zero treasury");

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE,      _admin);

        scoreToken = ScoreToken(_scoreToken);
        treasury   = _treasury;

        minBountyAmount = 100 * 10 ** 18; // 100 SCORE
        platformFeeBps  = 500;            // 5%
        minDeadline     = 3 days;
        maxDeadline     = 90 days;
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ============ IScamListener ============

    /**
     * @notice Called by ProjectRegistry when a project reaches ProbableScam trust level.
     *         Marks the project so any investigator can immediately claim the bounty
     *         by submitting evidence — submissions auto-approve on confirmed scam projects.
     *         Caller must hold OPERATOR_ROLE (grant to ProjectRegistry address).
     */
    function onProjectScamConfirmed(uint256 projectId) external onlyRole(OPERATOR_ROLE) {
        if (projectConfirmedScam[projectId]) return; // idempotent
        projectConfirmedScam[projectId] = true;
        emit ProjectScamConfirmed(projectId);
    }

    // ============ Bounty Creation ============

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
            projectId:        _projectId,
            creator:          msg.sender,
            totalFunding:     _amount,
            remainingFunding: _amount,
            createdAt:        block.timestamp,
            deadline:         _deadline,
            description:      _descriptionIpfs,
            status:           BountyStatus.Active,
            submissionCount:  0
        });

        contributions[bountyId][msg.sender] = Contribution({amount: _amount, refunded: false});
        contributors[bountyId].push(msg.sender);

        emit BountyCreated(bountyId, _projectId, msg.sender, _amount, _deadline);

        return bountyId;
    }

    function fundBounty(uint256 _bountyId, uint256 _amount) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == BountyStatus.Active, "Bounty not active");
        require(block.timestamp < bounty.deadline, "Bounty expired");
        require(_amount > 0, "Amount must be > 0");

        require(scoreToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        bounty.totalFunding     += _amount;
        bounty.remainingFunding += _amount;

        if (contributions[_bountyId][msg.sender].amount == 0) {
            contributors[_bountyId].push(msg.sender);
        }
        contributions[_bountyId][msg.sender].amount += _amount;

        emit BountyFunded(_bountyId, msg.sender, _amount);
    }

    // ============ Investigation Submissions ============

    /**
     * @notice Submit investigation evidence.
     *         If the project is a confirmed scam, the submission is auto-approved and paid.
     */
    function submitEvidence(
        uint256 _bountyId,
        string calldata _evidenceIpfs,
        uint256 _requestedAmount
    ) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == BountyStatus.Active || bounty.status == BountyStatus.UnderReview,
                "Bounty not accepting submissions");
        require(block.timestamp < bounty.deadline, "Bounty expired");
        require(_requestedAmount <= bounty.remainingFunding, "Exceeds remaining");
        require(bytes(_evidenceIpfs).length > 0, "Evidence required");

        for (uint256 i = 0; i < submissions[_bountyId].length; i++) {
            require(submissions[_bountyId][i].investigator != msg.sender, "Already submitted");
        }

        uint256 submissionIndex = submissions[_bountyId].length;

        submissions[_bountyId].push(Submission({
            investigator:     msg.sender,
            submittedAt:      block.timestamp,
            evidenceIpfsHash: _evidenceIpfs,
            requestedAmount:  _requestedAmount,
            approved:         false,
            rejected:         false,
            paidAmount:       0
        }));

        bounty.submissionCount++;

        if (!projectConfirmedScam[bounty.projectId]) {
            bounty.status = BountyStatus.UnderReview;
        }

        emit SubmissionAdded(_bountyId, submissionIndex, msg.sender);

        // Auto-approve on confirmed scam projects
        if (projectConfirmedScam[bounty.projectId]) {
            _approveSubmission(_bountyId, submissionIndex, _requestedAmount);
        }
    }

    /**
     * @notice Approve a submission and pay the investigator.
     *         Callable by bounty creator or OPERATOR_ROLE.
     */
    function approveSubmission(
        uint256 _bountyId,
        uint256 _submissionIndex,
        uint256 _payAmount
    ) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(
            msg.sender == bounty.creator || hasRole(OPERATOR_ROLE, msg.sender),
            "Not authorized"
        );
        require(
            bounty.status == BountyStatus.UnderReview || bounty.status == BountyStatus.Active,
            "Invalid status"
        );

        _approveSubmission(_bountyId, _submissionIndex, _payAmount);
    }

    function rejectSubmission(uint256 _bountyId, uint256 _submissionIndex) external {
        Bounty storage bounty = bounties[_bountyId];
        require(
            msg.sender == bounty.creator || hasRole(OPERATOR_ROLE, msg.sender),
            "Not authorized"
        );

        Submission storage sub = submissions[_bountyId][_submissionIndex];
        require(!sub.approved && !sub.rejected, "Already processed");

        sub.rejected = true;

        emit SubmissionRejected(_bountyId, _submissionIndex);

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

    function markExpired(uint256 _bountyId) external {
        Bounty storage bounty = bounties[_bountyId];
        require(block.timestamp >= bounty.deadline, "Not expired");
        require(
            bounty.status == BountyStatus.Active || bounty.status == BountyStatus.UnderReview,
            "Invalid status"
        );
        require(bounty.remainingFunding > 0, "No funds to refund");

        bounty.status = BountyStatus.Expired;
        emit BountyExpired(_bountyId);
    }

    function cancelBounty(uint256 _bountyId) external {
        Bounty storage bounty = bounties[_bountyId];
        require(msg.sender == bounty.creator, "Not creator");
        require(bounty.status == BountyStatus.Active, "Cannot cancel");
        require(bounty.remainingFunding == bounty.totalFunding, "Funds already paid");

        bounty.status = BountyStatus.Cancelled;
        emit BountyCancelled(_bountyId);
    }

    function claimRefund(uint256 _bountyId) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];
        require(
            bounty.status == BountyStatus.Expired || bounty.status == BountyStatus.Cancelled,
            "Not refundable"
        );

        Contribution storage contrib = contributions[_bountyId][msg.sender];
        require(contrib.amount > 0,  "No contribution");
        require(!contrib.refunded,   "Already refunded");

        uint256 refundAmount = (contrib.amount * bounty.remainingFunding) / bounty.totalFunding;
        contrib.refunded = true;

        require(scoreToken.transfer(msg.sender, refundAmount), "Transfer failed");

        emit RefundClaimed(_bountyId, msg.sender, refundAmount);
    }

    // ============ Internal ============

    function _approveSubmission(
        uint256 _bountyId,
        uint256 _submissionIndex,
        uint256 _payAmount
    ) internal {
        Bounty storage bounty = bounties[_bountyId];
        require(_submissionIndex < submissions[_bountyId].length, "Invalid submission");

        Submission storage sub = submissions[_bountyId][_submissionIndex];
        require(!sub.approved && !sub.rejected, "Already processed");
        require(_payAmount <= bounty.remainingFunding, "Exceeds remaining");

        sub.approved   = true;
        sub.paidAmount = _payAmount;
        bounty.remainingFunding -= _payAmount;

        uint256 fee    = (_payAmount * platformFeeBps) / 10000;
        uint256 payout = _payAmount - fee;

        if (fee > 0) {
            require(scoreToken.transfer(treasury, fee), "Fee transfer failed");
        }
        require(scoreToken.transfer(sub.investigator, payout), "Transfer failed");

        investigatorEarnings[sub.investigator]           += payout;
        investigatorCompletedBounties[sub.investigator]  += 1;

        emit SubmissionApproved(_bountyId, _submissionIndex, payout);

        if (bounty.remainingFunding == 0) {
            bounty.status = BountyStatus.Completed;
            emit BountyCompleted(_bountyId);
        }
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

        uint256 resultCount = (_offset + _limit > count) ? count - _offset : _limit;

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
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeBps <= 1000, "Max 10% fee");
        minBountyAmount = _minAmount;
        platformFeeBps  = _feeBps;
        minDeadline     = _minDeadline;
        maxDeadline     = _maxDeadline;
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }
}
