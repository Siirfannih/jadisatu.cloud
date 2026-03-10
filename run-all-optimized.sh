#!/bin/bash
# ============================================================
# Master Runner: Phase 10 → 13 (OPTIMIZED micro-task versions)
# ============================================================
#
# USAGE:
#   bash run-all-optimized.sh          # Run Phase 10 → 13
#   bash run-all-optimized.sh 11       # Resume from Phase 11
#   bash run-all-optimized.sh 12       # Resume from Phase 12
#
# Each phase uses micro-task splitting to minimize token usage.
# Total: ~22 micro-tasks across 4 phases.
#
# ============================================================

set -euo pipefail

REPO_DIR="/workspaces/jadisatu.cloud"
START=${1:-10}
LOG_FILE="$REPO_DIR/phase-runner-optimized.log"

cd "$REPO_DIR"

echo "========================================="
echo "  Optimized Phase Runner: $START → 13"
echo "  $(date)"
echo "=========================================" | tee -a "$LOG_FILE"

# Pre-flight checks
echo ""
echo ">>> Pre-flight checks..."

# Check Claude CLI
if ! command -v claude &> /dev/null; then
    echo "ERROR: Claude CLI not found. Run: npm install -g @anthropic-ai/claude-code"
    exit 1
fi
echo "✓ Claude CLI found: $(which claude)"

# Check we're in the right directory
if [ ! -f "$REPO_DIR/nextjs-app/package.json" ]; then
    echo "ERROR: nextjs-app/package.json not found. Are we in the right repo?"
    exit 1
fi
echo "✓ Repository verified"

# Check npm dependencies
if [ ! -d "$REPO_DIR/nextjs-app/node_modules" ]; then
    echo ">>> Installing npm dependencies..."
    cd "$REPO_DIR/nextjs-app" && npm install
    cd "$REPO_DIR"
fi
echo "✓ Dependencies installed"

echo ""
echo "Starting in 3 seconds..."
sleep 3

# Run phases
for phase in $(seq $START 13); do
    script="$REPO_DIR/run-phase-${phase}-optimized.sh"

    if [ ! -f "$script" ]; then
        echo "ERROR: $script not found!" | tee -a "$LOG_FILE"
        echo "Available scripts:"
        ls -1 "$REPO_DIR"/run-phase-*-optimized.sh 2>/dev/null || echo "  (none found)"
        exit 1
    fi

    echo "" | tee -a "$LOG_FILE"
    echo "=========================================" | tee -a "$LOG_FILE"
    echo "  STARTING PHASE $phase" | tee -a "$LOG_FILE"
    echo "  $(date)" | tee -a "$LOG_FILE"
    echo "=========================================" | tee -a "$LOG_FILE"

    chmod +x "$script"
    start_time=$(date +%s)

    if bash "$script" 2>&1 | tee -a "$LOG_FILE"; then
        duration=$(( $(date +%s) - start_time ))
        echo "" | tee -a "$LOG_FILE"
        echo "✓ Phase $phase completed in $((duration/60))m $((duration%60))s" | tee -a "$LOG_FILE"
    else
        duration=$(( $(date +%s) - start_time ))
        echo "" | tee -a "$LOG_FILE"
        echo "✗ Phase $phase FAILED after $((duration/60))m $((duration%60))s" | tee -a "$LOG_FILE"
        echo "" | tee -a "$LOG_FILE"
        echo "To resume from this phase:" | tee -a "$LOG_FILE"
        echo "  bash run-all-optimized.sh $phase" | tee -a "$LOG_FILE"
        exit 1
    fi

    # Cool-down between phases (let rate limits recover)
    if [ $phase -lt 13 ]; then
        echo ""
        echo ">>> Cooling down 10 seconds before next phase..."
        sleep 10
    fi
done

echo "" | tee -a "$LOG_FILE"
echo "=========================================" | tee -a "$LOG_FILE"
echo "  ALL PHASES (10-13) COMPLETED!" | tee -a "$LOG_FILE"
echo "  $(date)" | tee -a "$LOG_FILE"
echo "=========================================" | tee -a "$LOG_FILE"
echo ""
echo "  Log saved to: $LOG_FILE"
echo ""
echo "  Next steps:"
echo "  1. Check jadisatu.cloud/light for Light Mode changes"
echo "  2. Check jadisatu.cloud for Dark Mode changes"
echo "  3. Run SQL migration in Supabase: sql/phase-10-unify-database.sql"
echo "  4. Run SQL migration: sql/phase-13-context-engine.sql"
echo ""
