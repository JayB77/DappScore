#!/usr/bin/env bash
# DappScore VPS deployment script
#
# Usage:  bash deploy.sh [branch]
#         bash deploy.sh          # defaults to main
#         bash deploy.sh my-branch
#
# Assumes:
#   - Git repo cloned at the directory containing this script
#   - nginx site config already installed (see dappscore/nginx.conf)
#   - PostgreSQL running, DATABASE_URL set in dappscore/functions/.env
#   - PM2 installed globally: npm i -g pm2
#   - Node installed (nvm or system)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

BRANCH="${1:-main}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$REPO_DIR/dappscore"
API_DIR="$REPO_DIR/dappscore/functions"
SHA_FILE="$REPO_DIR/.deploy-sha"   # tracks last deployed commit

# ── Colours ───────────────────────────────────────────────────────────────────

BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "\n${BLUE}==>${NC} $*"; }
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
skip() { echo -e "  ${YELLOW}–${NC} skipped — $*"; }
die()  { echo -e "\n${RED}ERROR:${NC} $*" >&2; exit 1; }

# ── Pull ──────────────────────────────────────────────────────────────────────

log "Pulling latest code from '$BRANCH'..."
git -C "$REPO_DIR" pull origin "$BRANCH"

CURR_SHA=$(git -C "$REPO_DIR" rev-parse HEAD)
PREV_SHA=""
[[ -f "$SHA_FILE" ]] && PREV_SHA=$(cat "$SHA_FILE")

if [[ "$PREV_SHA" == "$CURR_SHA" ]]; then
  echo -e "\n  Nothing changed since last deploy (${CURR_SHA:0:7}). Exiting."
  exit 0
fi

echo "  ${CURR_SHA:0:7}  ←  ${PREV_SHA:0:7:-${PREV_SHA:+last}}"

# ── Change detection ──────────────────────────────────────────────────────────
# Returns 0 (true) if any file matching the prefix changed since last deploy.

changed() {
  local prefix="$1"
  if [[ -z "$PREV_SHA" ]]; then
    return 0   # first deploy — run everything
  fi
  git -C "$REPO_DIR" diff --name-only "$PREV_SHA" "$CURR_SHA" \
    | grep -q "^${prefix}" && return 0 || return 1
}

# New migration files added since last deploy (avoids re-running old ones)
new_migrations() {
  if [[ -z "$PREV_SHA" ]]; then
    ls "$API_DIR/migrations/"*.sql 2>/dev/null || true
    return
  fi
  git -C "$REPO_DIR" diff --name-only --diff-filter=A "$PREV_SHA" "$CURR_SHA" \
    | grep "^dappscore/functions/migrations/.*\.sql$"            \
    | sed "s|^dappscore/functions/|$API_DIR/|"                  \
    || true
}

# ── Database migrations ───────────────────────────────────────────────────────

if changed "dappscore/functions/migrations/"; then
  log "Checking for new database migrations..."
  MIGRATIONS=$(new_migrations)
  if [[ -z "$MIGRATIONS" ]]; then
    skip "no new .sql files"
  else
    export $(grep -v '^#' "$API_DIR/.env" | grep DATABASE_URL | xargs) \
      || die "DATABASE_URL not found in $API_DIR/.env"
    while IFS= read -r sql_file; do
      [[ -z "$sql_file" ]] && continue
      echo "  Applying $(basename "$sql_file")..."
      psql "$DATABASE_URL" -f "$sql_file" && ok "$(basename "$sql_file")"
    done <<< "$MIGRATIONS"
  fi
else
  skip "no migration changes"
fi

# ── API (functions/) ──────────────────────────────────────────────────────────

if changed "dappscore/functions/"; then
  log "Building API..."
  cd "$API_DIR"
  npm install --omit=dev
  npm run build
  ok "build complete"

  log "Restarting API with PM2..."
  if pm2 describe dappscore-api > /dev/null 2>&1; then
    pm2 reload ecosystem.config.js --update-env
  else
    mkdir -p logs
    pm2 start ecosystem.config.js --env production
    pm2 save
  fi
  ok "dappscore-api reloaded"
else
  skip "no API changes"
fi

# ── Frontend ──────────────────────────────────────────────────────────────────

FRONTEND_PATHS=(
  "dappscore/src/"
  "dappscore/public/"
  "dappscore/package"
  "dappscore/next.config"
  "dappscore/.env"
)

FRONTEND_CHANGED=false
for path in "${FRONTEND_PATHS[@]}"; do
  if changed "$path"; then
    FRONTEND_CHANGED=true
    break
  fi
done

if $FRONTEND_CHANGED; then
  log "Building frontend..."
  cd "$FRONTEND_DIR"
  npm install
  npm run build
  ok "build complete"

  log "Restarting frontend with PM2..."
  if pm2 describe dappscore-frontend > /dev/null 2>&1; then
    pm2 reload ecosystem.config.js --update-env
  else
    mkdir -p logs
    pm2 start ecosystem.config.js --env production
    pm2 save
  fi
  ok "dappscore-frontend reloaded"
else
  skip "no frontend changes"
fi

# ── Nginx ─────────────────────────────────────────────────────────────────────

if changed "dappscore/nginx.conf"; then
  log "Reloading nginx..."
  nginx -t && systemctl reload nginx
  ok "nginx reloaded"
else
  skip "no nginx changes"
fi

# ── Save deployed SHA ─────────────────────────────────────────────────────────

echo "$CURR_SHA" > "$SHA_FILE"

echo -e "\n${GREEN}Deploy complete!${NC} (${CURR_SHA:0:7})"
echo -e "  https://app.dappscore.io\n"
