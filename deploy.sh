#!/usr/bin/env bash
# DappScore VPS deployment script
# Run from repo root: bash deploy.sh
# Assumes:
#   - Git repo at /root/DappScore (or adjust REPO_DIR below)
#   - nginx site config already installed (see dappscore/nginx.conf)
#   - PostgreSQL + Redis running
#   - .env file at /root/DappScore/dappscore/functions/.env
#   - PM2 installed globally: npm i -g pm2

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$REPO_DIR/dappscore"
API_DIR="$REPO_DIR/dappscore/functions"
WEB_ROOT="/var/www/dappscore/dappscore"

echo "==> Pulling latest code..."
git -C "$REPO_DIR" pull origin claude/migrate-firebase-to-vps-BnAvD

# ── Database migration ────────────────────────────────────────────────────────
echo "==> Running database migration..."
# Load DATABASE_URL from .env
export $(grep -v '^#' "$API_DIR/.env" | grep DATABASE_URL | xargs)
psql "$DATABASE_URL" -f "$API_DIR/migrations/001_initial.sql"

# ── API build ─────────────────────────────────────────────────────────────────
echo "==> Building API..."
cd "$API_DIR"
npm install --omit=dev
npm run build

echo "==> Restarting API with PM2..."
if pm2 describe dappscore-api > /dev/null 2>&1; then
  pm2 reload "$API_DIR/ecosystem.config.js" --update-env
else
  pm2 start "$API_DIR/ecosystem.config.js" --env production
  pm2 save
fi

# ── Frontend build ────────────────────────────────────────────────────────────
echo "==> Building frontend..."
cd "$FRONTEND_DIR"
npm install
npm run build

echo "==> Deploying static files to $WEB_ROOT..."
mkdir -p "$WEB_ROOT"
rm -rf "$WEB_ROOT/out"
cp -r "$FRONTEND_DIR/out" "$WEB_ROOT/out"

echo "==> Reloading nginx..."
nginx -t && systemctl reload nginx

echo ""
echo "==> Done! https://app.dappscore.io"
