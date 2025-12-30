// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./TrustToken.sol";

/**
 * @title TokenSale
 * @notice ICOTrust's own token sale contract
 * @dev Multi-phase sale with whitelist and public rounds
 *
 * Sale Phases:
 * 1. Private Sale (whitelist only, best price)
 * 2. Presale (whitelist + KYC, discounted)
 * 3. Public Sale (open to all)
 */
contract TokenSale is Ownable, ReentrancyGuard {

    enum SalePhase {
        NotStarted,
        PrivateSale,
        Presale,
        PublicSale,
        Ended
    }

    struct PhaseConfig {
        uint256 tokenPrice;      // Price per token in ETH (wei)
        uint256 minPurchase;     // Minimum purchase in ETH
        uint256 maxPurchase;     // Maximum purchase in ETH per wallet
        uint256 allocation;      // Total tokens available in this phase
        uint256 sold;            // Tokens sold in this phase
        uint256 startTime;
        uint256 endTime;
        bool whitelistRequired;
    }

    // Token
    TrustToken public trustToken;
    IERC20 public usdc;

    // Sale state
    SalePhase public currentPhase;
    mapping(SalePhase => PhaseConfig) public phaseConfigs;
    mapping(address => bool) public whitelist;
    mapping(address => uint256) public contributions;  // ETH contributed
    mapping(address => uint256) public tokensPurchased;
    mapping(address => bool) public hasClaimed;

    // Vesting (for private sale participants)
    uint256 public vestingCliff = 30 days;
    uint256 public vestingDuration = 180 days;  // 6 months
    uint256 public tgeUnlock = 2000;  // 20% unlocked at TGE (basis points)

    // Totals
    uint256 public totalRaised;
    uint256 public totalSold;
    uint256 public totalContributors;

    // Soft/Hard caps
    uint256 public softCap = 50 ether;
    uint256 public hardCap = 500 ether;

    // Treasury
    address public treasury;

    // Claim enabled
    bool public claimEnabled;
    uint256 public tgeTime;

    // Events
    event PhaseStarted(SalePhase phase);
    event PhaseEnded(SalePhase phase);
    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount, SalePhase phase);
    event TokensClaimed(address indexed buyer, uint256 amount);
    event WhitelistUpdated(address indexed account, bool status);
    event RefundClaimed(address indexed buyer, uint256 amount);

    constructor(
        address _initialOwner,
        address _trustToken,
        address _usdc,
        address _treasury
    ) Ownable(_initialOwner) {
        trustToken = TrustToken(_trustToken);
        usdc = IERC20(_usdc);
        treasury = _treasury;
        currentPhase = SalePhase.NotStarted;

        // Initialize phase configs
        // Private Sale: $0.005 per token equivalent
        phaseConfigs[SalePhase.PrivateSale] = PhaseConfig({
            tokenPrice: 0.000015 ether,     // ~$0.005 at $3000 ETH
            minPurchase: 0.5 ether,
            maxPurchase: 10 ether,
            allocation: 10_000_000 * 10**18,  // 10M tokens (10%)
            sold: 0,
            startTime: 0,
            endTime: 0,
            whitelistRequired: true
        });

        // Presale: $0.008 per token
        phaseConfigs[SalePhase.Presale] = PhaseConfig({
            tokenPrice: 0.000024 ether,     // ~$0.008 at $3000 ETH
            minPurchase: 0.1 ether,
            maxPurchase: 5 ether,
            allocation: 15_000_000 * 10**18,  // 15M tokens (15%)
            sold: 0,
            startTime: 0,
            endTime: 0,
            whitelistRequired: true
        });

        // Public Sale: $0.01 per token
        phaseConfigs[SalePhase.PublicSale] = PhaseConfig({
            tokenPrice: 0.00003 ether,      // ~$0.01 at $3000 ETH
            minPurchase: 0.05 ether,
            maxPurchase: 2 ether,
            allocation: 15_000_000 * 10**18,  // 15M tokens (15%)
            sold: 0,
            startTime: 0,
            endTime: 0,
            whitelistRequired: false
        });
    }

    /**
     * @notice Buy tokens with ETH
     */
    function buyTokens() external payable nonReentrant {
        require(currentPhase != SalePhase.NotStarted && currentPhase != SalePhase.Ended, "Sale not active");
        require(msg.value > 0, "No ETH sent");

        PhaseConfig storage config = phaseConfigs[currentPhase];

        require(block.timestamp >= config.startTime, "Phase not started");
        require(block.timestamp <= config.endTime, "Phase ended");
        require(msg.value >= config.minPurchase, "Below minimum");
        require(contributions[msg.sender] + msg.value <= config.maxPurchase, "Exceeds maximum");

        if (config.whitelistRequired) {
            require(whitelist[msg.sender], "Not whitelisted");
        }

        uint256 tokenAmount = (msg.value * 10**18) / config.tokenPrice;
        require(config.sold + tokenAmount <= config.allocation, "Exceeds allocation");

        // Update state
        if (contributions[msg.sender] == 0) {
            totalContributors++;
        }

        contributions[msg.sender] += msg.value;
        tokensPurchased[msg.sender] += tokenAmount;
        config.sold += tokenAmount;
        totalRaised += msg.value;
        totalSold += tokenAmount;

        emit TokensPurchased(msg.sender, msg.value, tokenAmount, currentPhase);

        // Check hard cap
        if (totalRaised >= hardCap) {
            _endCurrentPhase();
        }
    }

    /**
     * @notice Claim purchased tokens (after TGE)
     */
    function claimTokens() external nonReentrant {
        require(claimEnabled, "Claiming not enabled");
        require(tokensPurchased[msg.sender] > 0, "No tokens to claim");
        require(!hasClaimed[msg.sender], "Already claimed");

        uint256 totalPurchased = tokensPurchased[msg.sender];
        uint256 claimable = calculateClaimable(msg.sender);
        require(claimable > 0, "Nothing to claim yet");

        hasClaimed[msg.sender] = true;

        // For simplicity, we release all at once after vesting
        // In production, implement proper vesting schedule
        trustToken.transfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable);
    }

    /**
     * @notice Calculate claimable tokens based on vesting
     */
    function calculateClaimable(address _buyer) public view returns (uint256) {
        if (!claimEnabled || tgeTime == 0) return 0;

        uint256 totalPurchased = tokensPurchased[_buyer];
        if (totalPurchased == 0) return 0;
        if (hasClaimed[_buyer]) return 0;

        uint256 timeSinceTge = block.timestamp - tgeTime;

        // TGE unlock
        uint256 tgeAmount = totalPurchased * tgeUnlock / 10000;

        if (timeSinceTge < vestingCliff) {
            return tgeAmount;
        }

        // After cliff, linear vesting
        uint256 vestedTime = timeSinceTge - vestingCliff;
        if (vestedTime >= vestingDuration) {
            return totalPurchased;  // Fully vested
        }

        uint256 vestingAmount = totalPurchased - tgeAmount;
        uint256 vested = vestingAmount * vestedTime / vestingDuration;

        return tgeAmount + vested;
    }

    /**
     * @notice Refund if soft cap not met
     */
    function claimRefund() external nonReentrant {
        require(currentPhase == SalePhase.Ended, "Sale not ended");
        require(totalRaised < softCap, "Soft cap reached");
        require(contributions[msg.sender] > 0, "No contribution");

        uint256 amount = contributions[msg.sender];
        contributions[msg.sender] = 0;
        tokensPurchased[msg.sender] = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Refund failed");

        emit RefundClaimed(msg.sender, amount);
    }

    // Admin functions

    /**
     * @notice Start a sale phase
     */
    function startPhase(SalePhase _phase, uint256 _duration) external onlyOwner {
        require(_phase != SalePhase.NotStarted && _phase != SalePhase.Ended, "Invalid phase");
        require(currentPhase == SalePhase.NotStarted || uint256(currentPhase) < uint256(_phase), "Invalid phase order");

        currentPhase = _phase;
        PhaseConfig storage config = phaseConfigs[_phase];
        config.startTime = block.timestamp;
        config.endTime = block.timestamp + _duration;

        emit PhaseStarted(_phase);
    }

    /**
     * @notice End current phase
     */
    function endPhase() external onlyOwner {
        _endCurrentPhase();
    }

    function _endCurrentPhase() internal {
        emit PhaseEnded(currentPhase);

        if (currentPhase == SalePhase.PublicSale) {
            currentPhase = SalePhase.Ended;
        } else if (currentPhase == SalePhase.Presale) {
            currentPhase = SalePhase.PublicSale;
        } else if (currentPhase == SalePhase.PrivateSale) {
            currentPhase = SalePhase.Presale;
        }
    }

    /**
     * @notice Enable token claiming (TGE)
     */
    function enableClaiming() external onlyOwner {
        require(currentPhase == SalePhase.Ended, "Sale not ended");
        require(totalRaised >= softCap, "Soft cap not reached");
        claimEnabled = true;
        tgeTime = block.timestamp;
    }

    /**
     * @notice Add/remove from whitelist
     */
    function setWhitelist(address[] calldata _accounts, bool _status) external onlyOwner {
        for (uint256 i = 0; i < _accounts.length; i++) {
            whitelist[_accounts[i]] = _status;
            emit WhitelistUpdated(_accounts[i], _status);
        }
    }

    /**
     * @notice Update phase config
     */
    function setPhaseConfig(
        SalePhase _phase,
        uint256 _tokenPrice,
        uint256 _minPurchase,
        uint256 _maxPurchase,
        uint256 _allocation
    ) external onlyOwner {
        require(currentPhase == SalePhase.NotStarted, "Sale already started");

        PhaseConfig storage config = phaseConfigs[_phase];
        config.tokenPrice = _tokenPrice;
        config.minPurchase = _minPurchase;
        config.maxPurchase = _maxPurchase;
        config.allocation = _allocation;
    }

    /**
     * @notice Update vesting params
     */
    function setVesting(uint256 _cliff, uint256 _duration, uint256 _tgeUnlock) external onlyOwner {
        require(currentPhase == SalePhase.NotStarted, "Sale already started");
        vestingCliff = _cliff;
        vestingDuration = _duration;
        tgeUnlock = _tgeUnlock;
    }

    /**
     * @notice Update caps
     */
    function setCaps(uint256 _softCap, uint256 _hardCap) external onlyOwner {
        require(currentPhase == SalePhase.NotStarted, "Sale already started");
        softCap = _softCap;
        hardCap = _hardCap;
    }

    /**
     * @notice Withdraw raised funds to treasury
     */
    function withdrawFunds() external onlyOwner {
        require(totalRaised >= softCap, "Soft cap not reached");

        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");

        (bool sent, ) = treasury.call{value: balance}("");
        require(sent, "Withdraw failed");
    }

    /**
     * @notice Withdraw unsold tokens
     */
    function withdrawUnsoldTokens() external onlyOwner {
        require(currentPhase == SalePhase.Ended, "Sale not ended");

        uint256 balance = trustToken.balanceOf(address(this));
        uint256 reserved = totalSold;  // Tokens owed to buyers

        require(balance > reserved, "No excess tokens");

        trustToken.transfer(treasury, balance - reserved);
    }

    // View functions

    function getPhaseConfig(SalePhase _phase) external view returns (PhaseConfig memory) {
        return phaseConfigs[_phase];
    }

    function getUserInfo(address _user) external view returns (
        uint256 contributed,
        uint256 purchased,
        bool isWhitelisted,
        bool claimed,
        uint256 claimable
    ) {
        return (
            contributions[_user],
            tokensPurchased[_user],
            whitelist[_user],
            hasClaimed[_user],
            calculateClaimable(_user)
        );
    }

    function getSaleInfo() external view returns (
        SalePhase phase,
        uint256 raised,
        uint256 sold,
        uint256 contributors,
        uint256 soft,
        uint256 hard
    ) {
        return (
            currentPhase,
            totalRaised,
            totalSold,
            totalContributors,
            softCap,
            hardCap
        );
    }
}
