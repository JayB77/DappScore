// DappScore Browser Extension - Background Service Worker

const API_URL = 'https://api.dappscore.io';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_TRUST_SCORE') {
    fetchTrustScore(request.address)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.type === 'OPEN_DAPPSCORE') {
    chrome.tabs.create({ url: `https://dappscore.io/projects/${request.projectId}` });
  }
});

async function fetchTrustScore(address) {
  try {
    const response = await fetch(`${API_URL}/api/projects?address=${address}`);
    return await response.json();
  } catch (error) {
    console.error('DappScore: API error', error);
    throw error;
  }
}

// Badge update based on current tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if it's a supported site
    const supportedSites = ['etherscan.io', 'basescan.org', 'dexscreener.com'];
    const isSupportedSite = supportedSites.some(site => tab.url.includes(site));

    if (isSupportedSite) {
      // Set badge to indicate extension is active
      chrome.action.setBadgeText({ tabId, text: '✓' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#10B981' });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  }
});

console.log('DappScore: Background service worker started');
