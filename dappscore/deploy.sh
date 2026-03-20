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

# ── Restart PM2 ───────────────────────────────────────────────────────────────
echo "==> Restarting PM2 processes..."
# `pm2 start` registers if not present; `pm2 restart` updates an existing process.
if pm2 list | grep -q "dappscore-backend"; then
  pm2 restart dappscore-backend  --update-env
else
  pm2 start "$APP_DIR/ecosystem.config.js" --only dappscore-backend
fi
if pm2 list | grep -q "dappscore-frontend"; then
  pm2 restart dappscore-frontend --update-env
else
  pm2 start "$APP_DIR/ecosystem.config.js" --only dappscore-frontend
fi
pm2 save

echo ""
pm2 status
echo ""
echo "==> Deploy complete."
