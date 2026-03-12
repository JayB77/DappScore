# 🔑 Authentication & API Keys

Most DappScore API endpoints are public. You only need an API key when you want to **write data** (e.g. update token sale progress) or manage **webhooks and alerts** programmatically.

---

## Step 1 — Connect Your Wallet

API keys are tied to your wallet address. Before creating one you need a connected wallet on [dappscore.io](https://dappscore.io).

{% hint style="info" %}
No wallet? Follow the [Getting Started](../getting-started.md) guide first.
{% endhint %}

---

## Step 2 — Create an API Key

1. Go to **Settings → API Keys** on [dappscore.io](https://dappscore.io)
2. Click **Create New Key**
3. Give it a descriptive name (e.g. `My Sale Dashboard`)
4. Select the permissions you need (see below)
5. Optionally scope it to a specific project
6. Click **Create**

{% hint style="warning" %}
**Copy the key immediately.** It is shown only once and cannot be retrieved again. If you lose it, rotate it to generate a new one.
{% endhint %}

The key will look like:

```
YOUR_API_KEY
```

---

## Permissions

Choose the minimum permissions your integration needs:

| Permission | What it allows |
|---|---|
| `data:read` | Read-only access to project and analytics data |
| `sale:write` | Create and update token sale progress for your project |
| `webhooks:manage` | Register, update, and delete webhooks via API |

---

## Step 3 — Make Your First Authenticated Request

Pass your key as a Bearer token in the `Authorization` header:

```bash
curl https://us-central1-<project>.cloudfunctions.net/api/v1/projects/0xYourContract/sale \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Or in JavaScript:

```javascript
const res = await fetch('https://us-central1-<project>.cloudfunctions.net/api/v1/projects/0xYourContract/sale', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    raised: 250000,
    goal: 1000000,
    currency: 'USDC',
    tokenPrice: 0.05,
    startDate: 1711929600,
    endDate: 1714521600,
  }),
});

const data = await res.json();
console.log(data);
```

---

## User-Scoped Endpoints

For alerts, webhooks, and API key management, pass your wallet address in the `x-user-id` header instead:

```bash
curl https://us-central1-<project>.cloudfunctions.net/api/v1/alerts \
  -H "x-user-id: 0xYourWalletAddress"
```

---

## Rotating or Revoking a Key

| Action | How |
|--------|-----|
| **Rotate** | Settings → API Keys → your key → **Rotate** — issues a new key, old one immediately invalidated |
| **Revoke** | Settings → API Keys → your key → **Revoke** — permanently deletes the key |

You can also rotate via the API itself:

```bash
curl -X POST https://us-central1-<project>.cloudfunctions.net/api/v1/api-keys/key_abc123/rotate \
  -H "x-user-id: 0xYourWalletAddress"
```

{% hint style="info" %}
You can have up to **10 active API keys** per wallet. Use separate keys for separate integrations so you can revoke them independently.
{% endhint %}
