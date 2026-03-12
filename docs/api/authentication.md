# Authentication & API Keys

Most DappScore API endpoints are public and require no credentials. You only need an API key for **write operations** (e.g. updating token sale progress) or managing **webhooks** programmatically.

---

## Managing Keys via the Dashboard

The easiest way to create and manage API keys is through the web app — no code required:

1. Connect your wallet at [dappscore.io/dashboard](https://dappscore.io/dashboard)
2. Click the **API Keys** tab
3. Hit **New Key**, choose a name and permissions, and optionally scope it to a project

The full key is displayed once after creation (with a copy button). After that, only the prefix is shown. Use **Rotate** to replace a lost key or **Revoke** to permanently disable one.

For scripting, CI/CD pipelines, or bulk operations, use the API endpoints below.

---

## How Authentication Works

All API key endpoints require your wallet address in the `x-user-id` header. This is how the API identifies you as the owner of the keys you're managing.

```bash
-H "x-user-id: 0xYourWalletAddress"
```

Once you have a key, authenticated endpoints use a standard Bearer token:

```bash
-H "Authorization: Bearer sk_test_..."
```

---

## Creating an API Key

```bash
curl -X POST https://dappscore.io/api/v1/api-keys \
  -H "x-user-id: 0xYourWalletAddress" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Sale Dashboard",
    "permissions": ["sale:write"],
    "projectId": "0xYourContractAddress"
  }'
```

**Request body:**

| Field | Required | Description |
|---|---|---|
| `name` | Yes | A label for this key (max 100 chars) |
| `permissions` | Yes | Array of permissions (see below) |
| `projectId` | No | Scope the key to a specific contract address |

**Response** (key shown once only):

```json
{
  "id": "key_abc123",
  "key": "sk_test_a1b2c3d4e5f6...",
  "keyPrefix": "sk_test_a1b2c3",
  "name": "My Sale Dashboard",
  "permissions": ["sale:write"],
  "projectId": "0xYourContractAddress",
  "active": true,
  "_warning": "Save this key now — it will not be shown again."
}
```

{% hint style="warning" %}
**Copy the key immediately.** Only the prefix is stored — the full key cannot be retrieved again. If you lose it, rotate the key to get a new one.
{% endhint %}

You can have up to **10 active keys** per wallet.

---

## Permissions

| Permission | What it allows |
|---|---|
| `sale:write` | Create and update token sale progress for your project |
| `webhooks:manage` | Register, update, and delete webhooks via API |
| `data:read` | Read-only access to project and analytics data |

---

## Using a Key

Pass your key as a Bearer token:

```bash
curl -X POST https://dappscore.io/api/v1/projects/0xYourContract/sale \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{ "raised": 250000, "goal": 1000000, "currency": "USDC" }'
```

---

## Managing Your Keys

**List all your keys** (secret values are never returned, only the prefix):

```bash
curl https://dappscore.io/api/v1/api-keys \
  -H "x-user-id: 0xYourWalletAddress"
```

**Rename a key:**

```bash
curl -X PATCH https://dappscore.io/api/v1/api-keys/key_abc123 \
  -H "x-user-id: 0xYourWalletAddress" \
  -H "Content-Type: application/json" \
  -d '{ "name": "New Name" }'
```

**Rotate a key** (atomically revokes the old one and issues a new key with the same settings):

```bash
curl -X POST https://dappscore.io/api/v1/api-keys/key_abc123/rotate \
  -H "x-user-id: 0xYourWalletAddress"
```

**Revoke a key** (permanent):

```bash
curl -X DELETE https://dappscore.io/api/v1/api-keys/key_abc123 \
  -H "x-user-id: 0xYourWalletAddress"
```
