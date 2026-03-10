#!/bin/bash
# ============================================================
# Resume Phase 12-13 (Optimized — Token-Efficient)
# ============================================================
#
# USAGE:
#   bash run-remaining-phases.sh          # Run Phase 12 → 13
#   bash run-remaining-phases.sh 13       # Skip to Phase 13 only
#
# TOKEN SAVINGS vs Original:
#   Original Phase 12: ~1 massive prompt (5000 words) = agent reads 40+ files
#   Optimized Phase 12: 6 micro-prompts (~600 words each) + pre-built context file
#   Estimated savings: 40-60% fewer tokens
#
# ============================================================

set -euo pipefail

REPO_DIR="/workspaces/jadisatu.cloud"
LOG_FILE="$REPO_DIR/phase-runner.log"
START_PHASE=${1:-12}

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(timestamp)] $1" | tee -a "$LOG_FILE"; }

# Pre-flight
cd "$REPO_DIR"
if ! command -v claude &> /dev/null; then
    echo "ERROR: claude CLI not found"; exit 1
fi

log "========================================="
log "Resuming from Phase $START_PHASE (Optimized)"
log "========================================="

run_optimized_phase() {
    local phase=$1
    local script="$REPO_DIR/run-phase-${phase}-optimized.sh"

    if [ ! -f "$script" ]; then
        log "ERROR: $script not found"
        return 1
    fi

    log "PHASE $phase: STARTING"
    local start_time=$(date +%s)

    chmod +x "$script"
    if bash "$script" 2>&1 | tee -a "$LOG_FILE"; then
        local duration=$(( $(date +%s) - start_time ))
        log "PHASE $phase: COMPLETED in $((duration/60))m $((duration%60))s"
    else
        local duration=$(( $(date +%s) - start_time ))
        log "PHASE $phase: FAILED after $((duration/60))m $((duration%60))s"
        log "Resume: bash run-remaining-phases.sh $phase"
        return 1
    fi
}

# Run phases
for phase in $(seq $START_PHASE 13); do
    run_optimized_phase $phase || exit 1
    [ $phase -lt 13 ] && sleep 5
done

log "========================================="
log "ALL REMAINING PHASES COMPLETED!"
log "========================================="
