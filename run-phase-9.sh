#!/bin/bash
# Phase 9: Sync Light Mode with Dark Mode - Missing Pages + Shared Database
set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 9: Sync Light & Dark Mode"
echo "  $(date)"
echo "========================================="

PROMPT="Read /workspaces/jadisatu.cloud/CLAUDE.md for project context.

## ARCHITECTURE
- jadisatu.cloud (root) = Static HTML dark mode served from frontend/
- jadisatu.cloud/light = Next.js app from nextjs-app/ (basePath: /light, port 3000)
- BOTH modes use the SAME Supabase database (same tables, same data, same user accounts)
- The Next.js app at nextjs-app/ serves the light mode at /light path

## PROBLEM
1. Several pages in the Sidebar return 404 because they don't exist yet:
   - /calendar (404)
   - /focus (Focus Mode) (404)
   - /tasks (404)
   - /crm (404)
   - /notes (404)

2. Data is not synced — Kanban and Creative Hub show different content between dark and light mode. This is likely because they query different tables or use different user contexts. Both should read from the SAME Supabase tables with the SAME user_id filter.

## YOUR TASKS

### Task 1: Create Missing Pages
Create these pages in nextjs-app/src/app/ following the JadisatuLight design style (clean, light, rounded corners, Lucide icons, blue-600 accent, same Sidebar/TopNav layout):

1. **nextjs-app/src/app/calendar/page.tsx**
   - Monthly calendar view with events
   - Pull schedule_blocks from Supabase for the selected date
   - Allow adding new schedule blocks
   - Clean card-based design matching the dashboard style

2. **nextjs-app/src/app/focus/page.tsx**
   - Focus/productivity mode page
   - Show today's priority tasks (from tasks table, status != 'done')
   - Pomodoro timer or focus timer widget
   - Quick task completion toggle

3. **nextjs-app/src/app/tasks/page.tsx**
   - Full task list view (different from Kanban)
   - Filter by status, priority, domain
   - Sort by date, priority
   - Add/edit/delete tasks
   - Uses the same 'tasks' table as Kanban

4. **nextjs-app/src/app/crm/page.tsx**
   - CRM page showing leads from the 'leads' table
   - Display lead source, pain points, status
   - Uses existing /api/leads route

5. **nextjs-app/src/app/notes/page.tsx**
   - Quick notes page
   - Uses the 'ideas' table with source='quick-note' or source='manual'
   - Add/edit/delete notes
   - Tag support (#tags)
   - Search functionality

### Task 2: Database Synchronization
Ensure ALL pages in nextjs-app/ query the SAME Supabase tables as the dark mode frontend:

- **Kanban** (nextjs-app/src/app/kanban/page.tsx): Must use 'tasks' table with user_id filter via Supabase auth
- **Creative Hub** (nextjs-app/src/app/creative/page.tsx): Must use 'contents' table (if exists) or 'ideas' table
- **Projects** (nextjs-app/src/app/projects/page.tsx): Must use 'projects' table
- **Ideas** (nextjs-app/src/app/ideas/page.tsx): Must use 'ideas' table
- **History** (nextjs-app/src/app/history/page.tsx): Must use 'history' table

Check each page's data fetching:
1. Verify it uses supabase.auth.getUser() to get the current user
2. Verify queries filter by user_id
3. Verify all CRUD operations include user_id
4. Verify the API routes in nextjs-app/src/app/api/ properly authenticate and filter by user

### Task 3: Verify API Routes
Check all API routes in nextjs-app/src/app/api/:
- /api/tasks - must filter by authenticated user
- /api/projects - must filter by authenticated user
- /api/contents - must filter by authenticated user
- /api/activities - must filter by authenticated user
- /api/leads - must filter by authenticated user
- /api/schedule - must filter by authenticated user

If any API route does NOT filter by user, fix it.

### Task 4: Build and Validate
1. Run 'cd /workspaces/jadisatu.cloud/nextjs-app && npm run build'
2. Fix ALL build errors
3. Verify all new pages compile
4. Commit with message 'Phase 9: Add missing pages and sync database across modes'

### Design Rules
- Use 'use client' for interactive pages
- Import createClient from '@/lib/supabase-browser'
- Use Tailwind CSS with theme-aware classes (text-foreground, bg-card, border-border, etc.)
- Use Lucide React icons
- All pages must work in BOTH light and dark themes
- Follow the rounded-3xl card style from the dashboard
- Use the same color palette (blue-600 primary, purple for accents)
- Responsive design (mobile-friendly)

IMPORTANT: Only modify files in nextjs-app/. Do NOT touch frontend/ or other directories."

claude --dangerously-skip-permissions -p "$PROMPT"

# Push
echo ""
echo ">>> PUSHING TO GITHUB"
echo "========================================="
cd /workspaces/jadisatu.cloud
git pull origin main --rebase || true
git push origin main

echo ""
echo "========================================="
echo "  Phase 9 Complete!"
echo "  $(date)"
echo "========================================="
