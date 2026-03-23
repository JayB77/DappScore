// DappScore Browser Extension - Content Script
// Injects trust badges on Etherscan, BaseScan, and DexScreener.

const API_BASE = 'https://api.dappscore.io';

const TRUST_LEVELS = {
  0: { label: 'New',         color: '#6B7280', bg: '#1f2937' },
  1: { label: 'Trusted',     color: '#10B981', bg: '#064E3B' },
  2: { label: 'Neutral',     color: '#F59E0B', bg: '#78350F' },
  3: { label: 'Suspicious',  color: '#F97316', bg: '#7C2D12' },
  4: { label: 'Scam Alert',  color: '#EF4444', bg: '#7F1D1D' },
  5: { label: 'SCAM',        color: '#DC2626', bg: '#7F1D1D' },
};

// Per-address cache (5-minute TTL) and a Set of already-injected addresses
const cache    = new Map();   // address → { data, ts }
const injected = new Set();   // addresses whose badges are already on the page
const CACHE_TTL = 5 * 60 * 1000;

// ── Site detection ─────────────────────────────────────────────────────────

function detectSite() {
  const h = window.location.hostname;
  if (h.includes('etherscan.io') || h.includes('basescan.org')) return 'etherscan';
  if (h.includes('dexscreener.com'))                             return 'dexscreener';
  return null;
}

// ── Address extraction ──────────────────────────────────────────────────────
// Read the primary contract address from the URL path rather than scanning
// the entire page body (which would catch wallets, tx hashes, etc.).

function extractPrimaryAddress() {
  const path = window.location.pathname;

  // Etherscan/BaseScan: /token/0x..., /address/0x..., /nft/0x.../
  const pathMatch = path.match(/\/(?:token|address|nft)\/?(0x[a-fA-F0-9]{40})/i);
  if (pathMatch) return pathMatch[1].toLowerCase();

  // DexScreener: /chain/0xPairAddress
  const dexMatch = path.match(/\/[a-z]+\/(0x[a-fA-F0-9]{40})/i);
  if (dexMatch) return dexMatch[1].toLowerCase();

  return null;
}

// ── API helpers ─────────────────────────────────────────────────────────────

async function fetchProject(address) {
  const cached = cache.get(address);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const res = await fetch(`${API_BASE}/api/v1/projects/by-address/${address}`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (res.status === 404) {
      cache.set(address, { data: null, ts: Date.now() });
      return null;
    }
    const json = await res.json();
    const data = json.data ?? null;
    cache.set(address, { data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}

// For DexScreener, resolve the pair address → base token address via
// DexScreener's own public API, then look that up in DappScore.
async function resolveTokenFromPair(pairAddress, chain) {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/${chain}/${pairAddress}`,
      { signal: AbortSignal.timeout(6_000) },
    );
    const json = await res.json();
    const baseToken = json?.pair?.baseToken?.address;
    return baseToken ? baseToken.toLowerCase() : null;
  } catch {
    return null;
  }
}

// ── Badge / banner DOM helpers ──────────────────────────────────────────────

function createBadge(project) {
  const ti = TRUST_LEVELS[project.trustLevel] ?? TRUST_LEVELS[0];
  const votes = (project.votesFor ?? 0) + (project.votesAgainst ?? 0);
  const score = votes > 0
    ? Math.round((project.votesFor / votes) * 100)
    : (project.trustScore ?? 50);

  const badge = document.createElement('span');
  badge.setAttribute('data-dappscore', 'true');
  badge.className = 'dappscore-badge';
  badge.innerHTML = `
    <span class="dappscore-badge-inner" style="background:${ti.bg};color:${ti.color}">
      <span class="dappscore-icon">🛡️</span>
      <span class="dappscore-score">${score}%</span>
      <span class="dappscore-label">${ti.label}</span>
    </span>
    <span class="dappscore-tooltip">
      <span class="dappscore-tooltip-title">${escapeHtml(project.name)}</span>
      <span class="dappscore-tooltip-score">Trust Score: ${score}%</span>
      <span class="dappscore-tooltip-voters">${votes.toLocaleString()} community votes</span>
      <a href="https://app.dappscore.io/projects/${project.id}"
         target="_blank" rel="noopener"
         class="dappscore-tooltip-link">View on DappScore →</a>
    </span>`;
  return badge;
}

function createWarningBanner(project) {
  const banner = document.createElement('div');
  banner.className = 'dappscore-warning-banner';
  banner.setAttribute('data-dappscore', 'true');
  banner.innerHTML = `
    <div class="dappscore-warning-content">
      <span class="dappscore-warning-icon">⚠️</span>
      <span class="dappscore-warning-text">
        <strong>DappScore Warning:</strong>
        <em>${escapeHtml(project.name)}</em> has been flagged as a potential scam by the community.
        <a href="https://app.dappscore.io/projects/${project.id}"
           target="_blank" rel="noopener">View report</a>
      </span>
      <button class="dappscore-warning-close" aria-label="Dismiss">×</button>
    </div>`;
  banner.querySelector('.dappscore-warning-close').addEventListener('click', () => banner.remove());
  return banner;
}

function escapeHtml(str) {
  const d = document.createElement('span');
  d.textContent = str;
  return d.innerHTML;
}

// ── Site-specific injection ─────────────────────────────────────────────────

function injectEtherscan(project) {
  // Try several selectors to cover Etherscan's UI versions (old + new)
  const anchor =
    document.querySelector('#ContentPlaceHolder1_divSummary .card-header') ||
    document.querySelector('.card-header:has(h6)') ||
    document.querySelector('h1.h5')                ||
    document.querySelector('h1[class*="heading"]') ||
    document.querySelector('.d-flex.align-items-center h6');

  if (anchor && !anchor.querySelector('[data-dappscore]')) {
    const badge = createBadge(project);
    badge.style.cssText = 'display:inline-flex;vertical-align:middle;margin-left:10px';
    anchor.appendChild(badge);
  }

  if (project.trustLevel >= 4) {
    if (!document.querySelector('.dappscore-warning-banner')) {
      const banner = createWarningBanner(project);
      document.body.prepend(banner);
    }
  }
}

function injectDexScreener(project) {
  // DexScreener uses hashed Chakra UI classes — target structural positions
  // that have been stable: the top-of-page pair name heading.
  const anchor =
    document.querySelector('[class*="pairHeader"] h1')  ||
    document.querySelector('[class*="pair-header"] h1') ||
    document.querySelector('main h1')                   ||
    document.querySelector('header h1');

  if (anchor && !anchor.querySelector('[data-dappscore]')) {
    const badge = createBadge(project);
    badge.style.cssText = 'display:inline-flex;vertical-align:middle;margin-left:8px';
    anchor.appendChild(badge);
  }

  if (project.trustLevel >= 4) {
    if (!document.querySelector('.dappscore-warning-banner')) {
      const banner = createWarningBanner(project);
      document.body.prepend(banner);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function run() {
  const site = detectSite();
  if (!site) return;

  const rawAddress = extractPrimaryAddress();
  if (!rawAddress) return;

  // Skip non-contract pages (tx hashes, blocks, etc.)
  // Our extractPrimaryAddress already guards this, but double-check the path.
  const path = window.location.pathname;
  if (site === 'etherscan' && !/\/(token|address|nft)\//i.test(path)) return;
  if (site === 'dexscreener' && path.split('/').filter(Boolean).length < 2)   return;

  let lookupAddress = rawAddress;

  // For DexScreener, the URL holds the pair address, not the token contract.
  // Resolve it to the base token address before looking up DappScore.
  if (site === 'dexscreener') {
    const chainSlug = window.location.pathname.split('/')[1] ?? 'ethereum';
    const tokenAddr = await resolveTokenFromPair(rawAddress, chainSlug);
    if (tokenAddr) lookupAddress = tokenAddr;
  }

  // Skip if we've already injected for this address this session
  if (injected.has(lookupAddress)) return;

  const project = await fetchProject(lookupAddress);
  if (!project) return;

  injected.add(lookupAddress);

  if (site === 'etherscan') {
    injectEtherscan(project);
  } else if (site === 'dexscreener') {
    injectDexScreener(project);
  }
}

// Run immediately and again after SPA navigations (DexScreener is a React SPA)
run();

let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    injected.clear(); // new page → allow re-injection
    clearTimeout(window.__dappscoreTimer);
    window.__dappscoreTimer = setTimeout(run, 800);
  }
});
observer.observe(document.body, { childList: true, subtree: true });
