// DappScore Browser Extension - Popup Script

const API_URL = 'https://api.dappscore.io/api/v1';
const WEBSITE_URL = 'https://app.dappscore.io';

const TRUST_LEVELS = {
  0: { label: 'New Listing', class: 'new', color: '#6B7280' },
  1: { label: 'Trusted', class: 'trusted', color: '#10B981' },
  2: { label: 'Neutral', class: 'neutral', color: '#F59E0B' },
  3: { label: 'Suspicious', class: 'suspicious', color: '#F97316' },
  4: { label: 'Suspected Scam', class: 'scam', color: '#EF4444' },
  5: { label: 'Probable Scam', class: 'scam', color: '#DC2626' },
};

// DOM Elements
const searchInput = document.getElementById('searchInput');
const contentDiv = document.getElementById('content');
const recentList = document.getElementById('recentList');

// Load recent checks on popup open
document.addEventListener('DOMContentLoaded', () => {
  loadRecentChecks();

  // Check if we have a contract address from the current page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    const contractMatch = url.match(/0x[a-fA-F0-9]{40}/);
    if (contractMatch) {
      searchInput.value = contractMatch[0];
      performSearch(contractMatch[0]);
    }
  });
});

// Search on enter
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performSearch(searchInput.value.trim());
  }
});

// Debounced search on input
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = searchInput.value.trim();
    if (query.length >= 3) {
      performSearch(query);
    }
  }, 500);
});

async function performSearch(query) {
  if (!query) return;

  showLoading();

  try {
    // Check if it's an address
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query);

    let response;
    if (isAddress) {
      response = await fetch(`${API_URL}/projects/by-address/${query}`);
    } else {
      response = await fetch(`${API_URL}/projects?query=${encodeURIComponent(query)}`);
    }

    const data = await response.json();

    if (isAddress) {
      // by-address returns { data: project } (single object, not array)
      if (data.data) {
        showProjectDetails(data.data);
        saveRecentCheck(data.data);
      } else {
        showNotFound(query);
      }
    } else if (data.data && data.data.length > 0) {
      if (data.data.length === 1) {
        showProjectDetails(data.data[0]);
        saveRecentCheck(data.data[0]);
      } else {
        showSearchResults(data.data);
      }
    } else {
      showNotFound(query);
    }
  } catch (error) {
    console.error('Search error:', error);
    showError();
  }
}

function showLoading() {
  contentDiv.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Checking trust score...</p>
    </div>
  `;
}

function showProjectDetails(project) {
  const trustLevel = TRUST_LEVELS[project.trustLevel] || TRUST_LEVELS[0];
  const upvotes = parseInt(project.upvotes) || 0;
  const downvotes = parseInt(project.downvotes) || 0;
  const total = upvotes + downvotes;
  const score = total > 0 ? Math.round((upvotes / total) * 100) : 50;
  const upPct = total > 0 ? (upvotes / total) * 100 : 50;

  let scoreClass = 'medium';
  if (score >= 70) scoreClass = 'high';
  else if (score < 40) scoreClass = 'low';

  let warningHtml = '';
  if (project.trustLevel >= 4) {
    warningHtml = `
      <div class="warning-banner">
        <span class="icon">⚠️</span>
        <span class="text">
          <strong>Warning!</strong> This project has been flagged by the community as a potential scam.
          Exercise extreme caution.
        </span>
      </div>
    `;
  }

  contentDiv.innerHTML = `
    ${warningHtml}
    <div class="result-card">
      <div class="project-header">
        <div>
          <div class="project-name">${escapeHtml(project.name)}</div>
          <div class="project-symbol">${project.symbol || ''} • ${project.category || 'Uncategorized'}</div>
        </div>
        <span class="trust-badge ${trustLevel.class}">${trustLevel.label}</span>
      </div>

      <div class="trust-score">
        <div class="score-circle ${scoreClass}">${score}%</div>
        <div class="score-details">
          <div>Community Trust Score</div>
          <div class="vote-bar">
            <div class="vote-bar-fill" style="--up: ${upPct}%"></div>
          </div>
          <div class="vote-counts">
            <span>👍 ${upvotes.toLocaleString()}</span>
            <span>👎 ${downvotes.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" onclick="openProject('${project.id}')">
          View Details
        </button>
        <button class="btn btn-secondary" onclick="vote('${project.id}')">
          Vote
        </button>
      </div>
    </div>
  `;
}

function showSearchResults(projects) {
  let html = '';

  projects.slice(0, 5).forEach(project => {
    const trustLevel = TRUST_LEVELS[project.trustLevel] || TRUST_LEVELS[0];
    const upvotes = parseInt(project.upvotes) || 0;
    const downvotes = parseInt(project.downvotes) || 0;
    const total = upvotes + downvotes;
    const score = total > 0 ? Math.round((upvotes / total) * 100) : 50;

    html += `
      <div class="result-card" onclick="selectProject('${project.id}')" style="cursor: pointer;">
        <div class="project-header">
          <div>
            <div class="project-name">${escapeHtml(project.name)}</div>
            <div class="project-symbol">${project.symbol || ''}</div>
          </div>
          <span class="trust-badge ${trustLevel.class}">${score}%</span>
        </div>
      </div>
    `;
  });

  contentDiv.innerHTML = html;
}

function showNotFound(query) {
  contentDiv.innerHTML = `
    <div class="empty-state">
      <div class="icon">🤷</div>
      <p>No projects found for "${escapeHtml(query)}"</p>
      <button class="btn btn-primary" onclick="openSearch('${escapeHtml(query)}')" style="margin-top: 16px;">
        Search on Website
      </button>
    </div>
  `;
}

function showError() {
  contentDiv.innerHTML = `
    <div class="empty-state">
      <div class="icon">❌</div>
      <p>Failed to fetch data. Please try again.</p>
    </div>
  `;
}

// Recent checks
async function loadRecentChecks() {
  const result = await chrome.storage.local.get('recentChecks');
  const recent = result.recentChecks || [];

  if (recent.length === 0) {
    recentList.innerHTML = '<div style="color: #64748B; font-size: 13px;">No recent checks</div>';
    return;
  }

  let html = '';
  recent.slice(0, 5).forEach(item => {
    const trustLevel = TRUST_LEVELS[item.trustLevel] || TRUST_LEVELS[0];
    html += `
      <div class="recent-item" onclick="selectProject('${item.id}')">
        <span class="name">${escapeHtml(item.name)}</span>
        <span class="score" style="color: ${trustLevel.color}">${item.score}%</span>
      </div>
    `;
  });

  recentList.innerHTML = html;
}

async function saveRecentCheck(project) {
  const result = await chrome.storage.local.get('recentChecks');
  let recent = result.recentChecks || [];

  const upvotes = parseInt(project.upvotes) || 0;
  const downvotes = parseInt(project.downvotes) || 0;
  const total = upvotes + downvotes;
  const score = total > 0 ? Math.round((upvotes / total) * 100) : 50;

  // Remove if already exists
  recent = recent.filter(r => r.id !== project.id);

  // Add to front
  recent.unshift({
    id: project.id,
    name: project.name,
    trustLevel: project.trustLevel,
    score,
    timestamp: Date.now(),
  });

  // Keep only last 10
  recent = recent.slice(0, 10);

  await chrome.storage.local.set({ recentChecks: recent });
  loadRecentChecks();
}

// Navigation functions (called from inline onclick)
window.selectProject = async (projectId) => {
  showLoading();
  try {
    const response = await fetch(`${API_URL}/projects/${projectId}`);
    const data = await response.json();
    if (data.data) {
      showProjectDetails(data.data);
      saveRecentCheck(data.data);
    }
  } catch (error) {
    showError();
  }
};

window.openProject = (projectId) => {
  chrome.tabs.create({ url: `${WEBSITE_URL}/projects/${projectId}` });
};

window.openSearch = (query) => {
  chrome.tabs.create({ url: `${WEBSITE_URL}/projects?q=${encodeURIComponent(query)}` });
};

window.vote = (projectId) => {
  chrome.tabs.create({ url: `${WEBSITE_URL}/projects/${projectId}#vote` });
};

// Utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
