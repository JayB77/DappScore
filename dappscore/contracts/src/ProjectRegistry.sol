// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProjectRegistry
 * @notice Registry for ICO/crypto project listings
 * @dev UUPS upgradeable proxy pattern via OpenZeppelin Initializable + UUPSUpgradeable.
 *      Deploy via ERC1967Proxy pointing at this implementation.
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE  — upgrade authority, full admin
 *   OPERATOR_ROLE       — can verify/suspend/blacklist projects, update fees
 *   VOTING_ENGINE_ROLE  — can call setTrustLevel (granted to VotingEngine)
 *
 * Bug fixes vs v1:
 *   - Date validation is now optional (allows non-sale projects with 0 dates).
 *   - votingEngine address replaced by VOTING_ENGINE_ROLE for cleaner access control.
 *   - Ownable replaced with AccessControl (proxy-compatible, role-based).
 */
contract ProjectRegistry is Initializable, UUPSUpgradeable, AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE       = keccak256("OPERATOR_ROLE");
    bytes32 public constant VOTING_ENGINE_ROLE  = keccak256("VOTING_ENGINE_ROLE");

    enum ProjectStatus {
        Pending,     // Awaiting review
        Active,      // Listed and active
        Flagged,     // Flagged by community
        Suspended,   // Suspended by admin
        Blacklisted  // Confirmed scam
    }

    enum TrustLevel {
        NewListing,    // Just listed, insufficient data
        Trusted,       // Positive community sentiment
        Neutral,       // Mixed reviews
        Suspicious,    // Negative sentiment
        SuspectedScam, // High negative votes
        ProbableScam   // Confirmed by multiple signals
    }

    struct Project {
        uint256 id;
        address owner;
        string name;
        string symbol;
        string metadataIpfsHash; // All metadata stored on IPFS (description, urls, logo, etc.)
        string category;
        string chain;
        uint256 totalSupply;
        uint256 hardCap;
        uint256 startDate;       // Unix timestamp; 0 if not a sale project
        uint256 endDate;         // Unix timestamp; 0 if not a sale project
        ProjectStatus status;
        TrustLevel trustLevel;
        uint256 createdAt;
        uint256 updatedAt;
        bool verified;
    }

    struct ProjectInput {
        string name;
        string symbol;
        string metadataIpfsHash;
        string category;
        string chain;
        uint256 totalSupply;
        uint256 hardCap;
        uint256 startDate; // 0 for non-sale projects
        uint256 endDate;   // 0 for non-sale projects
    }

    // ============ State ============

    uint256 public projectCount;
    uint256 public listingFee;
    uint256 public verificationFee;

    mapping(uint256 => Project) public projects;
    mapping(address => uint256[]) public ownerProjects;
    mapping(string => bool) public nameExists;

    address public treasury;

    // Storage gap for future upgrade variables
    uint256[44] private __gap;

    // ============ Events ============

    event ProjectSubmitted(uint256 indexed projectId, address indexed owner, string name);
    event ProjectUpdated(uint256 indexed projectId);
    event ProjectStatusChanged(uint256 indexed projectId, ProjectStatus newStatus);
    event ProjectTrustLevelChanged(uint256 indexed projectId, TrustLevel newLevel);
    event ProjectVerified(uint256 indexed projectId);
    event ListingFeeUpdated(uint256 newFee);
    event VerificationFeeUpdated(uint256 newFee);
    event TreasuryUpdated(address indexed treasury);
    event VotingEngineSet(address indexed engine);

    // ============ Constructor / Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the proxy
     * @param _admin           Receives DEFAULT_ADMIN_ROLE
     * @param _treasury        Fee recipient address
     * @param _listingFee      ETH fee for submitting a project
     * @param _verificationFee ETH fee for verification request
     */
    function initialize(
        address _admin,
        address _treasury,
        uint256 _listingFee,
        uint256 _verificationFee
    ) external initializer {
        require(_admin    != address(0), "Zero admin");
        require(_treasury != address(0), "Zero treasury");
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE,      _admin);

        treasury        = _treasury;
        listingFee      = _listingFee;
        verificationFee = _verificationFee;
    }

    // ============ UUPS ============

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // ============ Project Submission ============

    /**
     * @notice Submit a new project listing
     * @param input Project details struct
     */
    function submitProject(ProjectInput calldata input) external payable nonReentrant {
        require(msg.value >= listingFee, "Insufficient listing fee");
        require(bytes(input.name).length > 0,   "Name required");
        require(bytes(input.symbol).length > 0, "Symbol required");
        require(!nameExists[input.name],         "Name already exists");

        // FIX: Date validation is now optional — only check when both dates are provided.
        //      Non-sale projects (e.g. DeFi protocols) legitimately submit with 0/0 dates.
        if (input.startDate != 0 || input.endDate != 0) {
            require(input.startDate < input.endDate, "Invalid dates");
        }

        projectCount++;
        uint256 projectId = projectCount;

        projects[projectId] = Project({
            id: projectId,
            owner: msg.sender,
            name: input.name,
            symbol: input.symbol,
            metadataIpfsHash: input.metadataIpfsHash,
            category: input.category,
            chain: input.chain,
            totalSupply: input.totalSupply,
            hardCap: input.hardCap,
            startDate: input.startDate,
            endDate: input.endDate,
            status: ProjectStatus.Active,
            trustLevel: TrustLevel.NewListing,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            verified: false
        });

        nameExists[input.name] = true;
        ownerProjects[msg.sender].push(projectId);

        if (msg.value > 0) {
            (bool sent,) = treasury.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }

        emit ProjectSubmitted(projectId, msg.sender, input.name);
    }

    /**
     * @notice Update project metadata (project owner only)
     */
    function updateProject(uint256 _projectId, string calldata _metadataIpfsHash) external {
        Project storage project = projects[_projectId];
        require(project.owner == msg.sender, "Not project owner");
        require(project.status == ProjectStatus.Active, "Project not active");

        project.metadataIpfsHash = _metadataIpfsHash;
        project.updatedAt = block.timestamp;

        emit ProjectUpdated(_projectId);
    }

    /**
     * @notice Request verification (pay fee)
     */
    function requestVerification(uint256 _projectId) external payable {
        require(msg.value >= verificationFee, "Insufficient verification fee");
        Project storage project = projects[_projectId];
        require(project.owner == msg.sender, "Not project owner");

        if (msg.value > 0) {
            (bool sent,) = treasury.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }
    }

    /**
     * @notice Mark project as verified (operator only)
     */
    function verifyProject(uint256 _projectId) external onlyRole(OPERATOR_ROLE) {
        Project storage project = projects[_projectId];
        require(project.id != 0, "Project not found");
        project.verified = true;
        emit ProjectVerified(_projectId);
    }

    /**
     * @notice Update project status (operator only)
     */
    function setProjectStatus(uint256 _projectId, ProjectStatus _status) external onlyRole(OPERATOR_ROLE) {
        Project storage project = projects[_projectId];
        require(project.id != 0, "Project not found");
        project.status = _status;
        project.updatedAt = block.timestamp;
        emit ProjectStatusChanged(_projectId, _status);
    }

    /**
     * @notice Update project trust level — callable by VOTING_ENGINE_ROLE or OPERATOR_ROLE
     */
    function setTrustLevel(uint256 _projectId, TrustLevel _level) external {
        require(
            hasRole(VOTING_ENGINE_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "Unauthorized"
        );
        Project storage project = projects[_projectId];
        require(project.id != 0, "Project not found");
        project.trustLevel = _level;
        project.updatedAt = block.timestamp;
        emit ProjectTrustLevelChanged(_projectId, _level);
    }

    // ============ Admin Functions ============

    /**
     * @notice Grant VOTING_ENGINE_ROLE to the VotingEngine contract
     */
    function setVotingEngine(address _engine) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_engine != address(0), "Invalid address");
        _grantRole(VOTING_ENGINE_ROLE, _engine);
        emit VotingEngineSet(_engine);
    }

    /**
     * @notice Revoke VOTING_ENGINE_ROLE from an old VotingEngine contract
     */
    function revokeVotingEngine(address _engine) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(VOTING_ENGINE_ROLE, _engine);
    }

    function setListingFee(uint256 _fee) external onlyRole(OPERATOR_ROLE) {
        listingFee = _fee;
        emit ListingFeeUpdated(_fee);
    }

    function setVerificationFee(uint256 _fee) external onlyRole(OPERATOR_ROLE) {
        verificationFee = _fee;
        emit VerificationFeeUpdated(_fee);
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    // ============ View Functions ============

    function getProject(uint256 _projectId) external view returns (Project memory) {
        return projects[_projectId];
    }

    function getOwnerProjects(address _owner) external view returns (uint256[] memory) {
        return ownerProjects[_owner];
    }

    function getProjectsBatch(uint256[] calldata _ids) external view returns (Project[] memory) {
        Project[] memory result = new Project[](_ids.length);
        for (uint256 i = 0; i < _ids.length; i++) {
            result[i] = projects[_ids[i]];
        }
        return result;
    }
}
