# Social Proof

Displays real community size metrics from Discord and Telegram — positive signals of an active, legitimate project.

***

## What It Shows

| Metric                 | Source                    | Notes                        |
| ---------------------- | ------------------------- | ---------------------------- |
| 💬 **Discord Members** | Discord public invite API | Total member count           |
| 🟢 **Online Now**      | Discord public invite API | Currently online count       |
| ✈️ **Telegram**        | Telegram link             | Direct link to group/channel |
| 🐦 **Twitter/X**       | Project-provided          | Link to official handle      |

***

## Why This Matters

Scam projects often:

* Have fake Discord servers with no real members
* Use bots to inflate member counts
* Have no Telegram at all
* Use recently created social accounts

Legitimate projects typically have:

* Growing organic communities
* Active discussion channels
* Long-standing accounts

***

## How Discord Data Is Fetched

DappScore uses Discord's **public invite API** — no bot token required. Given a Discord invite link (e.g., `discord.gg/dappscore`), the API returns:

* Server name and icon
* Approximate member count
* Approximate online count

This data is publicly visible to anyone clicking the invite link.

***

## Positive Signals Only

{% hint style="success" %}
Social Proof is a **positive signal only**. A project with no social links is not penalised — some legitimate teams prioritise privacy. A project with a large, active community receives a positive signal that contributes to the DappScore composite rating.
{% endhint %}

***

## Limitations

* Member counts can be inflated by bots — use as a data point alongside other signals
* Discord invites can expire — the panel handles expired links gracefully
* Twitter/X data is display-only; we do not verify account age or follower count (Twitter API v2 requires a paid plan)
