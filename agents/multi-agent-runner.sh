#!/bin/bash
# ============================================================
# Multi-Agent Task Runner — Smart Model Routing
# ============================================================
#
# Routes tasks to the best model based on complexity:
#
#   GEMINI (cheap/fast):
#     - Read files and prepare context
#     - Create boilerplate pages (CRUD, forms, lists)
#     - CSS/styling changes
#     - Simple bug fixes (missing imports, typos)
#     - Generate SQL migrations from schema description
#
#   CLAUDE (expensive/smart):
#     - Architecture decisions
#     - Complex debugging
#     - Multi-file integration logic
#     - Database schema design
#     - Code review and refactoring
#     - Build error diagnosis
#
# USAGE:
#   source agents/multi-agent-runner.sh
#   gemini_task "Create a Next.js page for /focus with Pomodoro timer"
#   claude_task "Debug why Supabase RLS is blocking agent API calls"
#   gemini_write "nextjs-app/src/app/focus/page.tsx" "Create a Focus Mode page with..."
#
# ============================================================

REPO_DIR="/workspaces/jadisatu.cloud"

# ============================================================
# GEMINI FUNCTIONS (cheap tasks)
# ============================================================

# Run a Gemini task and print output
gemini_task() {
    local prompt="$1"
    echo "[GEMINI] Running: ${prompt:0:80}..."
    bash "$REPO_DIR/agents/gemini-worker.sh" "$prompt"
}

# Run Gemini and write output directly to a file
gemini_write() {
    local filepath="$1"
    local prompt="$2"

    echo "[GEMINI] Generating: $filepath"

    local output
    output=$(bash "$REPO_DIR/agents/gemini-worker.sh" "$prompt")

    if [ $? -eq 0 ] && [ -n "$output" ]; then
        # Create directory if needed
        mkdir -p "$(dirname "$REPO_DIR/$filepath")"

        # Strip markdown code fences if present
        echo "$output" | sed '/^```[a-z]*$/d' | sed '/^```$/d' > "$REPO_DIR/$filepath"
        echo "[GEMINI] Written: $filepath ($(wc -l < "$REPO_DIR/$filepath") lines)"
    else
        echo "[GEMINI] ERROR: Failed to generate $filepath"
        return 1
    fi
}

# Gemini generates multiple files from a single prompt
gemini_multi_write() {
    local prompt="$1"

    echo "[GEMINI] Generating multiple files..."

    local output
    output=$(bash "$REPO_DIR/agents/gemini-worker.sh" "$prompt")

    if [ $? -ne 0 ]; then
        echo "[GEMINI] ERROR: Generation failed"
        return 1
    fi

    # Parse output looking for --- FILE: path --- markers
    local current_file=""
    local file_content=""
    local file_count=0

    while IFS= read -r line; do
        if echo "$line" | grep -qE '^\-\-\- FILE: .+ \-\-\-$'; then
            # Save previous file
            if [ -n "$current_file" ]; then
                mkdir -p "$(dirname "$REPO_DIR/$current_file")"
                echo "$file_content" | sed '/^```[a-z]*$/d' | sed '/^```$/d' > "$REPO_DIR/$current_file"
                echo "[GEMINI] Written: $current_file"
                file_count=$((file_count + 1))
            fi
            # Start new file
            current_file=$(echo "$line" | sed 's/--- FILE: //;s/ ---//')
            file_content=""
        else
            file_content="${file_content}${line}\n"
        fi
    done <<< "$output"

    # Save last file
    if [ -n "$current_file" ]; then
        mkdir -p "$(dirname "$REPO_DIR/$current_file")"
        echo -e "$file_content" | sed '/^```[a-z]*$/d' | sed '/^```$/d' > "$REPO_DIR/$current_file"
        echo "[GEMINI] Written: $current_file"
        file_count=$((file_count + 1))
    fi

    echo "[GEMINI] Generated $file_count files"
}

# ============================================================
# CLAUDE FUNCTIONS (expensive tasks — use sparingly)
# ============================================================

# Run Claude for complex reasoning tasks
claude_task() {
    local prompt="$1"
    echo "[CLAUDE] Running: ${prompt:0:80}..."
    claude --dangerously-skip-permissions -p "$prompt"
}

# Claude with context file (more efficient)
claude_with_context() {
    local context_file="$1"
    local prompt="$2"
    echo "[CLAUDE] Running with context: ${prompt:0:80}..."
    claude --dangerously-skip-permissions -p "Read $context_file for project context. $prompt"
}

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

# Pre-read files and create a context snapshot (NO AI tokens used)
prepare_context() {
    local context_file="${1:-/tmp/jadisatu-context.md}"

    echo "[PREP] Building context snapshot..."

    cat > "$context_file" << 'CTX'
# Jadisatu Quick Context
## Architecture
- Dark Mode: /workspaces/jadisatu.cloud/frontend/ (Static HTML+JS)
- Light Mode: /workspaces/jadisatu.cloud/nextjs-app/ (Next.js 15, basePath: /light)
- Both share same Supabase DB
## Key paths
- Pages: nextjs-app/src/app/*/page.tsx
- API: nextjs-app/src/app/api/*/route.ts
- Components: nextjs-app/src/components/
- Supabase: nextjs-app/src/lib/supabase-browser.ts + supabase-server.ts
- Dark JS: frontend/js/
- SQL: sql/
## Tables: tasks, projects, ideas, contents, agents, activities, domains, schedule_blocks, morning_briefings, leads
## Personalities: Dark="Monk Mode" (minimal,calm), Light="Creator Mode" (warm,expressive)
CTX

    echo "[PREP] Context saved to $context_file"
}

# Verify build (NO AI tokens used)
verify_build() {
    echo "[BUILD] Verifying Next.js build..."
    cd "$REPO_DIR/nextjs-app"
    if npm run build 2>&1 | tail -3; then
        echo "[BUILD] ✓ Build passed"
        return 0
    else
        echo "[BUILD] ✗ Build failed"
        return 1
    fi
}

# Commit changes (NO AI tokens used)
commit_changes() {
    local message="$1"
    cd "$REPO_DIR"
    git add -A
    git diff --cached --quiet && { echo "[GIT] No changes to commit"; return 0; }
    git commit -m "$message"
    echo "[GIT] Committed: $message"
}

# ============================================================
# COST TRACKING
# ============================================================

GEMINI_CALLS=0
CLAUDE_CALLS=0

track_gemini() { GEMINI_CALLS=$((GEMINI_CALLS + 1)); }
track_claude() { CLAUDE_CALLS=$((CLAUDE_CALLS + 1)); }

print_cost_summary() {
    echo ""
    echo "============================================="
    echo "  COST SUMMARY"
    echo "============================================="
    echo "  Gemini calls: $GEMINI_CALLS (cheap/free)"
    echo "  Claude calls: $CLAUDE_CALLS (premium)"
    echo "  Estimated savings: ~$((GEMINI_CALLS * 70))% fewer Claude tokens"
    echo "============================================="
}
