# Voting & Reputation

The voting and reputation system is at the core of DappScore's community-driven approach.

## Voting on Projects

### How to Vote

1. Connect your wallet
2. Navigate to a project page
3. Review the project details
4. Click **Trust** (upvote) or **Distrust** (downvote)
5. Earn $SCORE tokens for voting

### Vote Weight

Your vote's impact depends on your reputation:

| Reputation | Level | Vote Weight |
|------------|-------|-------------|
| 0-99 | New | 1x |
| 100-499 | Member | 1x |
| 500-999 | Active | 2x |
| 1000+ | Trusted | 3x |

A "Trusted" user's vote counts 3x more than a "New" user's vote.

## Comment Voting

Comments also have upvote/downvote functionality:

- Upvote quality, helpful comments
- Downvote spam or misleading information
- Comment votes affect the commenter's reputation

## Reputation System

### Earning Reputation

| Action | Reputation Gained |
|--------|-------------------|
| Vote on a project | +5 |
| Comment upvoted | +10 per upvote |
| Report confirmed scam | +100 |
| Quality contributor badge | +500 |

### Losing Reputation

| Action | Reputation Lost |
|--------|-----------------|
| Comment downvoted | -5 per downvote |
| False scam report | -50 |
| Terms violation | -100 to -1000 |

### Reputation Badges

| Badge | Requirement | Perks |
|-------|-------------|-------|
| New | 0-99 rep | Basic access |
| Member | 100-499 rep | Badge displayed |
| Active | 500-999 rep | 2x vote weight |
| Trusted | 1000+ rep | 3x vote weight |

## Trust Score Calculation

A project's trust score is calculated as:

```
Trust Score = (Weighted Upvotes / Total Weighted Votes) × 100
```

Where:
- Weighted Upvotes = Sum of (upvote × voter's weight)
- Total Weighted Votes = Weighted Upvotes + Weighted Downvotes

### Example

If a project has:
- 10 upvotes from "Trusted" users (3x weight each) = 30
- 5 upvotes from "New" users (1x weight each) = 5
- 5 downvotes from "Member" users (1x weight each) = 5

Trust Score = (30 + 5) / (30 + 5 + 5) × 100 = 87.5%

## Trust Levels

Based on trust score and vote count:

| Level | Score Range | Min Votes |
|-------|-------------|-----------|
| New Listing | Any | <10 |
| Trusted | 70-100% | 10+ |
| Neutral | 40-69% | 10+ |
| Suspicious | 20-39% | 10+ |
| Suspected Scam | 0-19% | 10+ |

## Gaming Prevention

- One vote per wallet per project
- Reputation decay for inactive accounts
- Sybil resistance through on-chain verification
- Admin review for suspicious patterns
