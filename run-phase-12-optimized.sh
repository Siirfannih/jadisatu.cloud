#!/bin/bash
# Phase 12: Dual Personality Polish + Dark Mode Backport
# OPTIMIZED VERSION — Split into micro-tasks to save tokens
# Each micro-task is a focused, small Claude call (~500-800 word prompt)
set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 12 (Optimized): Dual Personality Polish"
echo "  $(date)"
echo "========================================="

# ============================================================
# STEP 0: Generate condensed context file
# This saves tokens because the agent reads 1 file instead of 40
# ============================================================
echo ">>> Step 0: Generating context snapshot..."

cat > /tmp/jadisatu-context.md << 'CONTEXT_EOF'
# Jadisatu Quick Context (for agent consumption)

## Architecture
- Dark Mode: /workspaces/jadisatu.cloud/frontend/ (Static HTML+JS, served at root /)
- Light Mode: /workspaces/jadisatu.cloud/nextjs-app/ (Next.js 15, served at /light)
- Both share same Supabase DB (dwpkokavxjvtrltntjtn.supabase.co)
- Supabase config Dark: frontend/js/config.js
- Supabase config Light: nextjs-app/src/lib/supabase-browser.ts

## Key Files (Dark Mode)
- frontend/dashboard.html — Main SPA (all views rendered here)
- frontend/js/views.js — View renderer (renderDashboard, renderKanban, etc.)
- frontend/js/data-service.js — TaskService, ProjectService CRUD
- frontend/js/creative-hub-service.js — Content CRUD (NOW uses Supabase contents table)
- frontend/js/config.js — Supabase client init
- frontend/js/auth.js — Auth flow
- frontend/js/juru-bubble.js — AI copilot

## Key Files (Light Mode)
- nextjs-app/src/app/page.tsx — Dashboard
- nextjs-app/src/app/creative/page.tsx — Creative Hub
- nextjs-app/src/app/narrative-engine/page.tsx — Narrative Engine
- nextjs-app/src/components/layout/Sidebar.tsx — Navigation sidebar
- nextjs-app/src/lib/supabase-browser.ts — Supabase client

## Two Personalities
- Dark = "Monk Mode": Calm, minimal, data-dense, no emoji, muted colors, concise text
- Light = "Creator Mode": Warm, spacious, expressive, tasteful emoji, vibrant colors, encouraging text

## Tables (shared): tasks, projects, ideas, contents, agents, activities, domains, schedule_blocks, morning_briefings, leads

## Phase 10-11 already completed: Database unified, bugs fixed, missing pages ported to Light Mode.
CONTEXT_EOF

echo "Context snapshot saved to /tmp/jadisatu-context.md"

# ============================================================
# MICRO-TASK 1: Backport Narrative Engine to Dark Mode
# ============================================================
echo ""
echo ">>> Micro-task 1/6: Backport Narrative Engine to Dark Mode"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for project context.

YOUR TASK: Add Narrative Engine as a new view in Dark Mode.

1. Read frontend/js/views.js to understand how views are rendered
2. Read frontend/dashboard.html to see how navigation works (sidebar links)
3. Add a new function renderNarrativeEngineView() in frontend/js/views.js that creates:
   - A topic input field and 'Research' button
   - A results area showing plain text blocks (Monk Mode = minimal, no cards)
   - A 'Generate Content' button that shows a script in a textarea
   - A 'Send to Creative Hub' button that calls creative-hub-service to create content
4. Add 'Narrative Engine' nav item in the sidebar in dashboard.html
5. For research/generate, call the Light Mode API: fetch('/light/api/narrative/research') and fetch('/light/api/narrative/generate')
6. Style: dark background, muted colors, monospace feel, NO emoji, data-dense

Commit: 'feat: add Narrative Engine view to Dark Mode'"

# ============================================================
# MICRO-TASK 2: Cross-mode navigation toggle
# ============================================================
echo ""
echo ">>> Micro-task 2/6: Cross-mode navigation"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for quick context.

YOUR TASK: Add mode-switching buttons to both Dark and Light mode.

1. In Dark Mode (frontend/dashboard.html):
   - Add a subtle link/button in the sidebar bottom: 'Switch to Creator Mode →'
   - It should be an <a href='/light'> link, styled subtly (small text, muted color)

2. In Light Mode (nextjs-app/src/components/layout/Sidebar.tsx or equivalent):
   - Read the sidebar component first to understand its structure
   - Add a button/link at the bottom: '🧘 Switch to Monk Mode'
   - It should be an <a href='/'> link

Commit: 'feat: add cross-mode navigation toggle'"

# ============================================================
# MICRO-TASK 3: Polish Dark Mode dashboard personality
# ============================================================
echo ""
echo ">>> Micro-task 3/6: Polish Dark Mode personality"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for quick context.

YOUR TASK: Polish Dark Mode dashboard to feel like 'Monk Mode' — focused, calm, minimal.

1. Read frontend/dashboard.html and frontend/js/dashboard-init.js
2. Ensure greeting is concise: 'Good morning, [Name].' (NO emoji, no exclamation marks)
3. Ensure stats are data-dense: large numbers, small labels
4. Ensure empty states are minimal: 'No tasks.' or 'Empty.' (not encouraging/creative text)
5. Remove any playful microcopy if it exists
6. Verify colors are muted/dark (no vibrant accents)
7. Only modify frontend/ files

Commit: 'refactor: polish Dark Mode Monk personality'"

# ============================================================
# MICRO-TASK 4: Polish Light Mode dashboard personality
# ============================================================
echo ""
echo ">>> Micro-task 4/6: Polish Light Mode personality"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for quick context.

YOUR TASK: Polish Light Mode dashboard to feel like 'Creator Mode' — warm, inspiring, creative.

1. Read nextjs-app/src/app/page.tsx (dashboard)
2. Ensure greeting is warm: 'Hey [Name]! Ready to create? ✨'
3. Ensure empty states are encouraging: e.g. 'Your canvas is clean — what will you create today?'
4. Add skeleton loaders for loading states (shimmer effect with Tailwind animate-pulse)
5. Verify cards have rounded-3xl, soft shadows, hover effects
6. Only modify nextjs-app/ files

Commit: 'refactor: polish Light Mode Creator personality'"

# ============================================================
# MICRO-TASK 5: Loading & empty states consistency
# ============================================================
echo ""
echo ">>> Micro-task 5/6: Loading & empty states"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for quick context.

YOUR TASK: Make loading and empty states consistent across Light Mode pages.

1. Read these pages and check their loading/empty states:
   - nextjs-app/src/app/kanban/page.tsx
   - nextjs-app/src/app/projects/page.tsx
   - nextjs-app/src/app/creative/page.tsx
   - nextjs-app/src/app/notes/page.tsx (if exists)
   - nextjs-app/src/app/focus/page.tsx (if exists)
2. For each page, ensure:
   - Loading state uses Tailwind animate-pulse skeleton (not just 'Loading...')
   - Empty state has warm, encouraging Creator Mode microcopy with a relevant emoji
   - Error state says something friendly like 'Oops! Something went sideways. Let us try again.'
3. Only modify nextjs-app/ files

Commit: 'refactor: consistent Creator Mode loading and empty states'"

# ============================================================
# MICRO-TASK 6: Build verify + final commit
# ============================================================
echo ""
echo ">>> Micro-task 6/6: Build verification"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for quick context.

YOUR TASK: Verify the Next.js build passes.

1. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npm run build
2. If there are errors, fix them
3. Run the build again to confirm it passes
4. Commit any fixes with: 'fix: resolve Phase 12 build errors'"

# ============================================================
# Push to GitHub
# ============================================================
echo ""
echo ">>> PUSHING TO GITHUB"
echo "========================================="
cd /workspaces/jadisatu.cloud
git pull origin main --rebase || true
git push origin main

echo ""
echo "========================================="
echo "  Phase 12 (Optimized) Complete!"
echo "  $(date)"
echo "========================================="
