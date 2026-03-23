#!/usr/bin/env bash
# deploy.sh — build both apps and reload PM2
#
# Run from anywhere on the VPS:
#   bash /var/www/dappscore/dappscore/deploy.sh
#
# Optionally pull latest code first:
#   bash /var/www/dappscore/dappscore/deploy.sh --pull

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Optional: git pull ────────────────────────────────────────────────────────
if [[ "${1:-}" == "--pull" ]]; then
  echo "==> Pulling latest code..."
  git -C "$APP_DIR" pull
fi

# ── Backend build ─────────────────────────────────────────────────────────────
# Full install required: @types/* packages are devDependencies but needed by tsc.
echo "==> Building backend..."
cd "$APP_DIR/backend"
npm install
npm run build

# ── Frontend build ────────────────────────────────────────────────────────────
echo "==> Building frontend..."
cd "$APP_DIR"
npm install
npm run build

# ── Evict legacy PM2 process names ───────────────────────────────────────────
# Old deploy scripts registered processes as 'dappscore' and 'dappscore-api'.
# Remove them so they don't hold ports 3000/3001 alongside the current names.
for legacy in dappscore dappscore-api; do
  if pm2 list | grep -qw "$legacy"; then
    echo "==> Removing legacy PM2 process: $legacy"
    pm2 delete "$legacy"
  fi
done

# ── Reload PM2 (zero-downtime) ────────────────────────────────────────────────
# `pm2 reload` does a rolling restart — workers are replaced one at a time so
# the app stays available.  Falls back to `pm2 start` on first deploy.
echo "==> Reloading PM2 processes..."
for app in dappscore-backend dappscore-frontend; do
  if pm2 list | grep -qw "$app"; then
    pm2 reload "$app" --update-env
  else
    pm2 start "$APP_DIR/ecosystem.config.js" --only "$app"
  fi
done

pm2 save

echo ""
pm2 list
echo ""
echo "==> Deploy complete."
