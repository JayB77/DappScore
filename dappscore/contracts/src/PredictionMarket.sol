// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ScoreToken.sol";

/**
 * @title PredictionMarket
 * @notice Bet SCORE tokens on whether projects will be flagged as scams
 * @dev Users can bet that a project will or won't be marked as scam within a time period
 *
 * Features:
 * - Create prediction markets for any listed project
 * - Bet SCORE on "will be scam" or "will be legit"
 * - Markets resolve after deadline based on trust level
 * - Winners split the pot proportionally
 * - 5% platform fee (burned)
 */
contract PredictionMarket is Ownable, ReentrancyGuard {

    enum MarketStatus {
        Active,      // Accepting bets
        Closed,      // Betting closed, awaiting resolution
        Resolved,    // Outcome determined
        Cancelled    // Market cancelled, refunds available
    }

    enum Outcome {
        Undecided,
        Scam,        // Project marked as scam
        Legit        // Project remained legit
    }

    struct Market {
        uint256 projectId;
        uint256 createdAt;
        uint256 bettingDeadline;    // When betting closes
        uint256 resolutionDeadline; // When market resolves
        uint256 totalScamBets;      // Total SCORE bet on scam
        uint256 totalLegitBets;     // Total SCORE bet on legit
        uint256 totalBettors;
        MarketStatus status;
        Outcome outcome;
        address creator;
    }

    struct Bet {
        uint256 amount;
        bool betOnScam;    // true = bet scam, false = bet legit
        bool claimed;
    }

    // Contracts
    ScoreToken public scoreToken;

    // State
    mapping(uint256 => Market) public markets;           // marketId => Market
    mapping(uint256 => mapping(address => Bet)) public bets; // marketId => user => Bet
    uint256 public marketCount;

    // One active market per project
    mapping(uint256 => uint256) public activeMarketForProject; // projectId => marketId (0 if none)

    // Configuration
    uint256 public minBet = 10 * 10**18;           // 10 SCORE minimum
    uint256 public maxBet = 100_000 * 10**18;      // 100k SCORE maximum
    uint256 public platformFeeBps = 500;            // 5% fee (burned)
    uint256 public minMarketDuration = 7 days;
    uint256 public maxMarketDuration = 90 days;
    uint256 public creationStake = 100 * 10**18;   // 100 SCORE to create market

    // Authorized resolvers
    mapping(address => bool) public resolvers;

    // Events
    event MarketCreated(uint256 indexed marketId, uint256 indexed projectId, uint256 resolutionDeadline, address creator);
    event BetPlaced(uint256 indexed marketId, address indexed bettor, uint256 amount, bool betOnScam);
    event MarketResolved(uint256 indexed marketId, Outcome outcome, uint256 scamPool, uint256 legitPool);
    event WinningsClaimed(uint256 indexed marketId, address indexed bettor, uint256 amount);
    event MarketCancelled(uint256 indexed marketId);
    event RefundClaimed(uint256 indexed marketId, address indexed bettor, uint256 amount);

    constructor(address _initialOwner, address _scoreToken) Ownable(_initialOwner) {
        scoreToken = ScoreToken(_scoreToken);
    }

    // ============ Market Functions ============

    /**
     * @notice Create a new prediction market for a project
     * @param _projectId Project to create market for
     * @param _duration How long until resolution (seconds)
     */
    function createMarket(uint256 _projectId, uint256 _duration) external nonReentrant returns (uint256) {
        require(_duration >= minMarketDuration && _duration <= maxMarketDuration, "Invalid duration");
        require(activeMarketForProject[_projectId] == 0, "Active market exists");

        // Take creation stake
        require(scoreToken.transferFrom(msg.sender, address(this), creationStake), "Stake transfer failed");

        marketCount++;
        uint256 marketId = marketCount;

        uint256 bettingDeadline = block.timestamp + (_duration * 80 / 100); // Betting closes at 80% of duration
        uint256 resolutionDeadline = block.timestamp + _duration;

        markets[marketId] = Market({
            projectId: _projectId,
            createdAt: block.timestamp,
            bettingDeadline: bettingDeadline,
            resolutionDeadline: resolutionDeadline,
            totalScamBets: 0,
            totalLegitBets: 0,
            totalBettors: 0,
            status: MarketStatus.Active,
            outcome: Outcome.Undecided,
            creator: msg.sender
        });

        activeMarketForProject[_projectId] = marketId;

        // Creator's stake goes to legit pool (they believe in the project)
        bets[marketId][msg.sender] = Bet({
            amount: creationStake,
            betOnScam: false,
            claimed: false
        });
        markets[marketId].totalLegitBets = creationStake;
        markets[marketId].totalBettors = 1;

        emit MarketCreated(marketId, _projectId, resolutionDeadline, msg.sender);
        emit BetPlaced(marketId, msg.sender, creationStake, false);

        return marketId;
    }

    /**
     * @notice Place a bet on a market
     * @param _marketId Market to bet on
     * @param _amount Amount of SCORE to bet
     * @param _betOnScam true = bet project is scam, false = bet legit
     */
    function placeBet(uint256 _marketId, uint256 _amount, bool _betOnScam) external nonReentrant {
        Market storage market = markets[_marketId];

        require(market.status == MarketStatus.Active, "Market not active");
        require(block.timestamp < market.bettingDeadline, "Betting closed");
        require(_amount >= minBet && _amount <= maxBet, "Invalid bet amount");
        require(bets[_marketId][msg.sender].amount == 0, "Already bet");

        require(scoreToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        bets[_marketId][msg.sender] = Bet({
            amount: _amount,
            betOnScam: _betOnScam,
            claimed: false
        });

        if (_betOnScam) {
            market.totalScamBets += _amount;
        } else {
            market.totalLegitBets += _amount;
        }
        market.totalBettors++;

        emit BetPlaced(_marketId, msg.sender, _amount, _betOnScam);
    }

    /**
     * @notice Resolve a market (authorized resolvers only)
     * @param _marketId Market to resolve
     * @param _isScam Whether the project was determined to be a scam
     */
    function resolveMarket(uint256 _marketId, bool _isScam) external nonReentrant {
        require(resolvers[msg.sender] || msg.sender == owner(), "Not authorized");

        Market storage market = markets[_marketId];

        require(market.status == MarketStatus.Active || market.status == MarketStatus.Closed, "Cannot resolve");
        require(block.timestamp >= market.bettingDeadline, "Too early");

        market.status = MarketStatus.Resolved;
        market.outcome = _isScam ? Outcome.Scam : Outcome.Legit;

        // Clear active market for project
        activeMarketForProject[market.projectId] = 0;

        emit MarketResolved(_marketId, market.outcome, market.totalScamBets, market.totalLegitBets);
    }

    /**
     * @notice Claim winnings from a resolved market
     */
    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        Bet storage bet = bets[_marketId][msg.sender];

        require(market.status == MarketStatus.Resolved, "Not resolved");
        require(bet.amount > 0, "No bet");
        require(!bet.claimed, "Already claimed");

        bool won = (market.outcome == Outcome.Scam && bet.betOnScam) ||
                   (market.outcome == Outcome.Legit && !bet.betOnScam);

        require(won, "Did not win");

        bet.claimed = true;

        // Calculate winnings
        uint256 totalPool = market.totalScamBets + market.totalLegitBets;
        uint256 winningPool = market.outcome == Outcome.Scam ? market.totalScamBets : market.totalLegitBets;

        // Winner's share of total pool proportional to their bet
        uint256 winnings = (bet.amount * totalPool) / winningPool;

        // Deduct platform fee
        uint256 fee = (winnings * platformFeeBps) / 10000;
        uint256 payout = winnings - fee;

        // Burn the fee
        if (fee > 0) {
            scoreToken.burn(fee);
        }

        require(scoreToken.transfer(msg.sender, payout), "Transfer failed");

        emit WinningsClaimed(_marketId, msg.sender, payout);
    }

    /**
     * @notice Cancel a market (admin only, for edge cases)
     */
    function cancelMarket(uint256 _marketId) external onlyOwner {
        Market storage market = markets[_marketId];
        require(market.status == MarketStatus.Active, "Cannot cancel");

        market.status = MarketStatus.Cancelled;
        activeMarketForProject[market.projectId] = 0;

        emit MarketCancelled(_marketId);
    }

    /**
     * @notice Claim refund from cancelled market
     */
    function claimRefund(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        Bet storage bet = bets[_marketId][msg.sender];

        require(market.status == MarketStatus.Cancelled, "Not cancelled");
        require(bet.amount > 0, "No bet");
        require(!bet.claimed, "Already claimed");

        bet.claimed = true;

        require(scoreToken.transfer(msg.sender, bet.amount), "Transfer failed");

        emit RefundClaimed(_marketId, msg.sender, bet.amount);
    }

    // ============ View Functions ============

    function getMarket(uint256 _marketId) external view returns (Market memory) {
        return markets[_marketId];
    }

    function getBet(uint256 _marketId, address _user) external view returns (Bet memory) {
        return bets[_marketId][_user];
    }

    function getOdds(uint256 _marketId) external view returns (uint256 scamOdds, uint256 legitOdds) {
        Market memory market = markets[_marketId];
        uint256 total = market.totalScamBets + market.totalLegitBets;

        if (total == 0) return (5000, 5000); // 50/50

        scamOdds = (market.totalScamBets * 10000) / total;
        legitOdds = (market.totalLegitBets * 10000) / total;
    }

    function getPotentialWinnings(uint256 _marketId, uint256 _amount, bool _betOnScam) external view returns (uint256) {
        Market memory market = markets[_marketId];

        uint256 newTotal = market.totalScamBets + market.totalLegitBets + _amount;
        uint256 winningPool = _betOnScam
            ? market.totalScamBets + _amount
            : market.totalLegitBets + _amount;

        uint256 grossWinnings = (_amount * newTotal) / winningPool;
        uint256 fee = (grossWinnings * platformFeeBps) / 10000;

        return grossWinnings - fee;
    }

    function getActiveMarkets(uint256 _offset, uint256 _limit) external view returns (Market[] memory) {
        uint256 count = 0;

        // Count active markets
        for (uint256 i = 1; i <= marketCount; i++) {
            if (markets[i].status == MarketStatus.Active) count++;
        }

        if (_offset >= count) return new Market[](0);

        uint256 resultCount = _limit;
        if (_offset + _limit > count) resultCount = count - _offset;

        Market[] memory result = new Market[](resultCount);
        uint256 found = 0;
        uint256 added = 0;

        for (uint256 i = 1; i <= marketCount && added < resultCount; i++) {
            if (markets[i].status == MarketStatus.Active) {
                if (found >= _offset) {
                    result[added] = markets[i];
                    added++;
                }
                found++;
            }
        }

        return result;
    }

    // ============ Admin Functions ============

    function setResolver(address _resolver, bool _authorized) external onlyOwner {
        resolvers[_resolver] = _authorized;
    }

    function setConfig(
        uint256 _minBet,
        uint256 _maxBet,
        uint256 _feeBps,
        uint256 _creationStake
    ) external onlyOwner {
        require(_feeBps <= 1000, "Max 10% fee");
        minBet = _minBet;
        maxBet = _maxBet;
        platformFeeBps = _feeBps;
        creationStake = _creationStake;
    }

    function setDurationLimits(uint256 _min, uint256 _max) external onlyOwner {
        minMarketDuration = _min;
        maxMarketDuration = _max;
    }
}
