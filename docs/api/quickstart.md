# Quick Start

Get live DappScore data into your app in under 5 minutes. No API key required for read-only data.

***

## 1. Fetch a Trust Score (No Auth)

Look up any project by its contract address:

```bash
curl https://us-central1-<project>.cloudfunctions.net/api/v1/projects/0xYourContractAddress
```

**Response:**

```json
{
  "data": {
    "id": "0xYourContractAddress",
    "name": "My Project",
    "trustScore": 84,
    "trustLevel": 4,
    "votes": 1240,
    "scamFlag": false,
    "chain": "ethereum",
    "category": "defi"
  }
}
```

***

## 2. Scan a Contract for Risks (No Auth)

```bash
curl -X POST https://us-central1-<project>.cloudfunctions.net/api/v1/scam/analyze \
  -H "Content-Type: application/json" \
  -d '{"contractAddress": "0xYourContractAddress", "network": "mainnet"}'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "riskScore": 22,
    "riskLevel": "low",
    "flags": [],
    "analyzedAt": "2024-03-12T10:15:00Z"
  }
}
```

| Risk Level | Score Range | Meaning                       |
| ---------- | ----------- | ----------------------------- |
| `low`      | 0–25        | No significant concerns       |
| `medium`   | 26–50       | Some caution advised          |
| `high`     | 51–75       | Multiple risk factors present |
| `critical` | 76–100      | Serious red flags — avoid     |

***

## 3. Get Trending Projects (No Auth)

```bash
curl "https://us-central1-<project>.cloudfunctions.net/api/v1/projects/trending?timeframe=24h&limit=5"
```

***

## 4. Track Whale Activity (No Auth)

```bash
curl "https://us-central1-<project>.cloudfunctions.net/api/v1/whales/0xTokenAddress/analysis"
```

***

## 5. Publish Sale Progress (API Key Required)

If you're a project running a token sale, push live fundraising data to your DappScore listing:

```javascript
await fetch('https://us-central1-<project>.cloudfunctions.net/api/v1/projects/0xYourContract/sale', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    raised: 450000,       // amount raised so far
    goal: 1000000,        // fundraising target
    currency: 'USDC',
    tokenPrice: 0.05,
    startDate: 1711929600, // Unix timestamp
    endDate: 1714521600,   // Unix timestamp
  }),
});
```

The live progress will immediately appear on your project's listing page. Call this endpoint whenever your figures update — it's idempotent.

{% hint style="info" %}
Need a key? See [Authentication](authentication.md) to create one with `sale:write` permission.
{% endhint %}

***

## 6. Receive Real-Time Alerts via Webhook

Register a webhook to get notified the moment a project is flagged as a scam, a trust level changes, or a whale moves funds:

```bash
curl -X POST https://us-central1-<project>.cloudfunctions.net/api/v1/webhooks/register \
  -H "x-user-id: 0xYourWalletAddress" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourapp.com/hooks/dappscore",
    "events": ["project.scam_flagged", "project.trust_changed", "whale.activity"]
  }'
```

DappScore will `POST` a signed JSON payload to your URL whenever one of those events fires. Verify the signature using the `X-DappScore-Signature` header (HMAC-SHA256 of the raw body with your webhook secret).

| Event                   | When it fires                              |
| ----------------------- | ------------------------------------------ |
| `project.trust_changed` | A project's trust level goes up or down    |
| `project.scam_flagged`  | Community or automated scam flag is raised |
| `project.created`       | A new project is listed                    |
| `vote.cast`             | A vote is submitted on any project         |
| `whale.activity`        | A large token transfer is detected         |
| `market.resolved`       | A prediction market closes                 |
| `bounty.completed`      | A bounty is awarded                        |

***

## JavaScript SDK Snippet

```javascript
const DAPPSCORE_BASE = 'https://us-central1-<project>.cloudfunctions.net/api/v1';

async function getTrustScore(contractAddress) {
  const res = await fetch(`${DAPPSCORE_BASE}/projects/${contractAddress}`);
  if (!res.ok) throw new Error(`DappScore error: ${res.status}`);
  const { data } = await res.json();
  return data.trustScore; // 0–100
}

async function scanContract(contractAddress, network = 'mainnet') {
  const res = await fetch(`${DAPPSCORE_BASE}/scam/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractAddress, network }),
  });
  const { data } = await res.json();
  return data; // { riskScore, riskLevel, flags }
}
```

***

## Next Steps

|                                                        |                                               |
| ------------------------------------------------------ | --------------------------------------------- |
| 📖 [Full API Reference](https://dappscore.io/api-docs) | Every endpoint, parameter, and response shape |
| 🔑 [Authentication](authentication.md)                 | Create and manage API keys                    |
| ❓ [FAQ](../faq.md)                                     | Common questions                              |
| 💬 [Contact](../support/contact.md)                    | Get help                                      |
