// DappScore Browser Extension - Background Service Worker

const API_BASE = 'https://api.dappscore.io/api/v1';

const SUPPORTED_SITES = ['etherscan.io', 'basescan.org', 'dexscreener.com'];

// ── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'GET_TRUST_SCORE') {
    fetchProjectByAddress(request.address)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // keep channel open for async response
  }

  if (request.type === 'OPEN_DAPPSCORE') {
    chrome.tabs.create({ url: `https://app.dappscore.io/projects/${request.projectId}` });
  }
});

async function fetchProjectByAddress(address) {
  const res = await fetch(`${API_BASE}/projects/by-address/${address}`);
  return res.json();
}

// ── Tab badge ───────────────────────────────────────────────────────────────
// Show a green dot on the toolbar icon when the user is on a supported site.

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  const onSupportedSite = SUPPORTED_SITES.some(s => tab.url.includes(s));

  if (onSupportedSite) {
    chrome.action.setBadgeText({ tabId, text: '✓' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#10B981' });
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
});
