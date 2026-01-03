# ScoreToken Contract

The $SCORE token is an ERC-20 token deployed on Base.

## Contract Details

| Property | Value |
|----------|-------|
| Name | DappScore Token |
| Symbol | SCORE |
| Decimals | 18 |
| Max Supply | 100,000,000 |
| Standard | ERC-20 |

## Addresses

| Network | Address |
|---------|---------|
| Base Sepolia | Coming Soon |
| Base Mainnet | Coming Soon |

## Features

### Standard ERC-20
- `transfer(address to, uint256 amount)`
- `approve(address spender, uint256 amount)`
- `transferFrom(address from, address to, uint256 amount)`
- `balanceOf(address account)`
- `allowance(address owner, address spender)`

### Additional Features
- **Burnable** - Tokens can be burned
- **Mintable** - Only by authorized contracts (capped at max supply)
- **Pausable** - Emergency pause functionality

## Access Control

| Role | Permissions |
|------|-------------|
| Owner | Pause/unpause, grant roles |
| Minter | Mint new tokens (up to max supply) |
| Burner | Burn tokens |

## Events

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);
event Paused(address account);
event Unpaused(address account);
```

## Source Code

Available on GitHub after deployment.

## Verification

Contract will be verified on BaseScan.
