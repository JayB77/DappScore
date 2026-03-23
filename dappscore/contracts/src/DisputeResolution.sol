// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ScoreToken.sol";

/**
 * @title DisputeResolution
 * @notice Allows community members to dispute a project's trust level assignment.
 *         A SCORE deposit is required to file a dispute; arbitrators vote to uphold
 *         or dismiss it. Upheld disputes reset the project trust level to Neutral and
 *         refund the filer; dismissed disputes send the deposit to treasury.
 *
 * @dev UUPS upgradeable proxy pattern.
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE  — upgrade authority, config, treasury address, add arbitrators
 *   ARBITRATOR_ROLE     — can cast votes on open disputes
 *
 * Integration:
 *   - Requires DISPUTE_ROLE on ProjectRegistry to call setTrustLevel.
 *   - ProjectRegistry address set at initialisation and can be updated by admin.
 */

interface IProjectRegistryDispute {
    enum TrustLevel {
        NewListing,
        Trusted,
        Neutral,
        Suspicious,
        SuspectedScam,
        ProbableScam
    }
    function setTrustLevel(uint256 projectId, TrustLevel level) external;
    function projectExists(uint256 projectId) external view returns (bool);
}

contract DisputeResolution is Initializable, UUPSUpgradeable, AccessControl, ReentrancyGuard {
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    // ─── Config ───────────────────────────────────────────────────────────────

    ScoreToken public scoreToken;
    IProjectRegistryDispute public projectRegistry;

    uint256 public depositAmount;    // SCORE tokens required to file (default 500e18)
    uint256 public votingPeriod;     // Seconds arbitrators have to vote (default 3 days)
    uint256 public disputeWindow;    // Seconds after trust level change to file (default 7 days)
    uint256 public minVotesRequired; // Minimum arbitrator votes needed to resolve (default 3)

    address public treasury;         // Receives forfeited deposits

    // ─── Data structures ──────────────────────────────────────────────────────

    enum DisputeStatus { Open, Upheld, Dismissed, Cancelled }

    struct Dispute {
        uint256 projectId;
        address filer;
        string reasonIpfsHash;   // IPFS CID of the dispute brief
        uint256 filedAt;
        uint256 votingDeadline;
        uint256 upholdVotes;
        uint256 dismissVotes;
        DisputeStatus status;
    }

    uint256 public nextDisputeId;

    mapping(uint256 => Dispute) public disputes;

    /// @dev projectId => active disputeId (0 = none). Only one open dispute per project.
    mapping(uint256 => uint256) public activeDisputeForProject;

    /// @dev disputeId => arbitrator address => has voted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ─── Events ───────────────────────────────────────────────────────────────

    event DisputeFiled(
        uint256 indexed disputeId,
        uint256 indexed projectId,
        address indexed filer,
        string reasonIpfsHash,
        uint256 votingDeadline
    );

    event VoteCast(
        uint256 indexed disputeId,
        address indexed arbitrator,
        bool uphold
    );

    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 indexed projectId,
        DisputeStatus outcome
    );

    event DisputeCancelled(
        uint256 indexed disputeId,
        address indexed cancelledBy
    );

    event ConfigUpdated(
        uint256 depositAmount,
        uint256 votingPeriod,
        uint256 disputeWindow,
        uint256 minVotesRequired
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ProjectNotFound(uint256 projectId);
    error ActiveDisputeExists(uint256 projectId, uint256 existingDisputeId);
    error DisputeWindowExpired(uint256 projectId);
    error DisputeNotOpen(uint256 disputeId);
    error VotingPeriodExpired(uint256 disputeId);
    error VotingPeriodActive(uint256 disputeId);
    error AlreadyVoted(uint256 disputeId, address voter);
    error InsufficientVotes(uint256 required, uint256 actual);
    error NotDisputeFiler(uint256 disputeId);
    error ZeroAddress();

    // ─── Initialiser ──────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        address _scoreToken,
        address _projectRegistry,
        address _treasury
    ) external initializer {
        if (_admin == address(0) || _scoreToken == address(0) ||
            _projectRegistry == address(0) || _treasury == address(0))
            revert ZeroAddress();

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        scoreToken = ScoreToken(_scoreToken);
        projectRegistry = IProjectRegistryDispute(_projectRegistry);
        treasury = _treasury;

        depositAmount    = 500e18;
        votingPeriod     = 3 days;
        disputeWindow    = 7 days;
        minVotesRequired = 3;

        nextDisputeId = 1; // 0 reserved as "no dispute"
    }

    // ─── Filing ───────────────────────────────────────────────────────────────

    /**
     * @notice File a dispute against a project's current trust level.
     * @param projectId       Registry project ID.
     * @param reasonIpfsHash  IPFS CID pointing to the dispute evidence/brief.
     */
    function fileDispute(
        uint256 projectId,
        string calldata reasonIpfsHash
    ) external nonReentrant {
        // Verify project exists (reverts if not found)
        _requireProjectExists(projectId);

        // Only one active dispute per project
        uint256 existingId = activeDisputeForProject[projectId];
        if (existingId != 0 && disputes[existingId].status == DisputeStatus.Open) {
            revert ActiveDisputeExists(projectId, existingId);
        }

        // Pull deposit from filer
        scoreToken.transferFrom(msg.sender, address(this), depositAmount);

        uint256 disputeId = nextDisputeId++;
        uint256 deadline  = block.timestamp + votingPeriod;

        disputes[disputeId] = Dispute({
            projectId:       projectId,
            filer:           msg.sender,
            reasonIpfsHash:  reasonIpfsHash,
            filedAt:         block.timestamp,
            votingDeadline:  deadline,
            upholdVotes:     0,
            dismissVotes:    0,
            status:          DisputeStatus.Open
        });

        activeDisputeForProject[projectId] = disputeId;

        emit DisputeFiled(disputeId, projectId, msg.sender, reasonIpfsHash, deadline);
    }

    // ─── Voting ───────────────────────────────────────────────────────────────

    /**
     * @notice Arbitrator casts a vote on an open dispute.
     * @param disputeId  The dispute to vote on.
     * @param uphold     True = uphold the dispute; false = dismiss it.
     */
    function voteOnDispute(uint256 disputeId, bool uphold)
        external
        onlyRole(ARBITRATOR_ROLE)
        nonReentrant
    {
        Dispute storage d = disputes[disputeId];

        if (d.status != DisputeStatus.Open) revert DisputeNotOpen(disputeId);
        if (block.timestamp > d.votingDeadline) revert VotingPeriodExpired(disputeId);
        if (hasVoted[disputeId][msg.sender]) revert AlreadyVoted(disputeId, msg.sender);

        hasVoted[disputeId][msg.sender] = true;

        if (uphold) {
            d.upholdVotes++;
        } else {
            d.dismissVotes++;
        }

        emit VoteCast(disputeId, msg.sender, uphold);
    }

    // ─── Resolution ───────────────────────────────────────────────────────────

    /**
     * @notice Resolve a dispute after the voting period ends.
     *         Anyone may call this once the voting deadline has passed.
     *
     *         Outcome logic:
     *           - If upholdVotes > dismissVotes AND total >= minVotesRequired → Upheld
     *               → Trust level reset to Neutral; deposit refunded to filer.
     *           - Otherwise → Dismissed
     *               → Deposit sent to treasury.
     *
     * @param disputeId  The dispute to resolve.
     */
    function resolveDispute(uint256 disputeId) external nonReentrant {
        Dispute storage d = disputes[disputeId];

        if (d.status != DisputeStatus.Open) revert DisputeNotOpen(disputeId);
        if (block.timestamp <= d.votingDeadline) revert VotingPeriodActive(disputeId);

        uint256 totalVotes = d.upholdVotes + d.dismissVotes;
        bool quorumMet     = totalVotes >= minVotesRequired;
        bool majorityUphold = d.upholdVotes > d.dismissVotes;

        DisputeStatus outcome;

        if (quorumMet && majorityUphold) {
            outcome = DisputeStatus.Upheld;
            d.status = outcome;

            // Reset project trust level to Neutral
            projectRegistry.setTrustLevel(
                d.projectId,
                IProjectRegistryDispute.TrustLevel.Neutral
            );

            // Refund deposit to filer
            scoreToken.transfer(d.filer, depositAmount);
        } else {
            outcome = DisputeStatus.Dismissed;
            d.status = outcome;

            // Forfeit deposit to treasury
            scoreToken.transfer(treasury, depositAmount);
        }

        activeDisputeForProject[d.projectId] = 0;

        emit DisputeResolved(disputeId, d.projectId, outcome);
    }

    /**
     * @notice Filer may cancel their own dispute before the voting period ends.
     *         The deposit is forfeited (sent to treasury) as an anti-spam measure.
     * @param disputeId  The dispute to cancel.
     */
    function cancelDispute(uint256 disputeId) external nonReentrant {
        Dispute storage d = disputes[disputeId];

        if (d.status != DisputeStatus.Open) revert DisputeNotOpen(disputeId);
        if (d.filer != msg.sender) revert NotDisputeFiler(disputeId);

        d.status = DisputeStatus.Cancelled;
        activeDisputeForProject[d.projectId] = 0;

        // Forfeit deposit to treasury
        scoreToken.transfer(treasury, depositAmount);

        emit DisputeCancelled(disputeId, msg.sender);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setConfig(
        uint256 _depositAmount,
        uint256 _votingPeriod,
        uint256 _disputeWindow,
        uint256 _minVotesRequired
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_depositAmount > 0, "deposit must be > 0");
        require(_votingPeriod >= 1 days, "voting period too short");
        require(_disputeWindow >= 1 days, "dispute window too short");
        require(_minVotesRequired >= 1, "min votes must be >= 1");

        depositAmount    = _depositAmount;
        votingPeriod     = _votingPeriod;
        disputeWindow    = _disputeWindow;
        minVotesRequired = _minVotesRequired;

        emit ConfigUpdated(_depositAmount, _votingPeriod, _disputeWindow, _minVotesRequired);
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    function setProjectRegistry(address _registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_registry == address(0)) revert ZeroAddress();
        projectRegistry = IProjectRegistryDispute(_registry);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return disputes[disputeId];
    }

    function getActiveDispute(uint256 projectId) external view returns (Dispute memory) {
        uint256 id = activeDisputeForProject[projectId];
        require(id != 0, "no active dispute");
        return disputes[id];
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /**
     * @dev Verify project exists via the registry's projectExists helper.
     */
    function _requireProjectExists(uint256 projectId) internal view {
        if (!projectRegistry.projectExists(projectId)) revert ProjectNotFound(projectId);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    // ─── Storage gap ──────────────────────────────────────────────────────────

    uint256[44] private __gap;
}
