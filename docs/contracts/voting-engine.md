# VotingEngine Contract

Manages community voting and reputation scoring for projects.

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
function vote(
    uint256 projectId,
    bool isUpvote,
    string memory comment
) external;

function updateVote(
    uint256 projectId,
    bool isUpvote
) external;

function removeVote(uint256 projectId) external;

function reportProject(
    uint256 projectId,
    string memory reason
) external;
```

### Read Functions

```solidity
function getProjectScore(uint256 projectId) external view returns (int256 score);
function getVoteCount(uint256 projectId) external view returns (uint256 upvotes, uint256 downvotes);
function getUserVote(uint256 projectId, address user) external view returns (int8 vote);
function getComments(uint256 projectId, uint256 offset, uint256 limit) external view returns (Comment[] memory);
function getUserReputation(address user) external view returns (uint256);
```

## Data Structures

```solidity
struct Vote {
    address voter;
    bool isUpvote;
    string comment;
    uint256 timestamp;
}

struct Comment {
    address author;
    string content;
    uint256 timestamp;
    uint256 upvotes;
}
```

## Events

```solidity
event Voted(uint256 indexed projectId, address indexed voter, bool isUpvote);
event VoteUpdated(uint256 indexed projectId, address indexed voter, bool isUpvote);
event VoteRemoved(uint256 indexed projectId, address indexed voter);
event CommentAdded(uint256 indexed projectId, address indexed author, string comment);
event ProjectReported(uint256 indexed projectId, address indexed reporter, string reason);
```

## Reputation System

User reputation is calculated based on:

- **Voting Accuracy**: Votes aligned with community consensus
- **Comment Quality**: Upvotes received on comments
- **Participation**: Consistent engagement over time
- **Report Accuracy**: Accurate scam/rug reports

Higher reputation unlocks:

- Weighted votes (votes count more)
- Early access to new features
- Governance participation
- Bonus $SCORE rewards

## Source Code

Available on GitHub after deployment.
