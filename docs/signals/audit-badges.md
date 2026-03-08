# 🏅 Audit Badges

Displays security audit records for the project from a registry of 20 recognized audit firms.

---

## What Are Audit Badges?

When a project submits audit information through the project ownership flow, DappScore verifies the audit firm against a curated registry and displays a badge linking to the public report.

---

## Recognized Audit Firms

DappScore's registry includes 20 top audit firms:

| Firm | Tier |
|------|------|
| OpenZeppelin | Elite |
| Trail of Bits | Elite |
| ConsenSys Diligence | Elite |
| Sigma Prime | Elite |
| CertiK | Established |
| Hacken | Established |
| Quantstamp | Established |
| PeckShield | Established |
| SlowMist | Established |
| Code4rena | Competitive |
| Sherlock | Competitive |
| Immunefi | Bug Bounty |
| Halborn | Established |
| Iosiro | Established |
| Least Authority | Established |
| Zokyo | Established |
| Runtime Verification | Formal Verification |
| Cure53 | Web Security |
| Dedaub | Established |
| MixBytes | Established |

---

## What a Badge Shows

| Field | Description |
|-------|-------------|
| 🏅 **Firm name** | Which firm conducted the audit |
| 📅 **Date** | When the audit was completed |
| 🔗 **Report link** | Direct link to the public audit report |
| ✅ **Verified** | DappScore has confirmed the firm is legitimate |

---

## Adding an Audit to Your Project

Project owners can add audit records through the project edit page:

1. Verify project ownership (sign message with deployer wallet)
2. Navigate to "Edit Project"
3. Add audit firm, date, and report URL
4. DappScore validates the firm and displays the badge

---

## Limitations

- Only firms in the registry are recognised — custom or unknown auditors will not display
- DappScore does not re-verify the audit content — we link to the report, not summarise it
- An audit does not guarantee safety — read the report for critical/high findings

{% hint style="warning" %}
An audit badge means the code was reviewed, not that it's bug-free. Always read the report and check how many critical/high issues were found and whether they were resolved.
{% endhint %}
