#\!/usr/bin/env bash
#
# deploy.sh - Deterministic deployment script for JadisatuOS
# Usage: bash /root/jadisatu.cloud/deploy/deploy.sh
#
# Called by GitHub Actions or run manually on VPS.
# Logs to /var/log/jadisatu-deploy.log
#

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
REPO_DIR="/root/jadisatu.cloud"
NGINX_ROOT="/var/www/jadisatu.cloud/public"
DEPLOY_LOG="/var/log/jadisatu-deploy.log"
NEXTJS_DIR="${REPO_DIR}/nextjs-app"
HUNTER_DIR="${REPO_DIR}/hunter-agent/backend"
VISUAL_DIR="${REPO_DIR}/visual-engine"

# ── Load NVM ──────────────────────────────────────────────────
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# ── Helpers ───────────────────────────────────────────────────
START_TIME=$(date +%s)

log() {
  local ts=$(date "+%Y-%m-%d %H:%M:%S")
  local msg="[${ts}] $1"
  echo "$msg"
  echo "$msg" >> "$DEPLOY_LOG"
}

fail() {
  log "DEPLOY FAILED: $1"
  local end=$(date +%s)
  local dur=$((end - START_TIME))
  log "DEPLOY FAILURE | duration=${dur}s"
  log "=========================================="
  exit 1
}

# ── Start ─────────────────────────────────────────────────────
log "=========================================="
log "DEPLOY START | user=$(whoami) | host=$(hostname)"

# ── 1. Pull latest code ──────────────────────────────────────
cd "$REPO_DIR"
COMMIT_BEFORE=$(git rev-parse --short HEAD)
git fetch origin main
git merge origin/main --ff-only || fail "Fast-forward merge failed. Manual fix needed."
COMMIT_AFTER=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%s)
log "Git: ${COMMIT_BEFORE} -> ${COMMIT_AFTER} (${COMMIT_MSG})"

# ── 2. Next.js: install & build ──────────────────────────────
cd "$NEXTJS_DIR"
log "Installing Next.js dependencies..."
npm ci --production=false 2>&1 | tail -3 || fail "npm ci failed"
log "Building Next.js..."
npm run build 2>&1 | tail -5 || fail "Next.js build failed"
log "Next.js build complete"

# ── 3. Frontend: sync to Nginx ───────────────────────────────
if [ -d "${REPO_DIR}/frontend" ] && [ -d "$NGINX_ROOT" ]; then
  rsync -a --delete "${REPO_DIR}/frontend/" "${NGINX_ROOT}/"
  log "Frontend synced to ${NGINX_ROOT}"
else
  log "WARNING: Frontend or Nginx root missing, skipping"
fi

# ── 4. Python deps (Hunter Agent) ────────────────────────────
cd "$HUNTER_DIR"
pip install -r requirements.txt --quiet --break-system-packages 2>&1 | tail -3 || log "WARNING: pip install (hunter) had issues"
log "Python deps updated (hunter-agent)"

# ── 4b. Python deps (Visual Engine) ─────────────────────────
cd "$VISUAL_DIR"
pip install -r requirements.txt --quiet --break-system-packages 2>&1 | tail -3 || log "WARNING: pip install (visual-engine) had issues"
# Ensure Playwright Chromium is installed for screenshot rendering
python -m playwright install chromium 2>&1 | tail -3 || log "WARNING: Playwright install had issues"
log "Python deps updated (visual-engine)"

# ── 5. PM2: reload all processes ─────────────────────────────
cd "$REPO_DIR"
if pm2 describe jadisatu-nextjs > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
  log "PM2 processes reloaded"
else
  pm2 start ecosystem.config.js
  pm2 save
  log "PM2 processes started (first run)"
fi

# ── 6. Nginx: add visual-engine proxy if needed ──────────────
cd "$REPO_DIR"
bash deploy/setup-nginx-visual-engine.sh 2>&1 || log "WARNING: nginx visual-engine setup had issues"

# ── 6b. Nginx: test & reload ─────────────────────────────────
nginx -t 2>&1 || fail "Nginx config test failed"
nginx -s reload 2>&1
log "Nginx reloaded"

# ── 7. Health checks ─────────────────────────────────────────
sleep 3
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
  log "Health: Next.js OK (port 3000)"
else
  log "WARNING: Next.js health check failed"
fi

if curl -sf http://localhost:8000/docs > /dev/null 2>&1; then
  log "Health: Hunter Agent OK (port 8000)"
else
  log "WARNING: Hunter Agent health check failed"
fi

if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
  log "Health: Extractor API OK (/api/health)"
else
  log "WARNING: Extractor API health check failed (/api/health)"
fi

if curl -sf http://localhost:8100/api/visual/health > /dev/null 2>&1; then
  log "Health: Visual Engine OK (port 8100)"
else
  log "WARNING: Visual Engine health check failed (port 8100)"
fi

# ── 8. Summary ────────────────────────────────────────────────
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
log "DEPLOY SUCCESS | commit=${COMMIT_AFTER} | duration=${DURATION}s"
log "=========================================="
