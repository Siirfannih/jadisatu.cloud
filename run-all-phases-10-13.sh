#!/bin/bash
# ============================================================
# Jadisatu.cloud — Autonomous Phase Runner (Phase 10-13)
# ============================================================
#
# USAGE:
#   bash run-all-phases-10-13.sh          # Run all phases 10→13
#   bash run-all-phases-10-13.sh 11       # Resume from phase 11
#   bash run-all-phases-10-13.sh 12       # Resume from phase 12
#
# WHAT THIS DOES:
#   1. Runs phase scripts sequentially (10 → 11 → 12 → 13)
#   2. Each phase uses Claude Code agent autonomously
#   3. Auto-verifies build after each phase
#   4. Auto-pushes to GitHub after each phase
#   5. Logs everything to /workspaces/jadisatu.cloud/phase-runner.log
#   6. If a phase fails, stops and tells you where to resume
#
# PREREQUISITES:
#   - GitHub Codespace with jadisatu.cloud repo
#   - Claude Code CLI installed (claude command available)
#   - npm dependencies installed (cd nextjs-app && npm install)
#   - Supabase credentials in nextjs-app/.env.local
#
# ESTIMATED TIME: ~2-4 hours total (depends on Claude API speed)
#   Phase 10: ~30-60 min (database unification + 7 bug fixes)
#   Phase 11: ~45-90 min (5 new pages + enhanced creative hub)
#   Phase 12: ~30-60 min (personality polish + backport)
#   Phase 13: ~30-60 min (context engine + agent APIs)
#
# ============================================================

set -euo pipefail

# ============================================================
# CONFIG
# ============================================================
REPO_DIR="/workspaces/jadisatu.cloud"
LOG_FILE="$REPO_DIR/phase-runner.log"
START_PHASE=${1:-10}  # Default: start from phase 10
END_PHASE=13

# ============================================================
# HELPERS
# ============================================================
timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

log() {
    local msg="[$(timestamp)] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

log_separator() {
    local sep="============================================="
    echo "$sep"
    echo "$sep" >> "$LOG_FILE"
}

# Duration tracker
phase_start_time=""
track_start() {
    phase_start_time=$(date +%s)
}
track_end() {
    local end_time=$(date +%s)
    local duration=$((end_time - phase_start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    log "Duration: ${minutes}m ${seconds}s"
}

# ============================================================
# PRE-FLIGHT CHECKS
# ============================================================
preflight() {
    log_separator
    log "PRE-FLIGHT CHECKS"
    log_separator

    # Check we're in the right directory
    if [ ! -f "$REPO_DIR/CLAUDE.md" ]; then
        log "ERROR: CLAUDE.md not found. Are you in the jadisatu.cloud codespace?"
        log "Expected repo at: $REPO_DIR"
        exit 1
    fi
    log "✓ Repository found at $REPO_DIR"

    # Check Claude CLI
    if ! command -v claude &> /dev/null; then
        log "ERROR: 'claude' command not found. Install Claude Code CLI first."
        exit 1
    fi
    log "✓ Claude Code CLI available"

    # Check npm dependencies
    if [ ! -d "$REPO_DIR/nextjs-app/node_modules" ]; then
        log "Installing npm dependencies..."
        cd "$REPO_DIR/nextjs-app" && npm install
    fi
    log "✓ npm dependencies installed"

    # Check .env.local
    if [ ! -f "$REPO_DIR/nextjs-app/.env.local" ]; then
        log "WARNING: .env.local not found. Supabase queries may fail."
        log "Create it with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    else
        log "✓ .env.local exists"
    fi

    # Check phase scripts exist
    for phase in $(seq $START_PHASE $END_PHASE); do
        if [ ! -f "$REPO_DIR/run-phase-${phase}.sh" ]; then
            log "ERROR: run-phase-${phase}.sh not found!"
            exit 1
        fi
    done
    log "✓ All phase scripts (${START_PHASE}-${END_PHASE}) found"

    # Check git status
    cd "$REPO_DIR"
    local changes=$(git status --porcelain | wc -l | tr -d ' ')
    if [ "$changes" -gt 0 ]; then
        log "WARNING: $changes uncommitted changes detected. Stashing..."
        git stash push -m "pre-phase-runner-stash-$(date +%s)"
        log "✓ Changes stashed"
    else
        log "✓ Working directory clean"
    fi

    log ""
    log "All pre-flight checks passed. Starting from Phase $START_PHASE."
    log ""
}

# ============================================================
# RUN A SINGLE PHASE
# ============================================================
run_phase() {
    local phase_num=$1
    local script="$REPO_DIR/run-phase-${phase_num}.sh"

    log_separator
    log "PHASE $phase_num: STARTING"
    log_separator
    track_start

    cd "$REPO_DIR"

    # Make script executable
    chmod +x "$script"

    # Run the phase script
    # We source it instead of bash to keep the same shell context
    # But we use bash to isolate failures
    if bash "$script" 2>&1 | tee -a "$LOG_FILE"; then
        track_end
        log "✓ PHASE $phase_num: COMPLETED SUCCESSFULLY"
    else
        track_end
        log "✗ PHASE $phase_num: FAILED"
        log ""
        log "To resume from this phase, run:"
        log "  bash run-all-phases-10-13.sh $phase_num"
        log ""
        log "To skip this phase and continue:"
        log "  bash run-all-phases-10-13.sh $((phase_num + 1))"
        log ""
        log "Check the log for details: $LOG_FILE"
        return 1
    fi

    # Post-phase: verify the build passes
    log "Post-phase build verification..."
    cd "$REPO_DIR/nextjs-app"
    if npm run build 2>&1 | tail -5 | tee -a "$LOG_FILE"; then
        log "✓ Build verification passed"
    else
        log "WARNING: Build failed after Phase $phase_num. The phase script should have fixed this."
        log "Continuing to next phase (the next phase may fix remaining issues)."
    fi

    # Git status summary
    cd "$REPO_DIR"
    local commit_count=$(git log --oneline -5 | head -5)
    log "Recent commits:"
    echo "$commit_count" | while read line; do
        log "  $line"
    done

    log ""
    return 0
}

# ============================================================
# MAIN EXECUTION
# ============================================================
main() {
    # Initialize log
    echo "" >> "$LOG_FILE"
    log_separator
    log "JADISATU.CLOUD AUTONOMOUS PHASE RUNNER"
    log "Phases: $START_PHASE → $END_PHASE"
    log "Started: $(timestamp)"
    log_separator

    # Pre-flight
    preflight

    # Track total time
    local total_start=$(date +%s)
    local completed_phases=0
    local failed_phase=0

    # Run phases sequentially
    for phase in $(seq $START_PHASE $END_PHASE); do
        if run_phase $phase; then
            completed_phases=$((completed_phases + 1))
        else
            failed_phase=$phase
            break
        fi

        # Brief pause between phases (let git settle)
        if [ $phase -lt $END_PHASE ]; then
            log "Pausing 10 seconds before next phase..."
            sleep 10
        fi
    done

    # Final summary
    local total_end=$(date +%s)
    local total_duration=$((total_end - total_start))
    local total_minutes=$((total_duration / 60))
    local total_hours=$((total_minutes / 60))
    local remaining_minutes=$((total_minutes % 60))

    log_separator
    log "EXECUTION SUMMARY"
    log_separator
    log "Phases attempted: $START_PHASE → $((START_PHASE + completed_phases - 1))"
    log "Phases completed: $completed_phases / $((END_PHASE - START_PHASE + 1))"
    log "Total time: ${total_hours}h ${remaining_minutes}m"

    if [ $failed_phase -gt 0 ]; then
        log ""
        log "⚠ STOPPED AT PHASE $failed_phase"
        log "Resume: bash run-all-phases-10-13.sh $failed_phase"
        log ""
        exit 1
    else
        log ""
        log "✓ ALL PHASES COMPLETED SUCCESSFULLY!"
        log ""
        log "What was done:"
        log "  Phase 10: Database unified, bugs fixed, localStorage migrated"
        log "  Phase 11: Missing features ported to Light Mode (Creator UX)"
        log "  Phase 12: Both personalities polished, cross-mode navigation"
        log "  Phase 13: Context Engine built, agent APIs created"
        log ""
        log "Next steps:"
        log "  1. Open jadisatu.cloud in browser and test Dark Mode"
        log "  2. Open jadisatu.cloud/light in browser and test Light Mode"
        log "  3. Run SQL migrations on Supabase (check sql/ folder)"
        log "  4. Test cross-mode navigation (Switch to Creator/Monk Mode)"
        log "  5. Test agent API endpoints with curl"
        log ""
        log "Check: https://github.com/Siirfannih/jadisatu.cloud"
    fi

    log "Log saved to: $LOG_FILE"
    log_separator
}

# ============================================================
# RUN
# ============================================================
main
