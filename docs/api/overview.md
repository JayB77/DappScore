# Overview

The DappScore API gives developers programmatic access to trust scores, scam detection, whale tracking, project data, and user stats — everything you see on the platform, available as JSON over HTTPS.

{% hint style="info" %}
**Base URL:** `https://us-central1-<your-project>.cloudfunctions.net/api/v1`

Full interactive endpoint reference → [api.dappscore.io](https://dappscore.io/api-docs)
{% endhint %}

***

## What Can You Build?

| Use Case                    | Endpoints                                                               |
| --------------------------- | ----------------------------------------------------------------------- |
| 🔍 **Security scanner**     | Analyse contracts for rug-pull patterns before your users interact      |
| 📊 **Trust badge**          | Embed a live DappScore trust level in your own dApp                     |
| 🐋 **Whale alerts**         | Stream large on-chain transfers to a Telegram bot or dashboard          |
| 📈 **Analytics dashboard**  | Pull global stats, daily charts, and token metrics                      |
| 🔔 **Custom notifications** | Register webhooks to react to scam flags and trust changes in real time |

***

## Quick Overview

| Section                                         | What it covers                                |
| ----------------------------------------------- | --------------------------------------------- |
| [Authentication](authentication.md)             | Creating API keys, sending requests           |
| [Quick Start](quickstart.md)                    | Your first API call in under 5 minutes        |
| [Full Reference](https://dappscore.io/api-docs) | Every endpoint, parameter, and response shape |

***

## Public vs Authenticated Endpoints

Most read endpoints are **completely public** — no key needed.

| Access Level | Header Required                     | Examples                                            |
| ------------ | ----------------------------------- | --------------------------------------------------- |
| **Public**   | None                                | Browse projects, trust scores, stats, scam patterns |
| **User**     | `x-user-id: <wallet>`               | Alerts, webhooks, API key management                |
| **API Key**  | `Authorization: Bearer sk_live_...` | Write sale data, scoped project access              |

{% hint style="success" %}
You can make your first API call right now — no sign-up required. Try fetching a project's trust score in your browser or with `curl`.
{% endhint %}
