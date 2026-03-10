#!/bin/bash
# Phase 13: Context Engine + Agent Connection Foundation
# OPTIMIZED VERSION — Split into micro-tasks to save tokens
set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 13 (Optimized): Context Engine"
echo "  $(date)"
echo "========================================="

# ============================================================
# STEP 0: Reuse context snapshot (created in Phase 12)
# ============================================================
echo ">>> Step 0: Generating context snapshot..."

cat > /tmp/jadisatu-context.md << 'CONTEXT_EOF'
# Jadisatu Quick Context

## Architecture
- Dark Mode: /workspaces/jadisatu.cloud/frontend/ (Static HTML+JS, served at root /)
- Light Mode: /workspaces/jadisatu.cloud/nextjs-app/ (Next.js 15, served at /light)
- Both share same Supabase DB
- API routes: nextjs-app/src/app/api/
- SQL migrations: /workspaces/jadisatu.cloud/sql/
- Supabase server client: nextjs-app/src/lib/supabase-server.ts
- Supabase browser client: nextjs-app/src/lib/supabase-browser.ts
- Env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY

## Existing API route pattern (copy this for new routes):
File: nextjs-app/src/app/api/tasks/route.ts
Pattern: import createClient from supabase-server → getUser() → query with user_id filter → return JSON

## Tables: tasks, projects, ideas, contents, agents, activities, domains, schedule_blocks, morning_briefings, leads
CONTEXT_EOF

# ============================================================
# MICRO-TASK 1: Create SQL migration for Context Engine tables
# ============================================================
echo ""
echo ">>> Micro-task 1/5: Create Context Engine database tables"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.
Read one existing SQL file in /workspaces/jadisatu.cloud/sql/ to understand the migration pattern.

YOUR TASK: Create /workspaces/jadisatu.cloud/sql/phase-13-context-engine.sql with these tables:

1. user_context — user's current working state:
   - id uuid PK default gen_random_uuid()
   - user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE
   - current_focus text
   - active_project_id uuid
   - active_content_id uuid
   - goals jsonb DEFAULT '[]'
   - preferences jsonb DEFAULT '{}'
   - mood text
   - energy_level integer
   - last_briefing_date date
   - updated_at timestamptz DEFAULT now()
   - RLS: users read/write own, service role reads all

2. agent_context — each agent's state per user:
   - id uuid PK default gen_random_uuid()
   - agent_name text NOT NULL
   - user_id uuid REFERENCES auth.users(id) NOT NULL
   - status text DEFAULT 'idle'
   - current_task text
   - last_result jsonb
   - last_active timestamptz DEFAULT now()
   - capabilities text[]
   - config jsonb DEFAULT '{}'
   - created_at timestamptz DEFAULT now()
   - updated_at timestamptz DEFAULT now()
   - UNIQUE(agent_name, user_id)
   - RLS: users read own, service role reads/writes all

3. context_events — timeline of all events:
   - id uuid PK default gen_random_uuid()
   - user_id uuid REFERENCES auth.users(id) NOT NULL
   - source text NOT NULL
   - event_type text NOT NULL
   - title text NOT NULL
   - details jsonb DEFAULT '{}'
   - entity_type text
   - entity_id uuid
   - created_at timestamptz DEFAULT now()
   - RLS: users read own, service role writes
   - INDEX on (user_id, created_at DESC)

Use IF NOT EXISTS everywhere. Commit: 'feat: add Context Engine database tables'"

# ============================================================
# MICRO-TASK 2: Create agent API endpoints
# ============================================================
echo ""
echo ">>> Micro-task 2/5: Create agent API endpoints"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.
Read /workspaces/jadisatu.cloud/nextjs-app/src/app/api/tasks/route.ts to understand the API route pattern.

YOUR TASK: Create 3 new API routes for agent communication.

1. nextjs-app/src/app/api/context-for-agent/route.ts (GET)
   - Auth: Check Authorization header for SUPABASE_SERVICE_KEY (not user session)
   - Query params: user_id, agent_name
   - Returns: { user: user_context row, agent: agent_context row, recent_events: last 20 context_events }
   - Use Supabase service key client for queries

2. nextjs-app/src/app/api/agent-report/route.ts (POST)
   - Auth: Check Authorization header for SUPABASE_SERVICE_KEY
   - Body: { user_id, agent_name, status, result, event: { event_type, title, details } }
   - Actions: Upsert agent_context + insert context_event
   - Returns: { success: true }

3. nextjs-app/src/app/api/agents/register/route.ts (POST)
   - Auth: Check Authorization header for SUPABASE_SERVICE_KEY
   - Body: { agent_name, user_id, capabilities }
   - Actions: Upsert agent_context with status=idle
   - Returns: { success: true, agent: agent_context row }

For service key auth pattern:
const serviceKey = request.headers.get('Authorization')?.replace('Bearer ', '')
if (serviceKey !== process.env.SUPABASE_SERVICE_KEY) return 401

Commit: 'feat: add agent communication API endpoints'"

# ============================================================
# MICRO-TASK 3: Create context updater utility
# ============================================================
echo ""
echo ">>> Micro-task 3/5: Create context updater utility"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.
Read /workspaces/jadisatu.cloud/nextjs-app/src/lib/supabase-browser.ts to understand the client pattern.

YOUR TASK: Create nextjs-app/src/lib/context-updater.ts

This utility auto-updates user_context when users perform actions. Export these functions:

export async function updateFocus(userId: string, focus: string)
  → upsert user_context set current_focus = focus, updated_at = now()

export async function updateActiveProject(userId: string, projectId: string)
  → upsert user_context set active_project_id = projectId, updated_at = now()

export async function updateActiveContent(userId: string, contentId: string)
  → upsert user_context set active_content_id = contentId, updated_at = now()

export async function updateFromBriefing(userId: string, data: { mood: string, energy_level: number })
  → upsert user_context set mood, energy_level, last_briefing_date = today, updated_at = now()

export async function logContextEvent(userId: string, event: { source: string, event_type: string, title: string, details?: object, entity_type?: string, entity_id?: string })
  → insert into context_events

Use createClient from supabase-browser for all queries.
Use upsert with onConflict: 'user_id' for user_context.

Commit: 'feat: add context updater utility'"

# ============================================================
# MICRO-TASK 4: Add Context Pulse widget to dashboards
# ============================================================
echo ""
echo ">>> Micro-task 4/5: Add Context Pulse widget"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Add a Context Pulse section to the Light Mode dashboard.

1. Read nextjs-app/src/app/page.tsx to understand the dashboard layout
2. Add a 'Context Pulse' card/section that shows:
   - Last focus: query user_context.current_focus
   - Agent status: query agent_context for all agents of this user (show name + status + last_active)
   - Recent events: query last 5 context_events
3. If tables dont exist yet (no data), show a friendly empty state
4. Style: Creator Mode personality (rounded-3xl card, warm text, emoji headers)
5. Only modify nextjs-app/ files

Commit: 'feat: add Context Pulse widget to Creator Mode dashboard'"

# ============================================================
# MICRO-TASK 5: Build verify
# ============================================================
echo ""
echo ">>> Micro-task 5/5: Build verification"
echo "========================================="

claude --dangerously-skip-permissions -p "YOUR TASK: Verify the Next.js build passes.
1. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npm run build
2. If there are errors, fix them
3. Run the build again to confirm
4. Commit fixes with: 'fix: resolve Phase 13 build errors'"

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
echo "  Phase 13 (Optimized) Complete!"
echo "  $(date)"
echo "========================================="
