# API Reference

DappScore provides both on-chain smart contract interfaces and off-chain APIs for integration.

## Smart Contract ABIs

### ProjectRegistry

```typescript
const PROJECT_REGISTRY_ABI = [
  {
    name: 'submitProject',
    type: 'function',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'metadataUri', type: 'string' }
    ],
    outputs: [{ name: 'projectId', type: 'uint256' }]
  },
  {
    name: 'getProject',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{ name: 'project', type: 'tuple' }]
  }
];
```

### VotingEngine

```typescript
const VOTING_ENGINE_ABI = [
  {
    name: 'vote',
    type: 'function',
    inputs: [
      { name: 'projectId', type: 'uint256' },
      { name: 'isUpvote', type: 'bool' },
      { name: 'comment', type: 'string' }
    ]
  },
  {
    name: 'getProjectScore',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{ name: 'score', type: 'int256' }]
  }
];
```

## REST API (Coming Soon)

### Base URL

```
https://api.dappscore.io/v1
```

### Endpoints

#### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List all projects |
| GET | `/projects/:id` | Get project details |
| GET | `/projects/search` | Search projects |
| GET | `/projects/:id/votes` | Get project votes |
| GET | `/projects/:id/comments` | Get project comments |

#### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/:address` | Get user profile |
| GET | `/users/:address/votes` | Get user's votes |
| GET | `/users/:address/projects` | Get user's submitted projects |

### Example Requests

#### Get Project List

```bash
curl -X GET "https://api.dappscore.io/v1/projects?limit=10&offset=0"
```

Response:
```json
{
  "projects": [
    {
      "id": "1",
      "name": "Example Token",
      "symbol": "EXT",
      "category": "DeFi",
      "score": 42,
      "upvotes": 50,
      "downvotes": 8,
      "isPremium": true
    }
  ],
  "total": 156,
  "hasMore": true
}
```

#### Search Projects

```bash
curl -X GET "https://api.dappscore.io/v1/projects/search?q=defi&category=DeFi"
```

## Webhooks (Coming Soon)

Subscribe to real-time events:

- `project.submitted` - New project submitted
- `project.voted` - Vote cast on project
- `project.premium` - Premium status changed
- `user.reputation` - User reputation changed

## Rate Limits

| Plan | Requests/minute |
|------|-----------------|
| Free | 60 |
| Pro | 300 |
| Enterprise | Unlimited |

## SDKs

Official SDKs coming soon:

- JavaScript/TypeScript
- Python
- Go

## Need Help?

- [Integration Guide](integration.md)
- [Discord Community](https://discord.gg/dappscore)
- [GitHub Issues](https://github.com/dappscore/platform)
