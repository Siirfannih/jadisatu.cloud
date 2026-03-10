#!/bin/bash
# Phase 8: Merge Cursor's light mode improvements into main
set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 8: Merge Cursor Light Mode"
echo "  $(date)"
echo "========================================="

# Step 1: Fetch Cursor branch and copy jadisatu-light folder
echo ""
echo ">>> Step 1: Fetching Cursor branch files..."
echo "========================================="
git fetch origin cursor/development-environment-setup-7fa3

# Checkout only the jadisatu-light directory from cursor branch
git checkout origin/cursor/development-environment-setup-7fa3 -- jadisatu-light/

echo ">>> jadisatu-light folder copied from Cursor branch"

# Step 2: Install dependencies
echo ""
echo ">>> Step 2: Installing jadisatu-light dependencies..."
echo "========================================="
cd /workspaces/jadisatu.cloud/jadisatu-light
npm install

# Step 3: Run Claude to validate, fix issues, and ensure build works
echo ""
echo ">>> Step 3: Claude validating and fixing light mode..."
echo "========================================="
cd /workspaces/jadisatu.cloud

PROMPT="Read /workspaces/jadisatu.cloud/CLAUDE.md for project context.

You just merged the jadisatu-light/ folder from the Cursor branch. This is a separate Next.js app for the LIGHT MODE of Jadisatu.cloud.

Your tasks:
1. Check jadisatu-light/src/app/ for all pages and ensure they work
2. Verify jadisatu-light/.env.local exists with Supabase credentials (copy from nextjs-app/.env.local if missing)
3. Run 'cd /workspaces/jadisatu.cloud/jadisatu-light && npm run build' and fix ANY build errors
4. Ensure the dashboard page (jadisatu-light/src/app/page.tsx) has the rich layout: Welcome message, stats cards (Tasks Completed, Active Projects, Pending Tasks, Creative Output), Calendar widget, Today's Tasks, Creative Hub preview
5. Ensure Sidebar has all navigation items: Dashboard, Calendar, Focus Mode, Tasks, Kanban, Projects, Creative Hub, AI Agents, CRM, Notes, History, Context Hub, Settings
6. Verify Juru AI copilot floating button exists and works
7. Verify theme is LIGHT mode with the correct color palette
8. Fix any console errors or broken imports
9. Commit all changes with message 'Phase 8: Merge Cursor light mode with full dashboard'

IMPORTANT: Only modify files in jadisatu-light/ directory. Do NOT touch nextjs-app/ files."

claude --dangerously-skip-permissions -p "$PROMPT"

# Step 4: Push
echo ""
echo ">>> PUSHING TO GITHUB"
echo "========================================="
cd /workspaces/jadisatu.cloud
git push origin main

echo ""
echo "========================================="
echo "  Phase 8 Complete!"
echo "  $(date)"
echo "========================================="
