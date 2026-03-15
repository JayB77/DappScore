# Project Ownership

Project ownership allows team members to manage and update their listings on DappScore.

## Claiming Ownership

Ownership is verified by signing a message with the **project's owner wallet** — the deployer address or a wallet the team controls. A signature from an unrelated wallet will not confer any special trust status.

> **Concerned about signing on a third-party site?** That's a reasonable concern. Message signing never exposes your private key and cannot move funds, but we understand teams may prefer to avoid using their primary deployer wallet on any external site. Alternative verification methods are on the roadmap — see [Alternative Verification](#alternative-verification) below.

### During Submission

1. On Step 1 of the submission form, check "I am a team member of this project"
2. Click "Sign Message to Verify"
3. Your wallet will prompt you to sign a message
4. Message format:
   ```
   I verify ownership of [Project Name] ([Symbol]) on DappScore.

   Wallet: [Your Address]
   Timestamp: [Unix Timestamp]
   ```
5. Once signed, you'll see "Ownership Verified"

### After Submission

Coming soon: Claim ownership of existing listings.

### Alternative Verification

Wallet signing is the only supported method today. Here are the methods planned, ranked by how little trust they require from either party:

---

#### 1. On-chain ownership read *(no signing required)*

The cleanest option for crypto projects. Most ERC-20 and DeFi contracts expose a public `owner()` or `admin()` function. DappScore can call that function directly and compare the returned address to your connected wallet.

- **No signature, no interaction** — you just connect the right wallet
- Fully trustless: the check happens against the chain, not our database
- Works for any contract that implements `Ownable` or equivalent
- If your contract uses a Gnosis Safe or multisig as owner, that address is what gets checked

This is the method we'd most like to ship first. If your contract has an `owner()` function, this would already work today in theory.

---

#### 2. DNS TXT record

Add a TXT record to your project domain:

```
dappscore-verify=<your-verification-token>
```

DappScore checks the record via a DNS lookup from our backend. No wallet involved — team controls the domain, that's sufficient proof.

- Works for any project with a domain
- Standard practice (same approach as Google Search Console, Stripe, etc.)
- Record can be removed after verification if desired

---

#### 3. Well-known URL

Place a small file at a predictable path on your project's website:

```
https://yourproject.io/.well-known/dappscore.txt
```

File contents: your verification token. DappScore fetches it server-side.

- No wallet, no DNS access needed — just web hosting
- Same pattern as `apple-app-site-association`, `assetlinks.json`, etc.

---

#### 4. GitHub file

Commit a verification file to the root of your public repo:

```
/.well-known/dappscore.txt
```

DappScore checks via the GitHub API. Useful for open-source projects where the repo is the canonical source of truth.

---

#### 5. Multisig / Gnosis Safe

If your team already uses a Safe, connect it via WalletConnect. Verification becomes a Safe transaction, meaning multiple team members sign, the approval is transparent on-chain, and no individual's personal wallet is ever involved.

---

If any of these would unblock your team sooner, [open a request](https://github.com/DappScore/platform_private/issues) and we'll prioritise accordingly.

## Owner Capabilities

Verified project owners can:

- **Edit Listing** - Update project information anytime
- **Respond to Comments** - Engage with community feedback (coming soon)
- **View Analytics** - See voting and view statistics (coming soon)
- **Manage Team** - Add additional verified team members (coming soon)

## Editing Your Project

1. Navigate to your project page
2. Click the blue "Edit Project" button (only visible to owners)
3. Sign a verification message
4. Update any information:
   - General info (name, description, category)
   - Contract addresses
   - Links and social media
5. Click "Save Changes"

## Multiple Owners

A project can have multiple verified owners:
- Each team member verifies with their own wallet
- All owners have equal editing privileges
- Owner list is visible on project page (coming soon)

## Ownership Transfer

To transfer ownership:
- Contact DappScore team
- Both parties must verify identity
- Signed transfer will be recorded on-chain

## Security

### Wallet Security
- Your private keys are never shared
- Signatures are verified on-chain
- Always verify you're on dappscore.io

### Verification Message
- Includes project details
- Includes timestamp to prevent replay
- Cannot be reused for other projects

## FAQ

**Q: Can I verify ownership with a different wallet later?**
A: Yes, you can add additional owner wallets (coming soon).

**Q: What if I lose access to my wallet?**
A: Contact team with proof of ownership for manual recovery.

**Q: Can ownership be revoked?**
A: Yes, for Terms of Service violations or at project request.
