# ProjectRegistry Contract

Stores and manages all project submissions on DappScore.

## Contract Details

| Property | Value |
|----------|-------|
| Network | Base |
| Status | Coming Soon |

## Addresses

| Network | Address |
|---------|---------|
| Base Sepolia | Coming Soon |
| Base Mainnet | Coming Soon |

## Functions

### Write Functions

```solidity
function submitProject(
    string memory name,
    string memory symbol,
    string memory category,
    string memory description,
    string memory metadataUri
) external returns (uint256 projectId);

function updateProject(
    uint256 projectId,
    string memory metadataUri
) external;

function verifyOwnership(
    uint256 projectId,
    bytes memory signature
) external;

function setPremium(
    uint256 projectId,
    uint256 duration
) external;
```

### Read Functions

```solidity
function getProject(uint256 projectId) external view returns (Project memory);
function getProjectCount() external view returns (uint256);
function isProjectOwner(uint256 projectId, address account) external view returns (bool);
function isPremium(uint256 projectId) external view returns (bool);
```

## Data Structures

```solidity
struct Project {
    uint256 id;
    string name;
    string symbol;
    string category;
    string metadataUri;
    address[] owners;
    uint256 createdAt;
    uint256 premiumExpiry;
    bool active;
}
```

## Events

```solidity
event ProjectSubmitted(uint256 indexed projectId, address indexed submitter, string name);
event ProjectUpdated(uint256 indexed projectId, string metadataUri);
event OwnershipVerified(uint256 indexed projectId, address indexed owner);
event PremiumActivated(uint256 indexed projectId, uint256 expiry);
```

## Source Code

Available on GitHub after deployment.
