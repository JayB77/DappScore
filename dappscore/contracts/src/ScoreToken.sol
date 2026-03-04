// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title ScoreToken
 * @notice The native token of DappScore platform
 * @dev Fixed supply of 500M tokens with deflationary burn mechanism
 *
 * Token Allocation:
 * - 40% (200M) - Liquidity Pool
 * - 40% (200M) - Voting Rewards Pool
 * - 5%  (25M)  - Airdrop
 * - 5%  (25M)  - Development
 * - 5%  (25M)  - Marketing
 * - 5%  (25M)  - Team (vested)
 *
 * Burn Mechanism:
 * - Users can burn their own tokens via burn()
 * - Approved spenders can burn via burnFrom()
 * - Protocol can burn from treasury
 * - All burns are tracked and reduce circulating supply permanently
 */
contract ScoreToken is ERC20, ERC20Burnable, Ownable2Step {
    uint256 public constant MAX_SUPPLY = 500_000_000 * 10 ** 18; // 500M tokens

    // Burn tracking
    uint256 public totalBurned;

    // Allocation addresses
    address public rewardsPool;
    address public treasury;

    // Minting control
    bool public mintingFinished = false;

    event RewardsPoolSet(address indexed pool);
    event TreasurySet(address indexed treasury);
    event MintingFinished();
    event TokensBurned(address indexed burner, uint256 amount);
    event ProtocolBurn(uint256 amount, string reason);

    error MintingIsFinished();
    error ExceedsMaxSupply();
    error OnlyRewardsPool();
    error TreasuryNotSet();
    error InsufficientTreasuryBalance();
    error ZeroAddress();

    constructor(address _initialOwner) ERC20("DappScore", "SCORE") Ownable(_initialOwner) {}

    // ============ Minting ============

    /**
     * @notice Mint tokens (only owner, only before minting is finished)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (mintingFinished) revert MintingIsFinished();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        _mint(to, amount);
    }

    /**
     * @notice Permanently disable minting
     */
    function finishMinting() external onlyOwner {
        mintingFinished = true;
        emit MintingFinished();
    }

    /**
     * @notice Set the rewards pool address (authorised to mint rewards)
     */
    function setRewardsPool(address _rewardsPool) external onlyOwner {
        if (_rewardsPool == address(0)) revert ZeroAddress();
        rewardsPool = _rewardsPool;
        emit RewardsPoolSet(_rewardsPool);
    }

    /**
     * @notice Set treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    /**
     * @notice Mint rewards (only rewardsPool)
     */
    function mintRewards(address to, uint256 amount) external {
        if (msg.sender != rewardsPool) revert OnlyRewardsPool();
        if (mintingFinished) revert MintingIsFinished();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        _mint(to, amount);
    }

    // ============ Burn Functions ============

    /**
     * @notice Burn tokens from caller's balance
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        totalBurned += amount;
        emit TokensBurned(msg.sender, amount);
    }

    /**
     * @notice Burn tokens from another account (requires approval)
     */
    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        totalBurned += amount;
        emit TokensBurned(account, amount);
    }

    /**
     * @notice Protocol burn for deflationary mechanisms (owner only)
     * @param amount Amount to burn from treasury
     * @param reason Reason for the burn (for transparency)
     */
    function protocolBurn(uint256 amount, string calldata reason) external onlyOwner {
        if (treasury == address(0)) revert TreasuryNotSet();
        if (balanceOf(treasury) < amount) revert InsufficientTreasuryBalance();
        _burn(treasury, amount);
        totalBurned += amount;
        emit ProtocolBurn(amount, reason);
        emit TokensBurned(treasury, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get circulating supply (totalSupply already excludes burned tokens)
     */
    function circulatingSupply() external view returns (uint256) {
        return totalSupply();
    }

    /**
     * @notice Get remaining mintable supply
     * @dev totalSupply() already accounts for burned tokens (they reduce supply),
     *      so we do NOT subtract totalBurned again.
     */
    function remainingMintable() external view returns (uint256) {
        if (mintingFinished) return 0;
        return MAX_SUPPLY - totalSupply();
    }
}
