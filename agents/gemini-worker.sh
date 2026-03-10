#!/bin/bash
# ============================================================
# Gemini Worker — Cheap AI for routine coding tasks
# ============================================================
#
# Uses Google Gemini API for tasks that don't need Claude's
# reasoning power: boilerplate, CRUD pages, styling, context prep
#
# USAGE:
#   bash agents/gemini-worker.sh "Create a Next.js page for /focus with a Pomodoro timer"
#   bash agents/gemini-worker.sh --file prompt.txt
#
# REQUIRES:
#   GEMINI_API_KEY in environment or .env.local
#
# ============================================================

set -euo pipefail

REPO_DIR="/workspaces/jadisatu.cloud"

# Load API key from environment or .env.local
if [ -z "${GEMINI_API_KEY:-}" ]; then
    if [ -f "$REPO_DIR/nextjs-app/.env.local" ]; then
        GEMINI_API_KEY=$(grep GEMINI_API_KEY "$REPO_DIR/nextjs-app/.env.local" | cut -d'=' -f2 | tr -d ' "'"'"'')
    fi
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
    echo "ERROR: GEMINI_API_KEY not found. Set it in environment or .env.local"
    exit 1
fi

# Get prompt from argument or file
if [ "${1:-}" = "--file" ] && [ -f "${2:-}" ]; then
    PROMPT=$(cat "$2")
elif [ -n "${1:-}" ]; then
    PROMPT="$1"
else
    echo "Usage: bash agents/gemini-worker.sh \"your prompt\" or --file prompt.txt"
    exit 1
fi

# Gemini API endpoint (using gemini-2.0-flash for speed + cost efficiency)
API_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}"

# Build the request
REQUEST_BODY=$(cat <<GEMINI_EOF
{
  "contents": [{
    "parts": [{
      "text": "You are a senior full-stack developer working on a Next.js 15 + React 19 + TypeScript + Tailwind CSS + Supabase project called Jadisatu.cloud.\n\nRules:\n- Use TypeScript strictly\n- Use Tailwind CSS for styling (no inline styles)\n- Use 'use client' for interactive components\n- Import Supabase from '@/lib/supabase-browser'\n- Use Lucide React for icons\n- Follow App Router conventions\n- Output ONLY the complete file content, no explanations\n- If creating multiple files, separate with --- FILE: path/to/file.tsx ---\n\n$PROMPT"
    }]
  }],
  "generationConfig": {
    "temperature": 0.2,
    "maxOutputTokens": 8192
  }
}
GEMINI_EOF
)

echo ">>> Calling Gemini 2.0 Flash..."

# Make API call
RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY")

# Extract text from response
OUTPUT=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data['candidates'][0]['content']['parts'][0]['text'])
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    print(json.dumps(data, indent=2)[:500], file=sys.stderr)
    sys.exit(1)
" 2>&1)

if echo "$OUTPUT" | grep -q "^ERROR:"; then
    echo "$OUTPUT"
    exit 1
fi

echo "$OUTPUT"
