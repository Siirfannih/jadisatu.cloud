#!/bin/bash
# Jadisatu.cloud - Autonomous Phase Runner
# Jalankan sekali, semua fase dikerjakan otomatis

set -e

cd /workspaces/jadisatu.cloud/nextjs-app

echo "========================================="
echo "  Jadisatu.cloud Autonomous Builder"
echo "  $(date)"
echo "========================================="

PROMPT_BASE="Read /workspaces/jadisatu.cloud/CLAUDE.md and /workspaces/jadisatu.cloud/jadisatu-codespace-prompt.md for full context."

# Phase 1
echo ""
echo ">>> PHASE 1: Fix Database Bug"
echo "========================================="
claude --dangerously-skip-permissions -p "$PROMPT_BASE Execute Phase 1 ONLY: Fix the ideas_status_check database constraint bug. Create the new contents table. Create SQL migration files. Commit all changes with message 'Phase 1: Fix database constraint and create contents table'."

# Phase 2
echo ""
echo ">>> PHASE 2: Refactor Creative Hub"
echo "========================================="
claude --dangerously-skip-permissions -p "$PROMPT_BASE Check git log for completed phases. Execute Phase 2 ONLY: Refactor Creative Hub with 3-panel layout (left: content library, center: editor, right: metadata, top: pipeline indicator). Reference /workspaces/Jadisatulight/app/creative/page.tsx for layout. Connect to contents table. Commit with message 'Phase 2: Refactor Creative Hub layout'."

# Phase 3
echo ""
echo ">>> PHASE 3: Theme System"
echo "========================================="
claude --dangerously-skip-permissions -p "$PROMPT_BASE Check git log for completed phases. Execute Phase 3 ONLY: Implement Dark + Light theme system using CSS variables and Tailwind dark: classes. Reference /workspaces/Jadisatulight/app/globals.css and /workspaces/Jadisatulight/tailwind.config.ts for light palette. Add theme toggle. Ensure all existing pages work in both themes. Commit with message 'Phase 3: Implement theme system'."

# Phase 4
echo ""
echo ">>> PHASE 4: Narrative Engine Page"
echo "========================================="
claude --dangerously-skip-permissions -p "$PROMPT_BASE Check git log for completed phases. Execute Phase 4 ONLY: Create /narrative-engine page. Study /workspaces/jadisatu-narrative-engine/workflow.json for workflow logic. Build UI for topic input, research results, and content generation. Create API routes /api/narrative/research and /api/narrative/generate. Commit with message 'Phase 4: Create Narrative Engine page'."

# Phase 5
echo ""
echo ">>> PHASE 5: Integrate Narrative Engine + Creative Hub"
echo "========================================="
claude --dangerously-skip-permissions -p "$PROMPT_BASE Check git log for completed phases. Execute Phase 5 ONLY: Add 'Send to Creative Hub' button on Narrative Engine outputs. Create content entry in contents table with pre-filled data from generated research. Commit with message 'Phase 5: Integrate Narrative Engine with Creative Hub'."

# Phase 6
echo ""
echo ">>> PHASE 6: Juru AI Copilot"
echo "========================================="
claude --dangerously-skip-permissions -p "$PROMPT_BASE Check git log for completed phases. Execute Phase 6 ONLY: Create Juru AI copilot as a floating chat component accessible from all pages. Implement action patterns: create content idea, generate script, break into formats, create tasks, run research. Wire to Creative Hub and Narrative Engine. Commit with message 'Phase 6: Implement Juru AI Copilot'."

# Phase 7
echo ""
echo ">>> PHASE 7: Cross-Theme Validation"
echo "========================================="
claude --dangerously-skip-permissions -p "$PROMPT_BASE Check git log for completed phases. Execute Phase 7 ONLY: Test ALL features in both Dark and Light themes. Fix any console errors. Verify all routes load. Verify CRUD operations work. Verify database constraints. Run npm run build and fix any build errors. Commit with message 'Phase 7: Cross-theme validation and fixes'."

# Push all changes
echo ""
echo ">>> PUSHING TO GITHUB"
echo "========================================="
cd /workspaces/jadisatu.cloud
git push origin main

echo ""
echo "========================================="
echo "  ALL PHASES COMPLETE!"
echo "  $(date)"
echo "  Check: github.com/Siirfannih/jadisatu.cloud"
echo "========================================="
