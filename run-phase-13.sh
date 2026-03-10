#!/bin/bash
# Phase 13: Context Engine + Agent Connection Foundation
# Build the unified context layer that all agents can read/write.
# This is the KEY infrastructure that unlocks the multi-agent system.
set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 13: Context Engine + Agent Connection"
echo "  $(date)"
echo "========================================="

# =========================================
# STEP 1: Claude builds Context Engine
# =========================================
echo ""
echo ">>> Step 1: Claude building Context Engine..."
echo "========================================="

PROMPT='Read /workspaces/jadisatu.cloud/CLAUDE.md for project context.

## CONTEXT

Phases 10-12 unified the database, ported features, and polished both personalities.
Now we build the FOUNDATIONAL INFRASTRUCTURE that enables the multi-agent system:
the Context Engine — a unified data layer that ALL agents can read from and write to.

Currently:
- Agents (Hunter, Visual Engine, OpenClaw) exist but CANNOT read/write Jadisatu data
- agent_activities table exists but has 0 rows — no agent has ever written to it
- There is no mechanism for agents to understand user context
- There is no API for agents to report their status or results

## ARCHITECTURE OVERVIEW

```
User (Dark/Light Mode)
    |
    v
Jadisatu.cloud (Dashboard)
    |
    v
Context Engine (Supabase)
    |--- user_context (what user is working on, preferences, goals)
    |--- agent_context (what each agent knows, last results)
    |--- context_events (timestamped events from all sources)
    |
    |---> /api/context-for-agent (READ endpoint — agents pull context)
    |---> /api/agent-report (WRITE endpoint — agents push results)
    |
    v
Agents (Hunter, Visual Engine, Narrative Engine, Juru, OpenClaw)
```

## YOUR TASKS

### Task 1: Create Context Engine Database Tables
Create SQL migration: /workspaces/jadisatu.cloud/sql/phase-13-context-engine.sql

1. **user_context** — Stores the users current working context:
   ```sql
   CREATE TABLE IF NOT EXISTS user_context (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES auth.users(id) NOT NULL,
     current_focus text,              -- what user is working on right now
     active_project_id uuid REFERENCES projects(id),
     active_content_id uuid,          -- content being edited
     goals jsonb DEFAULT "[]"::jsonb, -- array of current goals
     preferences jsonb DEFAULT "{}"::jsonb, -- user preferences for agents
     mood text,                       -- from morning briefing
     energy_level integer,            -- 1-10 from morning briefing
     last_briefing_date date,
     updated_at timestamptz DEFAULT now(),
     UNIQUE(user_id)
   );
   ```
   - RLS: user can only read/write own context
   - Service role can read all (for agents)

2. **agent_context** — Each agents knowledge and state:
   ```sql
   CREATE TABLE IF NOT EXISTS agent_context (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     agent_name text NOT NULL,         -- hunter, visual-engine, narrative, juru, openclaw
     user_id uuid REFERENCES auth.users(id) NOT NULL,
     status text DEFAULT "idle",       -- idle, working, error, completed
     current_task text,
     last_result jsonb,                -- last output from this agent
     last_active timestamptz DEFAULT now(),
     capabilities text[],             -- what this agent can do
     config jsonb DEFAULT "{}"::jsonb, -- agent-specific config
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now(),
     UNIQUE(agent_name, user_id)
   );
   ```
   - RLS: user can read own agent contexts
   - Service role can read/write all

3. **context_events** — Timeline of all events from all sources:
   ```sql
   CREATE TABLE IF NOT EXISTS context_events (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES auth.users(id) NOT NULL,
     source text NOT NULL,            -- dashboard, hunter, visual-engine, narrative, juru, openclaw, system
     event_type text NOT NULL,        -- task_completed, content_created, research_done, lead_found, etc.
     title text NOT NULL,
     details jsonb DEFAULT "{}"::jsonb,
     entity_type text,                -- task, content, project, lead, etc.
     entity_id uuid,                  -- reference to the entity
     created_at timestamptz DEFAULT now()
   );
   ```
   - RLS: user can read own events
   - Service role can write events (agents use service key)
   - Index on user_id, created_at DESC
   - Index on source, event_type

### Task 2: Create Agent API Endpoints (Light Mode)
These endpoints allow agents to interact with Jadisatu:

1. **GET /api/context-for-agent/route.ts**
   Purpose: Agents call this to get user context before performing work.
   Auth: Requires SUPABASE_SERVICE_KEY in Authorization header (agent auth, not user auth)
   Query params: ?user_id=xxx&agent_name=yyy
   Response:
   ```json
   {
     "user": {
       "current_focus": "...",
       "active_project": { "id": "...", "name": "..." },
       "goals": [...],
       "mood": "focused",
       "energy_level": 8
     },
     "recent_events": [...last 20 events],
     "agent_state": {
       "status": "idle",
       "last_result": {...},
       "last_active": "..."
     },
     "pending_tasks": [...tasks assigned to this agent]
   }
   ```

2. **POST /api/agent-report/route.ts**
   Purpose: Agents call this to report their work results.
   Auth: Requires SUPABASE_SERVICE_KEY
   Body:
   ```json
   {
     "user_id": "...",
     "agent_name": "hunter",
     "status": "completed",
     "result": { ... agent output ... },
     "event": {
       "event_type": "lead_found",
       "title": "Found 5 new leads on Reddit",
       "details": { "count": 5, "source": "reddit" }
     }
   }
   ```
   Actions:
   - Update agent_context (status, last_result, last_active)
   - Insert context_event
   - Return success

3. **GET /api/context-digest/route.ts** (update existing if it exists)
   Purpose: Dashboard calls this to get a summary for display.
   Auth: Normal user auth (Supabase session)
   Response:
   ```json
   {
     "summary": "Today: 3 tasks completed, 2 new leads found, 1 content published",
     "agents": [
       { "name": "hunter", "status": "idle", "last_active": "2h ago", "last_result_summary": "Found 5 leads" },
       { "name": "visual-engine", "status": "idle", "last_active": "1d ago" }
     ],
     "recent_events": [...last 10 events],
     "focus_suggestion": "You have 2 scripts ready for review"
   }
   ```

### Task 3: Update Agents Dashboard (Both Modes)

#### Light Mode (/light/agents):
Update nextjs-app/src/app/agents/page.tsx to:
- Show real agent status from agent_context table
- Display last_active with relative time ("2 hours ago")
- Show status indicator: green (active), yellow (idle <1h), gray (idle >1h), red (error)
- Show last_result summary for each agent
- Show recent context_events filtered by agent
- Creator personality: "Your AI crew 🤖" header, friendly agent cards with avatars

#### Dark Mode (/agents or within dashboard.html):
Update the agent view in frontend/ to:
- Query agent_context table instead of (or in addition to) agents table
- Show real-time status and last results
- Monk Mode personality: Dense table view, status dots, no decorations

### Task 4: Auto-Update User Context
When users perform actions in the dashboard, auto-update user_context:

In Light Mode (nextjs-app/):
- When user opens a project → update user_context.active_project_id
- When user edits content → update user_context.active_content_id
- When user completes morning briefing → update mood + energy_level + last_briefing_date
- Create a utility: src/lib/context-updater.ts with functions:
  - updateFocus(userId, focus)
  - updateActiveProject(userId, projectId)
  - updateActiveContent(userId, contentId)
  - updateFromBriefing(userId, { mood, energy_level })

In Dark Mode (frontend/):
- Add similar context updates in data-service.js or a new context-service.js
- Call these when user navigates between views or completes actions

### Task 5: Context-Aware Dashboard Widgets

#### Light Mode Dashboard (Creator Mode):
Add a "Context Pulse" widget showing:
- "You were working on: [last active content title]"
- "Your agents found: [summary of recent agent results]"
- "Suggested next: [based on content pipeline status]"
  - e.g., "You have 3 scripts ready for shoot stage 🎬"

#### Dark Mode Dashboard (Monk Mode):
Add a "Status" section showing:
- Current focus: [project name or content title]
- Agent status: [compact status line]
- Next action: [data-driven suggestion]

### Task 6: Create Agent Registration Endpoint
POST /api/agents/register/route.ts
Purpose: When an agent starts up, it registers itself with Jadisatu.
Body: { agent_name, capabilities, user_id }
Actions:
- Upsert into agent_context
- Set status to "idle"
- Return agent config and user context

### Task 7: Build and Validate
1. Run SQL migrations (note in comments that these need to be run on Supabase)
2. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npx tsc --noEmit
3. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npm run build
4. Verify API endpoints compile (the actual agent integration will be tested separately)
5. Verify both dashboards show the Context widgets
6. Commit: "Phase 13: Context Engine + Agent connection foundation"

### Rules
- SQL migrations must be idempotent (IF NOT EXISTS everywhere)
- API routes for agents must use SUPABASE_SERVICE_KEY (not user session)
- Dashboard widgets must use normal user auth
- All new tables need RLS policies
- Read existing code before modifying
- Follow existing patterns in both frontend/ and nextjs-app/'

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
    claude --dangerously-skip-permissions -p "Read /workspaces/jadisatu.cloud/CLAUDE.md. The Next.js build failed after Phase 13 changes. Run 'cd /workspaces/jadisatu.cloud/nextjs-app && npm run build' to see errors, fix them all, rebuild to confirm. Commit with 'fix: resolve Phase 13 build errors'."
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
echo "  Phase 13 Complete!"
echo "  Context Engine is live. Agents can now connect."
echo "  $(date)"
echo "========================================="
