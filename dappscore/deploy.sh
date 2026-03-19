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
pm2 restart dappscore-backend  --update-env
pm2 restart dappscore-frontend --update-env

echo ""
pm2 status
echo ""
echo "==> Deploy complete."
