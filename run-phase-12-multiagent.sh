#!/bin/bash
# ============================================================
# Phase 12: Dual Personality Polish — MULTI-AGENT VERSION
# ============================================================
#
# Model routing:
#   GEMINI: Boilerplate pages, CSS styling, simple code generation
#   CLAUDE: Integration logic, build fixes, complex debugging
#
# Token savings vs single-Claude: ~60-70%
#
# REQUIRES:
#   - GEMINI_API_KEY in environment or nextjs-app/.env.local
#   - Claude Code CLI (claude command)
#
# ============================================================

set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 12 (Multi-Agent): Dual Personality"
echo "  $(date)"
echo "========================================="

# Load multi-agent functions
source agents/multi-agent-runner.sh

# Prepare context (0 tokens — just bash)
prepare_context /tmp/jadisatu-context.md

# ============================================================
# TASK 1: Narrative Engine view for Dark Mode [GEMINI]
# Simple page generation — no complex logic needed
# ============================================================
echo ""
echo ">>> Task 1/6: Narrative Engine in Dark Mode [GEMINI]"
echo "========================================="

# First read the existing view pattern with bash (0 tokens)
echo "[PREP] Reading Dark Mode view pattern..."
VIEW_PATTERN=$(head -50 frontend/js/views.js 2>/dev/null || echo "// views.js not found")

gemini_write "frontend/js/narrative-engine-view.js" "
You are adding a Narrative Engine view to a Dark Mode dashboard (Monk Mode personality: minimal, calm, no emoji).

The existing app is a Single Page Application. Views are rendered as functions that return HTML strings and are injected into a container div.

Here is the existing pattern from views.js (first 50 lines):
$VIEW_PATTERN

Create a file narrative-engine-view.js that exports a function renderNarrativeEngineView() which:
1. Returns HTML string with:
   - A topic input field (dark styled, border-gray-700, bg-gray-800, text-white)
   - A 'Research' button (bg-blue-600)
   - A results div (initially hidden)
   - A 'Generate Content' button (shown after research)
   - A script output textarea (monospace, dark bg)
   - A 'Send to Creative Hub' button
2. All styling uses Tailwind classes with dark theme
3. The research button calls: fetch('/light/api/narrative/research', { method: 'POST', body: JSON.stringify({ topic }) })
4. The generate button calls: fetch('/light/api/narrative/generate', { method: 'POST', body: JSON.stringify({ research_summary }) })
5. The send-to-hub button calls creative hub service to create content
6. Monk Mode style: clean, dense, no decorations, no emoji
"
track_gemini
commit_changes "feat: add Narrative Engine view to Dark Mode (Gemini-generated)"

# ============================================================
# TASK 2: Cross-mode navigation [GEMINI]
# Simple HTML/React changes — no complex logic
# ============================================================
echo ""
echo ">>> Task 2/6: Cross-mode navigation [GEMINI]"
echo "========================================="

# Read current sidebar to understand structure (0 tokens)
echo "[PREP] Reading sidebar structures..."
DARK_SIDEBAR=$(grep -A5 "sidebar\|nav-item\|menu-item" frontend/dashboard.html 2>/dev/null | head -30 || echo "")
LIGHT_SIDEBAR_PATH=$(find nextjs-app/src -name "Sidebar*" -o -name "sidebar*" 2>/dev/null | head -1)

if [ -n "$LIGHT_SIDEBAR_PATH" ]; then
    LIGHT_SIDEBAR=$(cat "$LIGHT_SIDEBAR_PATH" 2>/dev/null | tail -30)
else
    LIGHT_SIDEBAR="// Sidebar not found - check nextjs-app/src/components/"
fi

# For Dark Mode: just add a link with sed (0 tokens!)
echo "[BASH] Adding mode switch to Dark Mode sidebar..."
if ! grep -q "Creator Mode" frontend/dashboard.html 2>/dev/null; then
    # Find the sidebar closing tag and add the link before it
    sed -i.bak '/<\/nav>/i\
    <a href="/light" class="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 hover:text-gray-300 mt-auto border-t border-gray-800 pt-2">Switch to Creator Mode →</a>' frontend/dashboard.html 2>/dev/null || echo "Could not auto-insert, Claude will handle"
fi

# For Light Mode: Claude handles because it needs to understand React component structure
# But we give it a VERY focused prompt
claude_task "Read $LIGHT_SIDEBAR_PATH (or find the Sidebar component in nextjs-app/src/components/).
Add ONE link at the bottom of the sidebar navigation: an <a href='/'> with text '🧘 Switch to Monk Mode' styled as a subtle link (text-sm text-gray-400 hover:text-gray-600). That is ALL — do not change anything else. Commit: 'feat: add Monk Mode switch to Light sidebar'"
track_claude

# ============================================================
# TASK 3: Dark Mode personality polish [GEMINI]
# Simple text/style changes — no logic
# ============================================================
echo ""
echo ">>> Task 3/6: Dark Mode personality polish [GEMINI]"
echo "========================================="

# Use bash/sed for simple text replacements (0 tokens!)
echo "[BASH] Polishing Dark Mode microcopy..."

cd /workspaces/jadisatu.cloud

# Fix greeting to Monk Mode style
sed -i.bak 's/Ready to create.*/Good evening./g' frontend/js/dashboard-init.js 2>/dev/null || true
sed -i.bak 's/Ready to create.*/Good evening./g' frontend/js/views.js 2>/dev/null || true

# Remove emoji from Dark Mode text
sed -i.bak 's/🎯//g; s/✨//g; s/🔥//g; s/☕//g; s/🎨//g; s/💡//g; s/🚀//g' frontend/js/views.js 2>/dev/null || true
sed -i.bak 's/🎯//g; s/✨//g; s/🔥//g; s/☕//g; s/🎨//g; s/💡//g; s/🚀//g' frontend/js/dashboard-init.js 2>/dev/null || true

# Clean up .bak files
find frontend/ -name "*.bak" -delete 2>/dev/null || true

commit_changes "refactor: polish Dark Mode Monk personality (bash-automated)"

# ============================================================
# TASK 4: Light Mode personality polish [GEMINI]
# Styling and microcopy — Gemini handles well
# ============================================================
echo ""
echo ">>> Task 4/6: Light Mode dashboard personality [GEMINI]"
echo "========================================="

# Read current dashboard (0 tokens)
DASHBOARD_CONTENT=$(cat nextjs-app/src/app/page.tsx 2>/dev/null | head -80)

gemini_task "Here is the current Light Mode dashboard (first 80 lines):

$DASHBOARD_CONTENT

Suggest specific text changes to make it feel like 'Creator Mode' — warm, inspiring, creative.
For each change, output the EXACT sed command I can run. Format:
sed -i 's/OLD_TEXT/NEW_TEXT/g' nextjs-app/src/app/page.tsx

Examples of Creator Mode microcopy:
- Greeting: 'Hey [Name]! Ready to create? ✨'
- Empty tasks: 'Your canvas is clean — what will you create today?'
- Loading: Use Tailwind animate-pulse skeleton divs

Output ONLY the sed commands, one per line. No explanations." | while read -r line; do
    if echo "$line" | grep -q "^sed"; then
        eval "$line" 2>/dev/null || echo "Skipped: $line"
    fi
done
track_gemini

commit_changes "refactor: polish Light Mode Creator personality (Gemini-guided)"

# ============================================================
# TASK 5: Loading/empty states [GEMINI]
# Template generation — Gemini's sweet spot
# ============================================================
echo ""
echo ">>> Task 5/6: Creator Mode loading states [GEMINI]"
echo "========================================="

# Create a shared loading component (Gemini generates, bash writes)
gemini_write "nextjs-app/src/components/ui/LoadingSkeleton.tsx" "
Create a reusable React loading skeleton component for a Creator Mode (warm, friendly) app.

'use client'

Export these components:
1. CardSkeleton — a rounded-3xl card with animate-pulse gray bars (title + 3 lines)
2. ListSkeleton — 5 rows of animate-pulse bars
3. PageSkeleton — full page skeleton (header bar + 3 CardSkeletons in a grid)
4. EmptyState — props: { icon: LucideIcon, title: string, description: string }
   Renders a centered card with the icon (text-blue-400), title (text-lg font-semibold), description (text-gray-500)

Use Tailwind CSS. Import from lucide-react for the icon type.
Creator Mode style: rounded-3xl, soft shadows, warm gray backgrounds, blue-400 accents.
"
track_gemini
commit_changes "feat: add Creator Mode loading skeleton components"

# ============================================================
# TASK 6: Build verify + fix [CLAUDE — only if needed]
# Claude ONLY for build errors (complex diagnosis)
# ============================================================
echo ""
echo ">>> Task 6/6: Build verification"
echo "========================================="

if verify_build; then
    echo "Build passed — no Claude needed!"
else
    echo "Build failed — calling Claude to fix..."
    claude_task "The Next.js build failed in /workspaces/jadisatu.cloud/nextjs-app.
Run 'cd /workspaces/jadisatu.cloud/nextjs-app && npm run build' to see errors.
Fix ALL errors. Only modify files in nextjs-app/. Rebuild to confirm.
Commit: 'fix: resolve Phase 12 build errors'"
    track_claude
fi

# ============================================================
# Push + Summary
# ============================================================
echo ""
echo ">>> PUSHING TO GITHUB"
echo "========================================="
cd /workspaces/jadisatu.cloud
git pull origin main --rebase || true
git push origin main

print_cost_summary

echo ""
echo "========================================="
echo "  Phase 12 (Multi-Agent) Complete!"
echo "  $(date)"
echo "========================================="
