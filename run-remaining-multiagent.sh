#!/bin/bash
# ============================================================
# Resume Phase 12-13 with MULTI-AGENT (Gemini + Claude)
# ============================================================
#
# USAGE:
#   bash run-remaining-multiagent.sh          # Run Phase 12 → 13
#   bash run-remaining-multiagent.sh 13       # Skip to Phase 13
#
# REQUIRES:
#   - GEMINI_API_KEY (in env or nextjs-app/.env.local)
#   - Claude Code CLI (claude command)
#
# TOKEN DISTRIBUTION:
#   ~70% tasks handled by Gemini (free/cheap)
#   ~30% tasks handled by Claude (premium)
#   = ~60-70% Claude token savings
#
# ============================================================

set -euo pipefail

REPO_DIR="/workspaces/jadisatu.cloud"
START=${1:-12}

cd "$REPO_DIR"

echo "========================================="
echo "  Multi-Agent Runner: Phase $START → 13"
echo "  Gemini for routine | Claude for complex"
echo "  $(date)"
echo "========================================="

# Check Gemini API key
if [ -z "${GEMINI_API_KEY:-}" ]; then
    if [ -f "$REPO_DIR/nextjs-app/.env.local" ]; then
        export GEMINI_API_KEY=$(grep GEMINI_API_KEY "$REPO_DIR/nextjs-app/.env.local" 2>/dev/null | cut -d'=' -f2 | tr -d ' "'"'"'' || echo "")
    fi
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
    echo ""
    echo "ERROR: GEMINI_API_KEY not found!"
    echo ""
    echo "Add it to your Codespace:"
    echo "  export GEMINI_API_KEY=your-key-here"
    echo ""
    echo "Or add to nextjs-app/.env.local:"
    echo "  GEMINI_API_KEY=your-key-here"
    echo ""
    echo "Get a free key at: https://aistudio.google.com/apikey"
    echo ""
    exit 1
fi

echo "✓ Gemini API key found"
echo "✓ Claude CLI: $(which claude)"
echo ""

for phase in $(seq $START 13); do
    script="$REPO_DIR/run-phase-${phase}-multiagent.sh"
    if [ ! -f "$script" ]; then
        echo "ERROR: $script not found"
        exit 1
    fi

    echo "========================================="
    echo "  STARTING PHASE $phase"
    echo "========================================="

    chmod +x "$script"
    start_time=$(date +%s)

    if bash "$script"; then
        duration=$(( $(date +%s) - start_time ))
        echo "✓ Phase $phase completed in $((duration/60))m $((duration%60))s"
    else
        echo "✗ Phase $phase failed. Resume: bash run-remaining-multiagent.sh $phase"
        exit 1
    fi

    [ $phase -lt 13 ] && sleep 5
done

echo ""
echo "========================================="
echo "  ALL PHASES COMPLETED!"
echo "  $(date)"
echo "========================================="
