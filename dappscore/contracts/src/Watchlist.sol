// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Watchlist
 * @notice On-chain watchlists for tracking projects
 * @dev Users can create watchlists, add/remove projects, and share lists
 *
 * Features:
 * - Personal watchlists
 * - Public/private lists
 * - Follow other users' public lists
 * - Alert preferences stored on-chain
 * - List sharing and collaboration
 */
contract Watchlist is Ownable {

    struct WatchlistInfo {
        address owner;
        string name;
        string description;
        bool isPublic;
        uint256 createdAt;
        uint256 followerCount;
    }

    struct AlertPreferences {
        bool onTrustChange;      // Alert when trust level changes
        bool onNewVotes;         // Alert on significant vote changes
        bool onPremiumExpiry;    // Alert when premium expires
        bool onScamFlag;         // Alert if flagged as scam
        uint256 voteThreshold;   // Min votes to trigger alert (default 10)
    }

    // State
    mapping(uint256 => WatchlistInfo) public watchlists;
    mapping(uint256 => uint256[]) public watchlistProjects;     // listId => projectIds
    mapping(uint256 => mapping(uint256 => bool)) public inWatchlist; // listId => projectId => exists
    mapping(uint256 => mapping(uint256 => AlertPreferences)) public projectAlerts; // listId => projectId => prefs
    mapping(address => uint256[]) public userWatchlists;        // owner => listIds
    mapping(uint256 => address[]) public watchlistFollowers;    // listId => followers
    mapping(address => mapping(uint256 => bool)) public isFollowing; // user => listId => following

    uint256 public watchlistCount;

    // Configuration
    uint256 public maxListsPerUser = 10;
    uint256 public maxProjectsPerList = 100;

    // Events
    event WatchlistCreated(uint256 indexed listId, address indexed owner, string name, bool isPublic);
    event WatchlistUpdated(uint256 indexed listId, string name, bool isPublic);
    event WatchlistDeleted(uint256 indexed listId);
    event ProjectAdded(uint256 indexed listId, uint256 indexed projectId);
    event ProjectRemoved(uint256 indexed listId, uint256 indexed projectId);
    event AlertsUpdated(uint256 indexed listId, uint256 indexed projectId);
    event WatchlistFollowed(uint256 indexed listId, address indexed follower);
    event WatchlistUnfollowed(uint256 indexed listId, address indexed follower);

    constructor(address _initialOwner) Ownable(_initialOwner) {}

    // ============ Watchlist Management ============

    /**
     * @notice Create a new watchlist
     */
    function createWatchlist(
        string calldata _name,
        string calldata _description,
        bool _isPublic
    ) external returns (uint256) {
        require(userWatchlists[msg.sender].length < maxListsPerUser, "Max lists reached");
        require(bytes(_name).length > 0 && bytes(_name).length <= 50, "Invalid name length");

        watchlistCount++;
        uint256 listId = watchlistCount;

        watchlists[listId] = WatchlistInfo({
            owner: msg.sender,
            name: _name,
            description: _description,
            isPublic: _isPublic,
            createdAt: block.timestamp,
            followerCount: 0
        });

        userWatchlists[msg.sender].push(listId);

        emit WatchlistCreated(listId, msg.sender, _name, _isPublic);

        return listId;
    }

    /**
     * @notice Update watchlist info
     */
    function updateWatchlist(
        uint256 _listId,
        string calldata _name,
        string calldata _description,
        bool _isPublic
    ) external {
        require(watchlists[_listId].owner == msg.sender, "Not owner");
        require(bytes(_name).length > 0 && bytes(_name).length <= 50, "Invalid name length");

        WatchlistInfo storage list = watchlists[_listId];
        list.name = _name;
        list.description = _description;
        list.isPublic = _isPublic;

        emit WatchlistUpdated(_listId, _name, _isPublic);
    }

    /**
     * @notice Delete a watchlist
     */
    function deleteWatchlist(uint256 _listId) external {
        require(watchlists[_listId].owner == msg.sender, "Not owner");

        delete watchlists[_listId];
        delete watchlistProjects[_listId];

        // Remove from user's list (swap and pop)
        uint256[] storage userLists = userWatchlists[msg.sender];
        for (uint256 i = 0; i < userLists.length; i++) {
            if (userLists[i] == _listId) {
                userLists[i] = userLists[userLists.length - 1];
                userLists.pop();
                break;
            }
        }

        emit WatchlistDeleted(_listId);
    }

    // ============ Project Management ============

    /**
     * @notice Add a project to watchlist
     */
    function addProject(uint256 _listId, uint256 _projectId) external {
        require(watchlists[_listId].owner == msg.sender, "Not owner");
        require(!inWatchlist[_listId][_projectId], "Already in list");
        require(watchlistProjects[_listId].length < maxProjectsPerList, "List full");

        watchlistProjects[_listId].push(_projectId);
        inWatchlist[_listId][_projectId] = true;

        // Set default alert preferences
        projectAlerts[_listId][_projectId] = AlertPreferences({
            onTrustChange: true,
            onNewVotes: false,
            onPremiumExpiry: false,
            onScamFlag: true,
            voteThreshold: 10
        });

        emit ProjectAdded(_listId, _projectId);
    }

    /**
     * @notice Add multiple projects at once
     */
    function addProjects(uint256 _listId, uint256[] calldata _projectIds) external {
        require(watchlists[_listId].owner == msg.sender, "Not owner");
        require(watchlistProjects[_listId].length + _projectIds.length <= maxProjectsPerList, "Would exceed max");

        for (uint256 i = 0; i < _projectIds.length; i++) {
            uint256 projectId = _projectIds[i];
            if (!inWatchlist[_listId][projectId]) {
                watchlistProjects[_listId].push(projectId);
                inWatchlist[_listId][projectId] = true;

                projectAlerts[_listId][projectId] = AlertPreferences({
                    onTrustChange: true,
                    onNewVotes: false,
                    onPremiumExpiry: false,
                    onScamFlag: true,
                    voteThreshold: 10
                });

                emit ProjectAdded(_listId, projectId);
            }
        }
    }

    /**
     * @notice Remove a project from watchlist
     */
    function removeProject(uint256 _listId, uint256 _projectId) external {
        require(watchlists[_listId].owner == msg.sender, "Not owner");
        require(inWatchlist[_listId][_projectId], "Not in list");

        inWatchlist[_listId][_projectId] = false;
        delete projectAlerts[_listId][_projectId];

        // Remove from array (swap and pop)
        uint256[] storage projects = watchlistProjects[_listId];
        for (uint256 i = 0; i < projects.length; i++) {
            if (projects[i] == _projectId) {
                projects[i] = projects[projects.length - 1];
                projects.pop();
                break;
            }
        }

        emit ProjectRemoved(_listId, _projectId);
    }

    /**
     * @notice Set alert preferences for a project in watchlist
     */
    function setAlertPreferences(
        uint256 _listId,
        uint256 _projectId,
        bool _onTrustChange,
        bool _onNewVotes,
        bool _onPremiumExpiry,
        bool _onScamFlag,
        uint256 _voteThreshold
    ) external {
        require(watchlists[_listId].owner == msg.sender, "Not owner");
        require(inWatchlist[_listId][_projectId], "Not in list");

        projectAlerts[_listId][_projectId] = AlertPreferences({
            onTrustChange: _onTrustChange,
            onNewVotes: _onNewVotes,
            onPremiumExpiry: _onPremiumExpiry,
            onScamFlag: _onScamFlag,
            voteThreshold: _voteThreshold
        });

        emit AlertsUpdated(_listId, _projectId);
    }

    // ============ Following ============

    /**
     * @notice Follow a public watchlist
     */
    function followWatchlist(uint256 _listId) external {
        WatchlistInfo storage list = watchlists[_listId];

        require(list.owner != address(0), "List not found");
        require(list.isPublic, "List is private");
        require(list.owner != msg.sender, "Cannot follow own list");
        require(!isFollowing[msg.sender][_listId], "Already following");

        isFollowing[msg.sender][_listId] = true;
        watchlistFollowers[_listId].push(msg.sender);
        list.followerCount++;

        emit WatchlistFollowed(_listId, msg.sender);
    }

    /**
     * @notice Unfollow a watchlist
     */
    function unfollowWatchlist(uint256 _listId) external {
        require(isFollowing[msg.sender][_listId], "Not following");

        isFollowing[msg.sender][_listId] = false;
        watchlists[_listId].followerCount--;

        // Remove from followers array
        address[] storage followers = watchlistFollowers[_listId];
        for (uint256 i = 0; i < followers.length; i++) {
            if (followers[i] == msg.sender) {
                followers[i] = followers[followers.length - 1];
                followers.pop();
                break;
            }
        }

        emit WatchlistUnfollowed(_listId, msg.sender);
    }

    // ============ View Functions ============

    function getWatchlist(uint256 _listId) external view returns (WatchlistInfo memory) {
        return watchlists[_listId];
    }

    function getWatchlistProjects(uint256 _listId) external view returns (uint256[] memory) {
        WatchlistInfo memory list = watchlists[_listId];

        // Only owner or followers can view private lists
        if (!list.isPublic) {
            require(list.owner == msg.sender || isFollowing[msg.sender][_listId], "Private list");
        }

        return watchlistProjects[_listId];
    }

    function getUserWatchlists(address _user) external view returns (uint256[] memory) {
        return userWatchlists[_user];
    }

    function getAlertPreferences(uint256 _listId, uint256 _projectId) external view returns (AlertPreferences memory) {
        return projectAlerts[_listId][_projectId];
    }

    function getFollowers(uint256 _listId) external view returns (address[] memory) {
        return watchlistFollowers[_listId];
    }

    function isProjectInWatchlist(uint256 _listId, uint256 _projectId) external view returns (bool) {
        return inWatchlist[_listId][_projectId];
    }

    /**
     * @notice Get all projects a user is watching across all their lists
     */
    function getAllWatchedProjects(address _user) external view returns (uint256[] memory) {
        uint256[] memory lists = userWatchlists[_user];
        uint256 totalCount = 0;

        // Count total projects
        for (uint256 i = 0; i < lists.length; i++) {
            totalCount += watchlistProjects[lists[i]].length;
        }

        uint256[] memory allProjects = new uint256[](totalCount);
        uint256 index = 0;

        for (uint256 i = 0; i < lists.length; i++) {
            uint256[] storage projects = watchlistProjects[lists[i]];
            for (uint256 j = 0; j < projects.length; j++) {
                allProjects[index] = projects[j];
                index++;
            }
        }

        return allProjects;
    }

    /**
     * @notice Get public watchlists for discovery
     */
    function getPublicWatchlists(uint256 _offset, uint256 _limit) external view returns (WatchlistInfo[] memory, uint256[] memory) {
        uint256 count = 0;

        // Count public lists
        for (uint256 i = 1; i <= watchlistCount; i++) {
            if (watchlists[i].isPublic && watchlists[i].owner != address(0)) {
                count++;
            }
        }

        if (_offset >= count) {
            return (new WatchlistInfo[](0), new uint256[](0));
        }

        uint256 resultCount = _limit;
        if (_offset + _limit > count) resultCount = count - _offset;

        WatchlistInfo[] memory infos = new WatchlistInfo[](resultCount);
        uint256[] memory ids = new uint256[](resultCount);
        uint256 found = 0;
        uint256 added = 0;

        for (uint256 i = 1; i <= watchlistCount && added < resultCount; i++) {
            if (watchlists[i].isPublic && watchlists[i].owner != address(0)) {
                if (found >= _offset) {
                    infos[added] = watchlists[i];
                    ids[added] = i;
                    added++;
                }
                found++;
            }
        }

        return (infos, ids);
    }

    // ============ Admin ============

    function setLimits(uint256 _maxLists, uint256 _maxProjects) external onlyOwner {
        maxListsPerUser = _maxLists;
        maxProjectsPerList = _maxProjects;
    }
}
