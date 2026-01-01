// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ScoreToken
 * @notice The native token of DappScore platform
 * @dev Fixed supply of 100M tokens with burn capability
 *
 * Token Allocation:
 * - 40% (40M) - Liquidity Pool
 * - 40% (40M) - Voting Rewards Pool
 * - 5%  (5M)  - Airdrop
 * - 5%  (5M)  - Development
 * - 5%  (5M)  - Marketing
 * - 5%  (5M)  - Team (vested)
 */
contract ScoreToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18; // 100M tokens

    // Allocation addresses
    address public rewardsPool;
    address public treasury;

    // Minting control
    bool public mintingFinished = false;

    event RewardsPoolSet(address indexed pool);
    event TreasurySet(address indexed treasury);
    event MintingFinished();

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
}
