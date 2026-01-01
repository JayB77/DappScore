// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProjectRegistry
 * @notice Registry for ICO/crypto project listings
 * @dev Stores project metadata on-chain with IPFS links for extended data
 */
contract ProjectRegistry is Ownable, ReentrancyGuard {

    enum ProjectStatus {
        Pending,        // Awaiting review
        Active,         // Listed and active
        Flagged,        // Flagged by community
        Suspended,      // Suspended by admin
        Blacklisted     // Confirmed scam
    }

    enum TrustLevel {
        NewListing,     // Just listed, insufficient data
        Trusted,        // Positive community sentiment
        Neutral,        // Mixed reviews
        Suspicious,     // Negative sentiment
        SuspectedScam,  // High negative votes
        ProbableScam    // Confirmed by multiple signals
    }

    struct Project {
        uint256 id;
        address owner;
        string name;
        string symbol;
        string metadataIpfsHash;    // All metadata stored on IPFS (description, urls, logo, etc.)
        string category;
        string chain;
        uint256 totalSupply;
        uint256 hardCap;
        uint256 startDate;
        uint256 endDate;
        ProjectStatus status;
        TrustLevel trustLevel;
        uint256 createdAt;
        uint256 updatedAt;
        bool verified;
    }

    // Input struct to avoid stack too deep
    struct ProjectInput {
        string name;
        string symbol;
        string metadataIpfsHash;
        string category;
        string chain;
        uint256 totalSupply;
        uint256 hardCap;
        uint256 startDate;
        uint256 endDate;
    }

    // State
    uint256 public projectCount;
    uint256 public listingFee;
    uint256 public verificationFee;

    mapping(uint256 => Project) public projects;
    mapping(address => uint256[]) public ownerProjects;
    mapping(string => bool) public nameExists;

    address public treasury;
    address public votingEngine;

    // Events
    event ProjectSubmitted(uint256 indexed projectId, address indexed owner, string name);
    event ProjectUpdated(uint256 indexed projectId);
    event ProjectStatusChanged(uint256 indexed projectId, ProjectStatus newStatus);
    event ProjectTrustLevelChanged(uint256 indexed projectId, TrustLevel newLevel);
    event ProjectVerified(uint256 indexed projectId);
    event ListingFeeUpdated(uint256 newFee);
    event VotingEngineSet(address indexed engine);

    constructor(
        address _initialOwner,
        address _treasury,
        uint256 _listingFee,
        uint256 _verificationFee
    ) Ownable(_initialOwner) {
        treasury = _treasury;
        listingFee = _listingFee;
        verificationFee = _verificationFee;
    }

    /**
     * @notice Submit a new project listing
     * @param input Project details struct
     */
    function submitProject(ProjectInput calldata input) external payable nonReentrant {
        require(msg.value >= listingFee, "Insufficient listing fee");
        require(bytes(input.name).length > 0, "Name required");
        require(bytes(input.symbol).length > 0, "Symbol required");
        require(!nameExists[input.name], "Name already exists");
        require(input.startDate < input.endDate, "Invalid dates");

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
            (bool sent, ) = treasury.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }

        emit ProjectSubmitted(projectId, msg.sender, input.name);
    }

    /**
     * @notice Update project metadata (owner only)
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
            (bool sent, ) = treasury.call{value: msg.value}("");
            require(sent, "Fee transfer failed");
        }
    }

    /**
     * @notice Mark project as verified (admin only)
     */
    function verifyProject(uint256 _projectId) external onlyOwner {
        Project storage project = projects[_projectId];
        require(project.id != 0, "Project not found");
        project.verified = true;
        emit ProjectVerified(_projectId);
    }

    /**
     * @notice Update project status (admin only)
     */
    function setProjectStatus(uint256 _projectId, ProjectStatus _status) external onlyOwner {
        Project storage project = projects[_projectId];
        require(project.id != 0, "Project not found");
        project.status = _status;
        project.updatedAt = block.timestamp;
        emit ProjectStatusChanged(_projectId, _status);
    }

    /**
     * @notice Update project trust level (called by VotingEngine)
     */
    function setTrustLevel(uint256 _projectId, TrustLevel _level) external {
        require(msg.sender == votingEngine || msg.sender == owner(), "Unauthorized");
        Project storage project = projects[_projectId];
        require(project.id != 0, "Project not found");
        project.trustLevel = _level;
        project.updatedAt = block.timestamp;
        emit ProjectTrustLevelChanged(_projectId, _level);
    }

    /**
     * @notice Set voting engine address
     */
    function setVotingEngine(address _engine) external onlyOwner {
        require(_engine != address(0), "Invalid address");
        votingEngine = _engine;
        emit VotingEngineSet(_engine);
    }

    function setListingFee(uint256 _fee) external onlyOwner {
        listingFee = _fee;
        emit ListingFeeUpdated(_fee);
    }

    function setVerificationFee(uint256 _fee) external onlyOwner {
        verificationFee = _fee;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
    }

    // View functions

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
