# PremiumListings Contract

Handles premium listing subscriptions and USDC payments.

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

## Payment Configuration

| Parameter | Value |
|-----------|-------|
| Payment Token | USDC |
| Premium Price | 100 USDC |
| Duration | 30 days |
| Payment Receiver | 0x3b4368820c0A03ebd2B5C688b3CBC0A3B31C41B7 |

## Functions

### Write Functions

```solidity
function purchasePremium(
    uint256 projectId,
    uint256 months
) external;

function renewPremium(uint256 projectId) external;

function giftPremium(
    uint256 projectId,
    address recipient,
    uint256 months
) external;
```

### Read Functions

```solidity
function isPremium(uint256 projectId) external view returns (bool);
function getPremiumExpiry(uint256 projectId) external view returns (uint256);
function getPremiumPrice() external view returns (uint256);
function getPaymentToken() external view returns (address);
```

## Payment Flow

1. **Approval**: User approves USDC spending for the contract
2. **Transfer**: Contract transfers USDC from user to payment receiver
3. **Activation**: Premium status is activated for the project
4. **Confirmation**: Event emitted with expiry timestamp

## USDC Addresses

| Network | USDC Address |
|---------|--------------|
| Base Mainnet | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| Base Sepolia | 0x036CbD53842c5426634e7929541eC2318f3dCF7e |

## Events

```solidity
event PremiumPurchased(uint256 indexed projectId, address indexed buyer, uint256 expiry, uint256 amount);
event PremiumRenewed(uint256 indexed projectId, uint256 newExpiry);
event PremiumGifted(uint256 indexed projectId, address indexed from, address indexed to, uint256 expiry);
```

## Premium Benefits

Projects with active premium status receive:

- **Featured Placement**: Priority in search results and listings
- **Verified Badge**: Visual indicator of premium status
- **Analytics Dashboard**: Detailed engagement metrics
- **Priority Support**: Faster response times
- **Custom Branding**: Additional customization options

## Source Code

Available on GitHub after deployment.
