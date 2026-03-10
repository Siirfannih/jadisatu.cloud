#!/bin/bash
# Phase 8: Port Cursor's dashboard design into nextjs-app (production app)
set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 8: Port Cursor Dashboard to Production"
echo "  $(date)"
echo "========================================="

# Step 1: Fetch Cursor branch as reference
echo ""
echo ">>> Step 1: Fetching Cursor branch as reference..."
echo "========================================="
git fetch origin cursor/development-environment-setup-7fa3

# Copy jadisatu-light folder as REFERENCE (not for deployment)
git checkout origin/cursor/development-environment-setup-7fa3 -- jadisatu-light/
echo ">>> Cursor's jadisatu-light/ copied as reference"

# Step 2: Claude ports the design into nextjs-app
echo ""
echo ">>> Step 2: Claude porting Cursor design into nextjs-app..."
echo "========================================="

PROMPT="Read /workspaces/jadisatu.cloud/CLAUDE.md for project context.

## ARCHITECTURE CONTEXT
The production site jadisatu.cloud/light is served by nextjs-app/ (basePath: /light, port 3000).
The folder jadisatu-light/ is a REFERENCE from Cursor — it is NOT deployed. Do NOT modify it.

## YOUR TASK
Port the best UI/UX from jadisatu-light/ (Cursor's work) INTO nextjs-app/ (production app).

### What to port:
1. **Dashboard page** (jadisatu-light/src/app/page.tsx → nextjs-app/src/app/page.tsx):
   - Welcome message with user greeting
   - Stats cards: Tasks Completed, Active Projects, Pending Tasks, Creative Output
   - Calendar widget with March 2026 calendar
   - Today's Tasks section with quick add
   - Creative Hub preview section
   - Activity timeline

2. **Sidebar** (jadisatu-light/src/components/Sidebar.tsx → nextjs-app/src/components/layout/Sidebar.tsx):
   - Navigation items: Dashboard, Calendar, Focus Mode, Tasks, Kanban, Projects, Creative Hub, AI Agents, CRM, Notes, History, Context Hub, Settings
   - Clean design with icons

3. **Components** to port:
   - OverviewCards.tsx (stats cards)
   - TasksList.tsx (today's tasks)
   - CreativePreview.tsx (creative hub preview)
   - ActivityTimeline.tsx (activity feed)
   - FocusWidget.tsx
   - TopNav.tsx (search bar, user avatar)

4. **Juru AI copilot** floating button and panel:
   - JuruFloatingButton.tsx
   - JuruPanel.tsx
   - JuruProvider.tsx

### Rules:
- ONLY modify files in nextjs-app/. Do NOT touch jadisatu-light/.
- Keep the existing basePath: /light in next.config.
- Keep all existing API routes in nextjs-app/src/app/api/.
- Keep the existing theme system (dark/light toggle from Phase 3).
- Ensure all Supabase queries use the existing lib from nextjs-app/src/lib/.
- After porting, run 'cd /workspaces/jadisatu.cloud/nextjs-app && npm run build' and fix ALL build errors.
- Commit with message 'Phase 8: Port Cursor dashboard design to production app'"

claude --dangerously-skip-permissions -p "$PROMPT"

# Step 3: Clean up reference folder
echo ""
echo ">>> Step 3: Cleanup..."
echo "========================================="
cd /workspaces/jadisatu.cloud
rm -rf jadisatu-light/
git add -A
git diff --cached --quiet || git commit -m "Phase 8: Remove jadisatu-light reference folder"

# Step 4: Push
echo ""
echo ">>> PUSHING TO GITHUB"
echo "========================================="
git pull origin main --rebase || true
git push origin main

echo ""
echo "========================================="
echo "  Phase 8 Complete!"
echo "  $(date)"
echo "========================================="
