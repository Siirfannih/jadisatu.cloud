#!/usr/bin/env bash
#
# notify.sh - Send deployment/agent notifications via OpenClaw
# Usage: bash notify.sh <status> <message> <commit_sha>
#
# Status types:
#   success       - Deploy succeeded
#   failure       - Deploy failed
#   agent-success - Agent task completed
#   agent-failure - Agent task failed
#

set -euo pipefail

STATUS="${1:-unknown}"
MESSAGE="${2:-No message}"
COMMIT_SHA="${3:-}"
SHORT_SHA="${COMMIT_SHA:0:7}"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S WITA")

# OpenClaw config - adjust these for your setup
OPENCLAW_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
OPENCLAW_URL="http://localhost:${OPENCLAW_PORT}"

# Format notification based on status
case "$STATUS" in
  success)
    NOTIFICATION="✅ *Deploy Berhasil*

📦 ${MESSAGE}
🔗 Commit: \`${SHORT_SHA}\`
⏰ ${TIMESTAMP}

jadisatu.cloud sudah live dengan update terbaru."
    ;;
  failure)
    NOTIFICATION="❌ *Deploy Gagal*

📦 ${MESSAGE}
🔗 Commit: \`${SHORT_SHA}\`
⏰ ${TIMESTAMP}

Perlu dicek manual. Lihat GitHub Actions log."
    ;;
  agent-success)
    NOTIFICATION="🤖 *Agent Task Selesai*

📋 ${MESSAGE}
⏰ ${TIMESTAMP}

PR sudah dibuat. Silakan review di GitHub."
    ;;
  agent-failure)
    NOTIFICATION="⚠️ *Agent Task Gagal*

📋 ${MESSAGE}
⏰ ${TIMESTAMP}

Agent tidak bisa menyelesaikan task ini. Perlu intervensi manual."
    ;;
  *)
    NOTIFICATION="ℹ️ *JadisatuOS Update*

${MESSAGE}
⏰ ${TIMESTAMP}"
    ;;
esac

# Try OpenClaw first (Telegram/WhatsApp)
if curl -sf "${OPENCLAW_URL}/health" > /dev/null 2>&1; then
  curl -sf -X POST "${OPENCLAW_URL}/api/notify" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"${NOTIFICATION}\", \"channel\": \"telegram\"}" \
    > /dev/null 2>&1 && echo "Notification sent via OpenClaw" || echo "OpenClaw notify failed (endpoint may differ)"
else
  echo "OpenClaw not available, notification skipped"
fi

# Also log to deploy log
echo "[${TIMESTAMP}] NOTIFY: ${STATUS} - ${MESSAGE}" >> /var/log/jadisatu-deploy.log
