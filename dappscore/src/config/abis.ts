/**
 * Contract ABIs for DappScore
 * These ABIs allow the frontend to interact with deployed contracts
 */

// ScoreToken ABI (ERC20 + burn mechanism)
export const SCORE_TOKEN_ABI = [
  // ERC20 Standard
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  // Custom - Supply Info
  { name: 'MAX_SUPPLY', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'rewardsPool', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'treasury', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'mintingFinished', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  // Burn Mechanism
  { name: 'totalBurned', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'circulatingSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'remainingMintable', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'burn', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'burnFrom', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  // Events
  { name: 'TokensBurned', type: 'event', inputs: [{ name: 'burner', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }] },
  { name: 'ProtocolBurn', type: 'event', inputs: [{ name: 'amount', type: 'uint256', indexed: false }, { name: 'reason', type: 'string', indexed: false }] },
] as const;

// ProjectRegistry ABI
export const PROJECT_REGISTRY_ABI = [
  // View functions
  { name: 'projectCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'listingFee', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'verificationFee', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'getProject',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_projectId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'id', type: 'uint256' },
        { name: 'owner', type: 'address' },
        { name: 'name', type: 'string' },
        { name: 'symbol', type: 'string' },
        { name: 'metadataIpfsHash', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'chain', type: 'string' },
        { name: 'totalSupply', type: 'uint256' },
        { name: 'hardCap', type: 'uint256' },
        { name: 'startDate', type: 'uint256' },
        { name: 'endDate', type: 'uint256' },
        { name: 'status', type: 'uint8' },
        { name: 'trustLevel', type: 'uint8' },
        { name: 'createdAt', type: 'uint256' },
        { name: 'updatedAt', type: 'uint256' },
        { name: 'verified', type: 'bool' },
      ]
    }]
  },
  {
    name: 'getOwnerProjects',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_owner', type: 'address' }],
    outputs: [{ type: 'uint256[]' }]
  },
  // Write functions
  {
    name: 'submitProject',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{
      name: 'input',
      type: 'tuple',
      components: [
        { name: 'name', type: 'string' },
        { name: 'symbol', type: 'string' },
        { name: 'metadataIpfsHash', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'chain', type: 'string' },
        { name: 'totalSupply', type: 'uint256' },
        { name: 'hardCap', type: 'uint256' },
        { name: 'startDate', type: 'uint256' },
        { name: 'endDate', type: 'uint256' },
      ]
    }],
    outputs: []
  },
  { name: 'updateProject', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_projectId', type: 'uint256' }, { name: '_metadataIpfsHash', type: 'string' }], outputs: [] },
  { name: 'requestVerification', type: 'function', stateMutability: 'payable', inputs: [{ name: '_projectId', type: 'uint256' }], outputs: [] },
  // Events
  { name: 'ProjectSubmitted', type: 'event', inputs: [{ name: 'projectId', type: 'uint256', indexed: true }, { name: 'owner', type: 'address', indexed: true }, { name: 'name', type: 'string', indexed: false }] },
  { name: 'ProjectUpdated', type: 'event', inputs: [{ name: 'projectId', type: 'uint256', indexed: true }] },
] as const;

// VotingEngine ABI
export const VOTING_ENGINE_ABI = [
  // View functions
  { name: 'rewardPerVote', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalStaked', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'getProjectVotes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_projectId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'upvotes', type: 'uint256' },
        { name: 'downvotes', type: 'uint256' },
        { name: 'totalVoters', type: 'uint256' },
      ]
    }]
  },
  {
    name: 'getUserVote',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_projectId', type: 'uint256' }, { name: '_user', type: 'address' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'voteType', type: 'uint8' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'commentIpfsHash', type: 'string' },
      ]
    }]
  },
  {
    name: 'getUserStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [
      { name: 'totalVotes', type: 'uint256' },
      { name: 'pending', type: 'uint256' },
      { name: 'staked', type: 'uint256' },
    ]
  },
  { name: 'calculateReward', type: 'function', stateMutability: 'view', inputs: [{ name: '_voter', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'pendingRewards', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'stakedBalance', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }] },
  // Write functions
  { name: 'vote', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_projectId', type: 'uint256' }, { name: '_voteType', type: 'uint8' }, { name: '_commentIpfsHash', type: 'string' }], outputs: [] },
  { name: 'claimRewards', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'stake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_amount', type: 'uint256' }], outputs: [] },
  { name: 'unstake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_amount', type: 'uint256' }], outputs: [] },
  // Events
  { name: 'Voted', type: 'event', inputs: [{ name: 'projectId', type: 'uint256', indexed: true }, { name: 'voter', type: 'address', indexed: true }, { name: 'voteType', type: 'uint8', indexed: false }] },
  { name: 'RewardsClaimed', type: 'event', inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }] },
  { name: 'Staked', type: 'event', inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }] },
  { name: 'Unstaked', type: 'event', inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }] },
] as const;

// TokenSale ABI
export const TOKEN_SALE_ABI = [
  // View functions
  { name: 'currentStage', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'claimEnabled', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'ethPriceUsd', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'minPurchaseUsd', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'maxPurchaseUsd', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'getSaleInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'stage', type: 'uint8' },
      { name: 'raisedUsd', type: 'uint256' },
      { name: 'tokensSold', type: 'uint256' },
      { name: 'contributors', type: 'uint256' },
      { name: 'claiming', type: 'bool' },
    ]
  },
  {
    name: 'getStageInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_stage', type: 'uint8' }],
    outputs: [
      { name: 'priceUsd', type: 'uint256' },
      { name: 'allocation', type: 'uint256' },
      { name: 'sold', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'remaining', type: 'uint256' },
    ]
  },
  {
    name: 'getCurrentStageInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'priceUsd', type: 'uint256' },
      { name: 'allocation', type: 'uint256' },
      { name: 'sold', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'remaining', type: 'uint256' },
    ]
  },
  {
    name: 'getUserInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'purchasedUsd', type: 'uint256' },
      { name: 'tokensOwed', type: 'uint256' },
      { name: 'remainingAllowance', type: 'uint256' },
      { name: 'claimed', type: 'bool' },
    ]
  },
  { name: 'calculateTokens', type: 'function', stateMutability: 'view', inputs: [{ name: 'usdAmount', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { name: 'calculateTokensForEth', type: 'function', stateMutability: 'view', inputs: [{ name: 'ethAmount', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  {
    name: 'getAllStagePrices',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'stage1Price', type: 'uint256' },
      { name: 'stage2Price', type: 'uint256' },
      { name: 'stage3Price', type: 'uint256' },
    ]
  },
  // Write functions
  { name: 'buyWithEth', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'buyWithUsdc', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'buyWithUsdt', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'claimTokens', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  // Events
  { name: 'TokensPurchasedWithEth', type: 'event', inputs: [{ name: 'buyer', type: 'address', indexed: true }, { name: 'stage', type: 'uint8', indexed: false }, { name: 'ethAmount', type: 'uint256', indexed: false }, { name: 'usdValue', type: 'uint256', indexed: false }, { name: 'tokenAmount', type: 'uint256', indexed: false }] },
  { name: 'TokensClaimed', type: 'event', inputs: [{ name: 'buyer', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }] },
] as const;

// Vote type enum values (matching contract)
export const VoteType = {
  None: 0,
  Upvote: 1,
  Downvote: 2,
} as const;

// Project status enum values
export const ProjectStatus = {
  Pending: 0,
  Active: 1,
  Flagged: 2,
  Suspended: 3,
  Blacklisted: 4,
} as const;

// Trust level enum values
export const TrustLevel = {
  NewListing: 0,
  Trusted: 1,
  Neutral: 2,
  Suspicious: 3,
  SuspectedScam: 4,
  ProbableScam: 5,
} as const;

// Token sale stage enum values
export const SaleStage = {
  NotStarted: 0,
  Stage1: 1,
  Stage2: 2,
  Stage3: 3,
  Ended: 4,
} as const;
