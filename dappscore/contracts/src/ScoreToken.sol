// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
 * - Protocol can burn from rewards pool
 * - All burns are tracked and reduce circulating supply permanently
 */
contract ScoreToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 500_000_000 * 10**18; // 500M tokens

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

    constructor(
        address _initialOwner
    ) ERC20("DappScore", "SCORE") Ownable(_initialOwner) {
        // Initial mint to deployer for distribution
        // Will be distributed according to tokenomics
    }

    /**
     * @notice Mint tokens (only owner, only before minting is finished)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(!mintingFinished, "Minting finished");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @notice Finish minting forever
     */
    function finishMinting() external onlyOwner {
        mintingFinished = true;
        emit MintingFinished();
    }

    /**
     * @notice Set the rewards pool address (can mint rewards)
     * @param _rewardsPool Address of rewards pool contract
     */
    function setRewardsPool(address _rewardsPool) external onlyOwner {
        require(_rewardsPool != address(0), "Invalid address");
        rewardsPool = _rewardsPool;
        emit RewardsPoolSet(_rewardsPool);
    }

    /**
     * @notice Set treasury address
     * @param _treasury Treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    /**
     * @notice Mint rewards (only rewards pool)
     * @param to Recipient
     * @param amount Amount to mint
     */
    function mintRewards(address to, uint256 amount) external {
        require(msg.sender == rewardsPool, "Only rewards pool");
        require(!mintingFinished, "Minting finished");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    // ============ Burn Functions ============

    /**
     * @notice Burn tokens from caller's balance
     * @param amount Amount to burn
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        totalBurned += amount;
        emit TokensBurned(msg.sender, amount);
    }

    /**
     * @notice Burn tokens from another account (requires approval)
     * @param account Account to burn from
     * @param amount Amount to burn
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
        require(treasury != address(0), "Treasury not set");
        require(balanceOf(treasury) >= amount, "Insufficient treasury balance");
        _burn(treasury, amount);
        totalBurned += amount;
        emit ProtocolBurn(amount, reason);
        emit TokensBurned(treasury, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get circulating supply (total minted minus burned)
     */
    function circulatingSupply() external view returns (uint256) {
        return totalSupply();
    }

    /**
     * @notice Get remaining mintable supply
     */
    function remainingMintable() external view returns (uint256) {
        if (mintingFinished) return 0;
        return MAX_SUPPLY - totalSupply() - totalBurned;
    }
}
