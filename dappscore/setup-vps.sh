#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# DappScore VPS Setup Script
# Tested on Ubuntu 24.04 LTS
# Usage: sudo bash setup-vps.sh <domain> <repo-url>
# Example: sudo bash setup-vps.sh app.dappscore.xyz https://github.com/DappScore/platform_private.git
# ---------------------------------------------------------------------------

DOMAIN="${1:?Usage: $0 <domain> <repo-url>}"
REPO_URL="${2:?Usage: $0 <domain> <repo-url>}"
APP_DIR="/var/www/dappscore"
NODE_VERSION="20"

echo "==> [1/8] System update"
apt-get update -y && apt-get upgrade -y
apt-get install -y git curl build-essential nginx certbot python3-certbot-nginx

echo "==> [2/8] Install Node.js $NODE_VERSION"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs
node -v && npm -v

echo "==> [3/8] Install PM2"
npm install -g pm2

echo "==> [4/8] Clone / update repo"
if [ -d "$APP_DIR/.git" ]; then
  echo "  Repo exists — pulling latest"
  git -C "$APP_DIR" pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR/dappscore"

echo "==> [5/8] Install dependencies & build frontend"
npm ci --prefer-offline
npm run build

echo "==> [6/8] Install dependencies & build backend"
cd backend
npm install
npm run build
cd ..

echo "==> [7/8] Configure Nginx"
NGINX_CONF="/etc/nginx/sites-available/dappscore"
cp nginx.conf "$NGINX_CONF"
# Substitute placeholder domain
sed -i "s/your-domain.com/$DOMAIN/g" "$NGINX_CONF"
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/dappscore
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> [7b/8] Obtain SSL certificate (Let's Encrypt)"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
systemctl reload nginx

echo "==> [8/8] Start services with PM2"
# Update cwd in ecosystem config to match actual install path
sed -i "s|/var/www/dappscore|$APP_DIR/dappscore|g" ecosystem.config.js

pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash  # register PM2 on boot

echo ""
echo "✓ Setup complete. DappScore is live at https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  pm2 status              – process overview"
echo "  pm2 logs dappscore-frontend"
echo "  pm2 logs dappscore-backend"
echo "  npm run deploy          – rebuild & reload frontend (from $APP_DIR/dappscore)"
