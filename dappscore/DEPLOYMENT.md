# DappScore Deployment Guide

Complete deployment guide for the DappScore platform, covering smart contracts, subgraph, backend services, and client applications.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         DappScore Platform                       │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)  │  Telegram Bot  │  Browser Extension       │
├─────────────────────────────────────────────────────────────────┤
│                    Backend API (Express.js)                      │
├─────────────────────────────────────────────────────────────────┤
│        The Graph (Subgraph)        │    External Services        │
├─────────────────────────────────────────────────────────────────┤
│                    Smart Contracts (Base)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js v18+
- pnpm (recommended) or npm
- Foundry (for smart contracts)
- Docker (for local Graph node)
- Git

## 1. Smart Contract Deployment

### Setup

```bash
cd dappscore/contracts

# Install dependencies
forge install

# Copy environment template
cp .env.example .env
```

### Configure .env

```env
# Required
PRIVATE_KEY=your_deployer_private_key
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_basescan_api_key

# Optional
TREASURY_ADDRESS=0x...  # Defaults to deployer
TEAM_ADDRESS=0x...      # Defaults to deployer
```

### Deploy to Testnet

```bash
# Deploy all contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --broadcast \
  --verify

# Run setup (allocate tokens, configure sale)
forge script script/Setup.s.sol:Setup \
  --rpc-url base_sepolia \
  --broadcast
```

### Deploy to Mainnet

```bash
# Deploy all contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base \
  --broadcast \
  --verify

# Run setup
forge script script/Setup.s.sol:Setup \
  --rpc-url base \
  --broadcast
```

### Update Frontend Config

After deployment, copy the contract addresses to:
- `dappscore/src/config/wagmi.ts` - Update CONTRACT_ADDRESSES

### Deployed Contracts

| Contract | Description |
|----------|-------------|
| ScoreToken | ERC20 governance token (500M supply) |
| ProjectRegistry | Project listing and management |
| VotingEngine | Voting, staking, and rewards |
| TokenSale | Token distribution and sale |
| PremiumListings | Premium listing payments |
| CuratorNFT | Curator badge NFTs |
| ReputationSystem | User reputation tracking |
| PredictionMarket | Scam prediction markets |
| BountySystem | Investigation bounties |
| InsurancePool | Scam insurance coverage |
| Watchlist | On-chain watchlists |
| AffiliateProgram | Referral rewards |

## 2. Subgraph Deployment

### Local Development

```bash
cd dappscore/subgraph

# Start local Graph node (requires Docker)
docker-compose up -d

# Generate types
graph codegen

# Build
graph build

# Create local subgraph
graph create --node http://localhost:8020/ dappscore

# Deploy locally
graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 dappscore
```

### Deploy to The Graph Hosted Service

```bash
# Authenticate
graph auth --product hosted-service <access-token>

# Deploy
graph deploy --product hosted-service <github-username>/dappscore
```

### Deploy to Subgraph Studio

```bash
# Authenticate
graph auth --studio <deploy-key>

# Deploy
graph deploy --studio dappscore
```

### Update Subgraph Config

Edit `subgraph.yaml` with your deployed contract addresses:

```yaml
dataSources:
  - name: VotingEngine
    source:
      address: "0x..."  # Your deployed address
      startBlock: 12345678  # Block number of deployment
```

## 3. Backend API Deployment

### Setup

```bash
cd dappscore/backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Configure .env

```env
# Server
PORT=3001
NODE_ENV=production

# Database (optional, uses in-memory by default)
DATABASE_URL=postgresql://...

# Blockchain
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# The Graph
SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/...

# Services
TELEGRAM_BOT_TOKEN=your_bot_token
FRONTEND_URL=https://dappscore.io

# Optional
REDIS_URL=redis://localhost:6379
```

### Build and Run

```bash
# Build
npm run build

# Start production server
npm start

# Or with PM2
pm2 start dist/index.js --name dappscore-api
```

### Docker Deployment

```bash
# Build image
docker build -t dappscore-backend .

# Run container
docker run -d \
  --name dappscore-api \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e SUBGRAPH_URL=https://... \
  dappscore-backend
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /health | Health check |
| GET /api/projects | Search/list projects |
| GET /api/users/:address | User profile and stats |
| GET /api/stats | Platform statistics |
| POST /api/scam-detection/analyze | Analyze contract |
| GET /api/whales/:token | Whale wallets for token |
| GET /api/share/image/:projectId | Generate share card |

## 4. Telegram Bot Deployment

### Setup

```bash
cd dappscore/telegram-bot

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

### Configure .env

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/...
FRONTEND_URL=https://dappscore.io
```

### Get Bot Token

1. Message @BotFather on Telegram
2. Send `/newbot`
3. Follow prompts to create bot
4. Copy the bot token

### Run

```bash
# Development
npm run dev

# Production
npm run build
npm start

# With PM2
pm2 start dist/index.js --name dappscore-bot
```

### Bot Commands

| Command | Description |
|---------|-------------|
| /start | Welcome message |
| /check <name> | Check project by name |
| /address <0x...> | Lookup by contract |
| /top | Top trusted projects |
| /scams | Recently flagged scams |
| /stats | Platform statistics |
| /markets | Active prediction markets |

## 5. Browser Extension

### Build

```bash
cd dappscore/browser-extension

# Install dependencies (if using bundler)
npm install

# Build for Chrome
npm run build:chrome

# Build for Firefox
npm run build:firefox
```

### Load in Chrome (Development)

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `browser-extension` folder

### Load in Firefox (Development)

1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json`

### Publish to Chrome Web Store

1. Create ZIP of extension folder
2. Go to Chrome Developer Dashboard
3. Pay one-time $5 fee
4. Upload ZIP and fill in listing details
5. Submit for review

## 6. Frontend Deployment

### Setup

```bash
cd dappscore

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
```

### Configure .env.local

```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_API_URL=https://api.dappscore.io
NEXT_PUBLIC_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/...
```

### Build and Deploy

```bash
# Build
pnpm build

# Start production server
pnpm start
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Deploy to Other Platforms

**Netlify:**
```bash
# Build command
pnpm build

# Publish directory
.next
```

**Docker:**
```bash
docker build -t dappscore-frontend .
docker run -p 3000:3000 dappscore-frontend
```

## 7. Infrastructure Recommendations

### Production Setup

1. **Load Balancer**: Use Cloudflare or AWS ALB
2. **Database**: PostgreSQL for backend persistence
3. **Cache**: Redis for caching and rate limiting
4. **Monitoring**: Datadog, New Relic, or Grafana
5. **Logging**: ELK stack or Datadog logs

### Security Checklist

- [ ] Environment variables never committed
- [ ] API rate limiting enabled
- [ ] CORS configured for frontend domain only
- [ ] HTTPS enforced everywhere
- [ ] Contract ownership transferred to multisig
- [ ] Subgraph synced and monitored
- [ ] Backup RPC endpoints configured

### Cost Estimates

| Service | Monthly Cost |
|---------|-------------|
| Base RPC (Alchemy/Infura) | $50-200 |
| The Graph Hosted | Free (with limits) |
| Backend Server (2 vCPU) | $20-50 |
| Vercel (Frontend) | Free-$20 |
| Domain | ~$15/year |
| **Total** | **~$100-300/month** |

## 8. Monitoring & Maintenance

### Health Checks

```bash
# API health
curl https://api.dappscore.io/health

# Subgraph status
curl https://api.thegraph.com/index-node/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatuses { subgraph synced health } }"}'
```

### Logs

```bash
# Backend logs
pm2 logs dappscore-api

# Telegram bot logs
pm2 logs dappscore-bot
```

### Updates

1. **Contracts**: Deploy new version, migrate if needed
2. **Subgraph**: Re-deploy with new schema/mappings
3. **Backend**: Build and restart with PM2
4. **Frontend**: Deploy to Vercel/hosting

## Support

- GitHub Issues: https://github.com/dappscore/platform/issues
- Discord: https://discord.gg/dappscore
- Telegram: @DappScoreBot
