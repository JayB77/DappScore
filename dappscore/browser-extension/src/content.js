// DappScore Browser Extension - Content Script
// Injects trust badges on supported sites (Etherscan, BaseScan, DexScreener)

const API_URL = 'https://api.dappscore.io';

const TRUST_LEVELS = {
  0: { label: 'New', color: '#6B7280', bg: '#374151' },
  1: { label: 'Trusted', color: '#10B981', bg: '#064E3B' },
  2: { label: 'Neutral', color: '#F59E0B', bg: '#78350F' },
  3: { label: 'Suspicious', color: '#F97316', bg: '#7C2D12' },
  4: { label: 'Scam Alert', color: '#EF4444', bg: '#7F1D1D' },
  5: { label: 'SCAM', color: '#DC2626', bg: '#7F1D1D' },
};

// Cache for API responses
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Detect which site we're on
function detectSite() {
  const hostname = window.location.hostname;

  if (hostname.includes('etherscan.io') || hostname.includes('basescan.org')) {
    return 'etherscan';
  }
  if (hostname.includes('dexscreener.com')) {
    return 'dexscreener';
  }

  return null;
}

// Extract contract addresses from page
function extractAddresses() {
  const addresses = new Set();

  // Look for 0x addresses in the page
  const text = document.body.innerText;
  const matches = text.match(/0x[a-fA-F0-9]{40}/g) || [];

  matches.forEach(addr => addresses.add(addr.toLowerCase()));

  // Also check URL
  const urlMatch = window.location.href.match(/0x[a-fA-F0-9]{40}/);
  if (urlMatch) {
    addresses.add(urlMatch[0].toLowerCase());
  }

  return Array.from(addresses);
}

// Fetch trust score from API
async function fetchTrustScore(address) {
  // Check cache
  const cached = cache.get(address);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(`${API_URL}/api/projects?address=${address}`);
    const data = await response.json();

    if (data.data && data.data.length > 0) {
      const project = data.data[0];
      const upvotes = parseInt(project.upvotes) || 0;
      const downvotes = parseInt(project.downvotes) || 0;
      const total = upvotes + downvotes;

      const result = {
        found: true,
        project: project.name,
        trustLevel: project.trustLevel,
        score: total > 0 ? Math.round((upvotes / total) * 100) : 50,
        voters: total,
        id: project.id,
      };

      cache.set(address, { data: result, timestamp: Date.now() });
      return result;
    }
  } catch (error) {
    console.error('DappScore: Error fetching trust score', error);
  }

  return { found: false };
}

// Create trust badge element
function createBadge(data) {
  const trustInfo = TRUST_LEVELS[data.trustLevel] || TRUST_LEVELS[0];

  const badge = document.createElement('div');
  badge.className = 'dappscore-badge';
  badge.setAttribute('data-dappscore', 'true');

  badge.innerHTML = `
    <div class="dappscore-badge-inner" style="
      background: ${trustInfo.bg};
      color: ${trustInfo.color};
    ">
      <span class="dappscore-icon">🛡️</span>
      <span class="dappscore-score">${data.score}%</span>
      <span class="dappscore-label">${trustInfo.label}</span>
    </div>
    <div class="dappscore-tooltip">
      <div class="dappscore-tooltip-title">${data.project}</div>
      <div class="dappscore-tooltip-score">Trust Score: ${data.score}%</div>
      <div class="dappscore-tooltip-voters">${data.voters} community votes</div>
      <a href="https://dappscore.io/projects/${data.id}" target="_blank" class="dappscore-tooltip-link">
        View on DappScore →
      </a>
    </div>
  `;

  return badge;
}

// Create warning banner for scam projects
function createWarningBanner(data) {
  const banner = document.createElement('div');
  banner.className = 'dappscore-warning-banner';
  banner.setAttribute('data-dappscore', 'true');

  banner.innerHTML = `
    <div class="dappscore-warning-content">
      <span class="dappscore-warning-icon">⚠️</span>
      <div class="dappscore-warning-text">
        <strong>DappScore Warning:</strong> This contract has been flagged as a potential scam by the community.
        <a href="https://dappscore.io/projects/${data.id}" target="_blank">Learn more</a>
      </div>
      <button class="dappscore-warning-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  return banner;
}

// Inject badges for Etherscan/BaseScan
function injectEtherscanBadges(address, data) {
  // Find the contract title/header
  const titleElement = document.querySelector('#ContentPlaceHolder1_divSummary, .card-header');

  if (titleElement && !titleElement.querySelector('[data-dappscore]')) {
    const badge = createBadge(data);
    badge.style.marginLeft = '12px';
    badge.style.display = 'inline-flex';
    titleElement.appendChild(badge);

    // Show warning banner for scams
    if (data.trustLevel >= 4) {
      const banner = createWarningBanner(data);
      const container = document.querySelector('#ContentPlaceHolder1_maintable, .container-xxl');
      if (container) {
        container.insertBefore(banner, container.firstChild);
      }
    }
  }
}

// Inject badges for DexScreener
function injectDexScreenerBadges(address, data) {
  // Find token name elements
  const tokenHeaders = document.querySelectorAll('[class*="TokenName"], [class*="token-name"]');

  tokenHeaders.forEach(header => {
    if (!header.querySelector('[data-dappscore]')) {
      const badge = createBadge(data);
      badge.style.marginLeft = '8px';
      header.appendChild(badge);
    }
  });

  // Show warning for scams
  if (data.trustLevel >= 4) {
    const existingWarning = document.querySelector('.dappscore-warning-banner');
    if (!existingWarning) {
      const banner = createWarningBanner(data);
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }
}

// Main function
async function init() {
  const site = detectSite();
  if (!site) return;

  console.log('DappScore: Initializing on', site);

  const addresses = extractAddresses();

  for (const address of addresses) {
    const data = await fetchTrustScore(address);

    if (data.found) {
      console.log('DappScore: Found project', data.project, 'with score', data.score);

      if (site === 'etherscan') {
        injectEtherscanBadges(address, data);
      } else if (site === 'dexscreener') {
        injectDexScreenerBadges(address, data);
      }
    }
  }
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Watch for dynamic content changes (for SPAs like DexScreener)
const observer = new MutationObserver(() => {
  // Debounce
  clearTimeout(window.dappscoreTimeout);
  window.dappscoreTimeout = setTimeout(init, 1000);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

console.log('DappScore: Content script loaded');
