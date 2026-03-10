#!/bin/bash
# Phase 10: Database Unification + Bug Fixes + localStorage Migration
# Both Dark (frontend/) and Light (nextjs-app/) must share ONE database, ONE auth, ONE truth.
set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 10: Database Unification + Bug Fixes"
echo "  $(date)"
echo "========================================="

# =========================================
# STEP 1: Claude performs the full unification
# =========================================
echo ""
echo ">>> Step 1: Claude performing database unification + bug fixes..."
echo "========================================="

PROMPT='Read /workspaces/jadisatu.cloud/CLAUDE.md for project context.

## SITUATION OVERVIEW

Jadisatu.cloud has TWO frontends that are currently NOT properly unified:

1. **Dark Mode** (frontend/) — Static HTML + Vanilla JS at jadisatu.cloud root
   - Uses: /frontend/js/config.js → window.supabase.createClient() with hardcoded credentials
   - Auth: /frontend/js/auth.js + auth-helper.js (browser session + localStorage fallback)
   - Data: /frontend/js/data-service.js (direct Supabase client queries with RLS)
   - Creative Hub: /frontend/js/creative-hub-service.js → STORES IN localStorage (NOT Supabase!)
   - Morning Briefing: /frontend/js/morning-briefing-service.js → STORES IN localStorage (NOT Supabase!)
   - Tables used: tasks, projects, domains, schedule_blocks, morning_briefings, connected_agents
   - MISSING table usage: contents (doesnt exist in dark mode), leads (CRM uses different pattern)

2. **Light Mode** (nextjs-app/) — Next.js 15 at jadisatu.cloud/light
   - Uses: /nextjs-app/src/lib/supabase-browser.ts + supabase-server.ts (SSR pattern)
   - Auth: Supabase SSR + middleware.ts (cookie-based, more secure)
   - Data: API routes in /nextjs-app/src/app/api/ (server-side queries)
   - Tables used: tasks, projects, ideas, contents, agents, activities, domains, schedule_blocks, morning_briefings, leads, agent_logs
   - Has contents table (from Phase 2) that Dark mode doesnt use

Both frontends connect to the SAME Supabase instance: dwpkokavxjvtrltntjtn.supabase.co
Both SHOULD share the same data for the same user. But currently they dont because:
- Dark modes Creative Hub saves to localStorage instead of the contents table
- Dark modes Morning Briefing saves to localStorage instead of morning_briefings table
- Dark mode references connected_agents table, Light mode references agents table
- Activity logging is partial in Dark mode (_logActivity not called on notes/contacts/courses)
- Several UI bugs exist in Dark mode that need fixing

## YOUR TASKS

### Task 1: Audit Current Database Schema
Before making any changes, run these queries to understand what exists:

1. Check the Supabase tables by reading ALL SQL files in /workspaces/jadisatu.cloud/sql/
2. Read /workspaces/jadisatu.cloud/frontend/js/data-service.js to understand Dark modes data layer
3. Read /workspaces/jadisatu.cloud/frontend/js/creative-hub-service.js to understand Creative Hub storage
4. Read /workspaces/jadisatu.cloud/frontend/js/morning-briefing-service.js to understand Morning Briefing storage (or morning-briefing.js)
5. Read /workspaces/jadisatu.cloud/nextjs-app/src/app/api/ routes to understand Light modes data layer
6. Read /workspaces/jadisatu.cloud/frontend/js/config.js for Supabase config
7. Read /workspaces/jadisatu.cloud/nextjs-app/src/lib/supabase-browser.ts for Light mode Supabase config

### Task 2: Create Missing Database Tables (SQL Migrations)
Create SQL migration files in /workspaces/jadisatu.cloud/sql/ for any missing tables:

1. **contents table** — If not already created, create it with:
   - id (uuid, primary key, default gen_random_uuid())
   - title (text, not null)
   - script (text)
   - caption (text)
   - platform (text) -- instagram, tiktok, youtube, linkedin, twitter
   - status (text, default idea) -- idea, draft, script, ready, published
   - publish_date (timestamptz)
   - thumbnail (text)
   - image_assets (text[])
   - video_link (text)
   - carousel_assets (jsonb)
   - external_publish_id (text)
   - tags (text[])
   - project_id (uuid, references projects(id))
   - user_id (uuid, references auth.users(id), not null)
   - created_at (timestamptz, default now())
   - updated_at (timestamptz, default now())
   - RLS: Enable + user_id policies (SELECT, INSERT, UPDATE, DELETE)

2. **daily_briefing_log table** — For Morning Briefing data currently in localStorage:
   - id (uuid, primary key)
   - date (date, not null)
   - energy_level (integer, 1-10)
   - focus_domain (text)
   - priority_task (text)
   - blockers (text)
   - gratitude (text)
   - stoic_quote (text)
   - completed (boolean, default false)
   - user_id (uuid, references auth.users(id), not null)
   - created_at (timestamptz, default now())
   - RLS: Enable + user_id policies

3. **Verify existing tables** are correct:
   - ideas table: status CHECK should allow (active, archived) only
   - tasks table: status should allow (backlog, todo, in_progress, review, done)
   - agents vs connected_agents: determine which is canonical, create migration to unify

Create file: /workspaces/jadisatu.cloud/sql/phase-10-unify-database.sql

### Task 3: Fix Dark Mode — Creative Hub Storage (localStorage → Supabase)
File: /workspaces/jadisatu.cloud/frontend/js/creative-hub-service.js

Currently saves to localStorage. Refactor to use Supabase contents table:
- Replace localStorage.getItem/setItem with Supabase queries
- Use the same supabase client from config.js (window.supabase or the global client)
- Ensure all CRUD operations go through Supabase:
  - getItems() → supabase.from("contents").select("*").eq("user_id", userId).order("created_at", { ascending: false })
  - createItem(data) → supabase.from("contents").insert({ ...data, user_id: userId })
  - updateItem(id, data) → supabase.from("contents").update(data).eq("id", id).eq("user_id", userId)
  - deleteItem(id) → supabase.from("contents").delete().eq("id", id).eq("user_id", userId)
- Get userId from the current auth session: const { data: { user } } = await supabase.auth.getUser()
- Add error handling for each operation
- Keep the same public API so other dark mode files dont break

### Task 4: Fix Dark Mode — Morning Briefing Storage (localStorage → Supabase)
File: /workspaces/jadisatu.cloud/frontend/js/morning-briefing.js (or morning-briefing-service.js)

Currently saves to localStorage. Refactor to use Supabase:
- If morning_briefings table exists and matches the schema, use it directly
- If daily_briefing_log table was created in Task 2, use that
- Replace localStorage operations with Supabase queries
- Ensure data persists across devices/browsers
- Get userId from auth session
- Add fallback: if Supabase query fails, log error but dont crash the UI

### Task 5: Fix Bug FIX-01 — Date Header Stuck
File: /workspaces/jadisatu.cloud/frontend/js/ (find where date is rendered)

The date header on the dashboard shows a hardcoded or stale date. Fix:
- Find where the date is displayed in dashboard.html or its JS files
- Ensure it uses: new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
- Make it dynamic — should update on every page load
- Also check if nextjs-app/ dashboard has the same issue and fix if needed

### Task 6: Fix Bug FIX-05 — Life Balance Bar Always Shows 0
File: /workspaces/jadisatu.cloud/frontend/js/sidebar-metrics.js

Bug: pctEl.textContent shows total tasks count instead of balance percentage.
Fix:
- Calculate balance as: distribution evenness across domains
- Formula: For each domain, calculate (domain_tasks / total_tasks * 100). Balance = how evenly distributed
- Or simpler: balance = (completed_tasks / total_tasks * 100) as a progress percentage
- Display as percentage, not raw count
- Ensure the progress bar width matches the percentage

### Task 7: Fix Bug FIX-07 — Creative Hub Stage Buttons Missing
File: /workspaces/jadisatu.cloud/frontend/creative-hub-view.html (or related JS)

The Creative Hub has a pipeline: Idea → Script → Shoot → Publish
Backend service can update status, but UI has no buttons to trigger stage transitions.
Fix:
- Add "Move to Next Stage" button on each content card
- Add stage indicator showing current stage with visual progression
- Wire the button to call creative-hub-service.updateItem({ status: nextStage })
- Stage progression: idea → draft → script → ready → published
- Add visual feedback (toast notification) on successful transition
- IMPORTANT: Now that Creative Hub uses Supabase (Task 3), this should query the contents table

### Task 8: Fix Bug FIX-08 — Agent Timestamp Stale
File: /workspaces/jadisatu.cloud/frontend/js/views.js (renderAgentsView)

Agent "last active" shows stale timestamp because there is no heartbeat mechanism.
Fix:
- Read from agents table last_active field
- If no agent_activities exist, show "No activity recorded" instead of stale time
- Add a visual indicator: green dot if active within 5 min, yellow if within 1 hour, gray if older
- For now, the agents write their own heartbeat — the dashboard just needs to display it correctly

### Task 9: Fix Bug FIX-03 — Activity Logging Incomplete
File: /workspaces/jadisatu.cloud/frontend/js/data-service.js

_logActivity() is called for task CRUD but NOT for notes, contacts, courses.
Fix:
- Add _logActivity() calls to:
  - NoteService.createNote(), updateNote(), deleteNote()
  - ContactService.createContact(), updateContact(), deleteContact()
  - LearningService.createCourse(), updateCourse(), deleteCourse()
- Activity log format: { action: "created|updated|deleted", entity: "note|contact|course", details: { id, title }, source: "dark-mode" }
- This ensures the History view shows ALL activity, not just tasks

### Task 10: Ensure Light Mode API Routes Match
Verify and fix ALL API routes in /workspaces/jadisatu.cloud/nextjs-app/src/app/api/:

For each route, verify:
1. Authentication: Must call supabase.auth.getUser() and return 401 if not authenticated
2. User filtering: ALL queries must include .eq("user_id", user.id)
3. Table names: Must match the unified schema (especially contents, agents)

Check these specific routes:
- /api/tasks/route.ts — GET, POST must filter by user_id ✓
- /api/tasks/[id]/route.ts — PATCH, DELETE must verify ownership ✓
- /api/projects/route.ts — GET, POST must filter by user_id ✓
- /api/contents/route.ts — GET, POST, PATCH, DELETE must filter by user_id ✓
- /api/agents/route.ts — Should it filter by user? Agents might be global. Check current logic.
- /api/leads/route.ts — GET, POST must filter by user_id ✓
- /api/activities/route.ts — GET must filter by user_id ✓
- /api/schedule/route.ts — GET must filter by user_id ✓
- /api/morning-briefing/route.ts — GET must filter by user_id ✓
- /api/domains/route.ts — Must filter by user_id ✓

If any route is missing user authentication or filtering, FIX IT.

### Task 11: Synchronize Auth Between Modes
Both Dark and Light mode must recognize the same user session.

Current state:
- Dark mode: Uses Supabase JS client (browser-only), stores session in localStorage
- Light mode: Uses Supabase SSR client, stores session in cookies

For a user logged into Light mode (/light) to also be logged in on Dark mode (root /):
- Both use the same Supabase project, so the Supabase session token should be shared
- Verify that /frontend/js/auth.js checks for existing Supabase session from cookies (not just localStorage)
- If not, add a check: on dark mode page load, try to get session from Supabase (it should pick up the cookie)
- The key is: Supabase JS client v2 stores session in localStorage by default. If light mode sets it via cookies AND dark mode checks localStorage, they MIGHT NOT share sessions.
- SOLUTION: In Dark modes config.js, configure the Supabase client to use the same storage mechanism, OR add a session bridge that syncs between cookie-based and localStorage-based sessions.
- At minimum: if a user is logged in on one mode, navigating to the other should NOT require re-login.

### Task 12: Build and Validate
After ALL changes:

1. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npx tsc --noEmit
   - Fix ALL TypeScript errors
2. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npm run build
   - Fix ALL build errors
3. Verify the Dark mode HTML files are valid (no syntax errors in JS changes)
4. Create a summary of all changes made

### Design Rules
- Dark mode files (frontend/): Vanilla JS, no TypeScript, use existing patterns from data-service.js
- Light mode files (nextjs-app/): TypeScript strict, Tailwind CSS, Supabase from src/lib/
- SQL files: Idempotent migrations (use IF NOT EXISTS, CREATE OR REPLACE)
- All Supabase queries must respect RLS (include user_id in all operations)
- Do NOT delete any existing functionality — only add and fix
- Do NOT change the visual design of either mode — only fix data/functionality

### Commit Convention
After completing all tasks:
1. Stage all changed files
2. Commit with message: "Phase 10: Database unification + bug fixes + localStorage migration"
3. Do NOT push yet (the script handles pushing)

IMPORTANT: Read ALL referenced files before modifying them. Understand existing patterns first.'

claude --dangerously-skip-permissions -p "$PROMPT"

# =========================================
# STEP 2: Verify build
# =========================================
echo ""
echo ">>> Step 2: Verifying Next.js build..."
echo "========================================="
cd /workspaces/jadisatu.cloud/nextjs-app
npm run build || {
    echo "BUILD FAILED — running Claude to fix..."
    cd /workspaces/jadisatu.cloud
    claude --dangerously-skip-permissions -p "Read /workspaces/jadisatu.cloud/CLAUDE.md. The Next.js build failed after Phase 10 changes. Run 'cd /workspaces/jadisatu.cloud/nextjs-app && npm run build' to see the errors, then fix ALL of them. Only modify files in nextjs-app/. After fixing, run the build again to confirm it passes. Commit fixes with message 'fix: resolve Phase 10 build errors'."
}

# =========================================
# STEP 3: Push to GitHub
# =========================================
echo ""
echo ">>> PUSHING TO GITHUB"
echo "========================================="
cd /workspaces/jadisatu.cloud
git pull origin main --rebase || true
git push origin main

echo ""
echo "========================================="
echo "  Phase 10 Complete!"
echo "  Database unified, bugs fixed, localStorage migrated."
echo "  $(date)"
echo "========================================="
