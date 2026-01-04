# Voting & Reputation

The voting and reputation system is at the core of DappScore's community-driven approach.

---

## Before You Vote

{% hint style="warning" %}
**Do Your Due Diligence!**

Your voting accuracy directly affects your reputation and earnings. Before casting a vote:

- **Research the project** - Check their website, team, social media, and smart contracts
- **Verify claims** - Don't take project descriptions at face value
- **Read comments** - See what other community members have discovered
- **Check the contract** - Look for red flags like mint functions or hidden fees

**Remember:** Voting correctly earns you rewards. Voting incorrectly hurts your reputation, reduces your vote weight, and decreases your future earnings. Take your time!
{% endhint %}

---

## Voting on Projects

### How to Vote

1. Connect your wallet
2. Navigate to a project page
3. **Research the project thoroughly**
4. Review community comments and analysis
5. Click **Trust** (upvote) or **Distrust** (downvote)
6. Earn $SCORE tokens for participating

---

## Vote Weight

Your vote's impact depends on multiple factors:

### Reputation Level

| Reputation | Level | Weight Bonus |
|------------|-------|--------------|
| 0-99 | New | 1x |
| 100-499 | Member | 1x |
| 500-999 | Active | 2x |
| 1000+ | Trusted | 3x |

### Account Age

Older accounts carry more weight to prevent manipulation:

| Account Age | Weight Multiplier |
|-------------|-------------------|
| < 7 days | 0.5x |
| 7-30 days | 0.75x |
| 30-90 days | 1x |
| 90+ days | 1.25x |

### Combined Weight Calculation

```
Final Vote Weight = Reputation Multiplier × Account Age Multiplier
```

**Example:** A "Trusted" user (3x) with a 90+ day account (1.25x) has a vote weight of **3.75x**.

---

## Voting Accuracy & Rewards

{% hint style="info" %}
**Your accuracy matters!** The platform tracks whether your votes align with community consensus over time.
{% endhint %}

### Accuracy Tiers

| Accuracy | Tier | Reward Multiplier |
|----------|------|-------------------|
| 90-100% | Expert | 2x rewards |
| 75-89% | Reliable | 1.5x rewards |
| 50-74% | Average | 1x rewards |
| < 50% | Unreliable | 0.5x rewards |

Voting against eventual consensus hurts your accuracy score, which reduces your future earnings.

---

## Comment Voting

Comments also have upvote/downvote functionality:

- Upvote quality, helpful comments
- Downvote spam or misleading information
- Comment votes affect the commenter's reputation

---

## Reputation System

### Earning Reputation

| Action | Reputation Gained |
|--------|-------------------|
| Vote on a project | +5 |
| Vote aligns with consensus | +10 bonus |
| Comment upvoted | +10 per upvote |
| Report confirmed scam | +100 |
| Quality contributor badge | +500 |

### Losing Reputation

{% hint style="danger" %}
**Protect your reputation!** Lost reputation takes time to rebuild and affects your earnings.
{% endhint %}

| Action | Reputation Lost |
|--------|-----------------|
| Comment downvoted | -5 per downvote |
| Vote against strong consensus | -10 |
| False scam report | -50 |
| Terms violation | -100 to -1000 |

### Reputation Badges

| Badge | Requirement | Perks |
|-------|-------------|-------|
| New | 0-99 rep | Basic access |
| Member | 100-499 rep | Badge displayed |
| Active | 500-999 rep | 2x vote weight |
| Trusted | 1000+ rep | 3x vote weight, priority support |

---

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

Trust Score = (30 + 5) / (30 + 5 + 5) × 100 = **87.5%**

---

## Trust Levels

Based on trust score and vote count:

| Level | Score Range | Min Votes |
|-------|-------------|-----------|
| New Listing | Any | <10 |
| Trusted | 70-100% | 10+ |
| Neutral | 40-69% | 10+ |
| Suspicious | 20-39% | 10+ |
| Suspected Scam | 0-19% | 10+ |

---

## Gaming Prevention

- One vote per wallet per project
- Account age requirements for full vote weight
- Reputation decay for inactive accounts
- Sybil resistance through on-chain verification
- Admin review for suspicious patterns
- Voting accuracy tracking to catch bad actors
