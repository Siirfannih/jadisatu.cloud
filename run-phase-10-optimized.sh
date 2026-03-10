#!/bin/bash
# Phase 10: Database Unification + Bug Fixes + localStorage Migration
# OPTIMIZED VERSION — Split into 6 micro-tasks to save tokens
# Each micro-task is focused (~500-800 word prompt)
set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 10 (Optimized): Database Unification"
echo "  $(date)"
echo "========================================="

# ============================================================
# STEP 0: Generate condensed context file
# ============================================================
echo ">>> Step 0: Generating context snapshot..."

cat > /tmp/jadisatu-context.md << 'CONTEXT_EOF'
# Jadisatu Quick Context

## Architecture
- Dark Mode: /workspaces/jadisatu.cloud/frontend/ (Static HTML+JS, served at root /)
- Light Mode: /workspaces/jadisatu.cloud/nextjs-app/ (Next.js 15, served at /light)
- Both share same Supabase DB (dwpkokavxjvtrltntjtn.supabase.co)
- Supabase config Dark: frontend/js/config.js
- Supabase config Light: nextjs-app/src/lib/supabase-browser.ts

## Key Files (Dark Mode)
- frontend/dashboard.html — Main SPA
- frontend/js/views.js — View renderer
- frontend/js/data-service.js — TaskService, ProjectService CRUD
- frontend/js/creative-hub-service.js — Content CRUD (currently localStorage!)
- frontend/js/morning-briefing.js or morning-briefing-service.js — Briefing (currently localStorage!)
- frontend/js/config.js — Supabase client init
- frontend/js/auth.js — Auth flow
- frontend/js/sidebar-metrics.js — Life balance sidebar

## Key Files (Light Mode)
- nextjs-app/src/app/page.tsx — Dashboard
- nextjs-app/src/app/api/ — All API routes
- nextjs-app/src/lib/supabase-browser.ts — Supabase browser client
- nextjs-app/src/lib/supabase-server.ts — Supabase server client
- nextjs-app/src/middleware.ts — Auth middleware

## SQL Files: /workspaces/jadisatu.cloud/sql/
## Tables: tasks, projects, ideas, contents, agents, activities, domains, schedule_blocks, morning_briefings, leads
CONTEXT_EOF

echo "Context snapshot saved to /tmp/jadisatu-context.md"

# ============================================================
# MICRO-TASK 1: SQL Migration — create/verify all tables
# ============================================================
echo ""
echo ">>> Micro-task 1/6: SQL Migration"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Create a unified SQL migration file.

1. Read ALL files in /workspaces/jadisatu.cloud/sql/ to understand existing tables
2. Read frontend/js/creative-hub-service.js to see what fields Creative Hub uses
3. Read frontend/js/data-service.js to see what tables Dark mode expects

Create file: /workspaces/jadisatu.cloud/sql/phase-10-unify-database.sql

This SQL must (use IF NOT EXISTS everywhere):
- Ensure 'contents' table exists with: id uuid PK, title text, script text, caption text, platform text, status text DEFAULT 'idea', publish_date timestamptz, thumbnail text, image_assets text[], video_link text, carousel_assets jsonb, tags text[], project_id uuid, user_id uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz, updated_at timestamptz
- Ensure 'agents' table is canonical (not 'connected_agents'). If connected_agents exists, add a view or alias.
- Add RLS policies on contents for user_id-based access
- Ensure morning_briefings table has: id, date, energy_level int, focus_domain text, priority_task text, blockers text, gratitude text, completed boolean, user_id uuid, created_at timestamptz
- Add indexes on user_id + created_at for contents and morning_briefings

Commit: 'feat: Phase 10 SQL migration — unify database tables'"

# ============================================================
# MICRO-TASK 2: Fix Creative Hub — localStorage to Supabase
# ============================================================
echo ""
echo ">>> Micro-task 2/6: Creative Hub localStorage → Supabase"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Migrate Dark Mode Creative Hub from localStorage to Supabase.

1. Read frontend/js/creative-hub-service.js (the current implementation)
2. Read frontend/js/config.js to understand how Supabase client is initialized
3. Read frontend/js/auth.js to understand how to get current user ID

Refactor creative-hub-service.js:
- Replace ALL localStorage.getItem/setItem with Supabase queries to 'contents' table
- getItems() → supabase.from('contents').select('*').eq('user_id', userId).order('created_at', {ascending: false})
- createItem(data) → supabase.from('contents').insert({...data, user_id: userId})
- updateItem(id, data) → supabase.from('contents').update(data).eq('id', id).eq('user_id', userId)
- deleteItem(id) → supabase.from('contents').delete().eq('id', id).eq('user_id', userId)
- Get userId: const { data: { user } } = await supabase.auth.getUser()
- Keep the same public API so other files don't break
- Add error handling (console.error, don't throw — graceful degradation)

Commit: 'feat: migrate Creative Hub from localStorage to Supabase'"

# ============================================================
# MICRO-TASK 3: Fix Morning Briefing — localStorage to Supabase
# ============================================================
echo ""
echo ">>> Micro-task 3/6: Morning Briefing localStorage → Supabase"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Migrate Dark Mode Morning Briefing from localStorage to Supabase.

1. Find the morning briefing file: check frontend/js/morning-briefing.js or morning-briefing-service.js
2. Read it to understand current localStorage usage
3. Read frontend/js/config.js for Supabase client

Refactor the morning briefing file:
- Replace ALL localStorage operations with Supabase queries to 'morning_briefings' table
- saveBriefing(data) → supabase.from('morning_briefings').upsert({...data, user_id: userId, date: today})
- getBriefing(date) → supabase.from('morning_briefings').select('*').eq('user_id', userId).eq('date', date).single()
- getStreak() → supabase.from('morning_briefings').select('date').eq('user_id', userId).order('date', {ascending: false})
  Then count consecutive days from today
- Keep the same public API
- Add error handling (graceful degradation)

Commit: 'feat: migrate Morning Briefing from localStorage to Supabase'"

# ============================================================
# MICRO-TASK 4: Fix Dark Mode bugs (Date, Life Balance, Stage Buttons)
# ============================================================
echo ""
echo ">>> Micro-task 4/6: Fix Dark Mode UI bugs"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Fix 3 Dark Mode UI bugs.

BUG 1 — Date Header Stuck:
1. Read frontend/dashboard.html and find where date is displayed
2. Ensure it uses: new Date().toLocaleDateString('id-ID', {weekday:'long', year:'numeric', month:'long', day:'numeric'})
3. Must be dynamic (update on each page load)

BUG 2 — Life Balance Bar Always 0:
1. Read frontend/js/sidebar-metrics.js (or wherever life balance is calculated)
2. Fix: balance should be (completed_tasks / total_tasks * 100) as percentage
3. Display as percentage, ensure progress bar width matches

BUG 3 — Creative Hub Stage Buttons Missing:
1. Read frontend/ files related to Creative Hub view (creative-hub-view.html or views.js)
2. Add 'Move to Next Stage' button on each content card
3. Stage progression: idea → draft → script → ready → published
4. Wire button to call creative-hub-service.updateItem({ status: nextStage })
5. Add visual stage indicator

Commit: 'fix: resolve Dark Mode UI bugs (date, balance, stage buttons)'"

# ============================================================
# MICRO-TASK 5: Fix Activity Logging + API Route Verification
# ============================================================
echo ""
echo ">>> Micro-task 5/6: Activity logging + API verification"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Fix activity logging and verify Light Mode API routes.

PART A — Activity Logging:
1. Read frontend/js/data-service.js
2. Find _logActivity() function
3. Add _logActivity() calls to: NoteService.create/update/delete, ContactService.create/update/delete
4. Log format: { action: 'created|updated|deleted', entity: 'note|contact', details: {id, title}, source: 'dark-mode' }

PART B — API Route Verification:
1. Read ALL route.ts files in nextjs-app/src/app/api/
2. For EACH route, verify:
   - Authentication: calls supabase.auth.getUser() and returns 401 if not authenticated
   - User filtering: ALL queries include .eq('user_id', user.id)
3. Fix any route that is missing auth or user filtering
4. Check table names match unified schema

Commit: 'fix: complete activity logging + verify API routes'"

# ============================================================
# MICRO-TASK 6: Build verify
# ============================================================
echo ""
echo ">>> Micro-task 6/6: Build verification"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Verify the Next.js build passes.

1. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npm run build
2. If there are errors, fix ALL of them
3. Run the build again to confirm it passes
4. Commit any fixes with: 'fix: resolve Phase 10 build errors'"

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
echo "  Phase 10 (Optimized) Complete!"
echo "  $(date)"
echo "========================================="
