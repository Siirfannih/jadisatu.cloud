#!/bin/bash
# ============================================================
# Phase 13: Context Engine — MULTI-AGENT VERSION
# ============================================================
#
# GEMINI: SQL generation, boilerplate API routes, utility files
# CLAUDE: Integration logic, build fixes only
#
# ============================================================

set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 13 (Multi-Agent): Context Engine"
echo "  $(date)"
echo "========================================="

source agents/multi-agent-runner.sh
prepare_context /tmp/jadisatu-context.md

# ============================================================
# TASK 1: SQL Migration [GEMINI]
# Schema generation — Gemini handles SQL perfectly
# ============================================================
echo ""
echo ">>> Task 1/5: Context Engine SQL [GEMINI]"
echo "========================================="

gemini_write "sql/phase-13-context-engine.sql" "
Generate a PostgreSQL migration file for Supabase with these 3 tables.
Use IF NOT EXISTS everywhere. Include RLS policies.

1. user_context:
   - id uuid PK default gen_random_uuid()
   - user_id uuid REFERENCES auth.users(id) NOT NULL, UNIQUE
   - current_focus text
   - active_project_id uuid
   - active_content_id uuid
   - goals jsonb DEFAULT '[]'::jsonb
   - preferences jsonb DEFAULT '{}'::jsonb
   - mood text
   - energy_level integer
   - last_briefing_date date
   - updated_at timestamptz DEFAULT now()
   RLS: users SELECT/UPDATE own row. Service role full access.

2. agent_context:
   - id uuid PK default gen_random_uuid()
   - agent_name text NOT NULL
   - user_id uuid REFERENCES auth.users(id) NOT NULL
   - status text DEFAULT 'idle'
   - current_task text
   - last_result jsonb
   - last_active timestamptz DEFAULT now()
   - capabilities text[]
   - config jsonb DEFAULT '{}'::jsonb
   - created_at timestamptz DEFAULT now()
   - updated_at timestamptz DEFAULT now()
   UNIQUE(agent_name, user_id)
   RLS: users SELECT own. Service role full access.

3. context_events:
   - id uuid PK default gen_random_uuid()
   - user_id uuid REFERENCES auth.users(id) NOT NULL
   - source text NOT NULL
   - event_type text NOT NULL
   - title text NOT NULL
   - details jsonb DEFAULT '{}'::jsonb
   - entity_type text
   - entity_id uuid
   - created_at timestamptz DEFAULT now()
   RLS: users SELECT own. Service role INSERT.
   INDEX on (user_id, created_at DESC).
   INDEX on (source, event_type).

Add INSERT policies for user_context (users can insert their own row).
"
track_gemini
commit_changes "feat: add Context Engine database tables"

# ============================================================
# TASK 2: Agent API routes [GEMINI]
# Boilerplate CRUD API — Gemini's sweet spot
# ============================================================
echo ""
echo ">>> Task 2/5: Agent API routes [GEMINI]"
echo "========================================="

# Read existing API pattern for reference (0 tokens)
API_PATTERN=$(cat nextjs-app/src/app/api/tasks/route.ts 2>/dev/null | head -40 || echo "standard Next.js route handler")
SUPABASE_SERVER=$(cat nextjs-app/src/lib/supabase-server.ts 2>/dev/null | head -20 || echo "")

gemini_multi_write "
Based on this existing API route pattern:
$API_PATTERN

And this Supabase server client:
$SUPABASE_SERVER

Create 3 API route files. Each uses Next.js App Router route handlers.
For agent endpoints, authenticate via Authorization header matching process.env.SUPABASE_SERVICE_KEY (not user session).
Use createServerClient from @supabase/ssr or import from '@/lib/supabase-server'.
For service-key authenticated routes, create a Supabase client with the service key to bypass RLS.

--- FILE: nextjs-app/src/app/api/context-for-agent/route.ts ---
GET handler:
- Check Authorization: Bearer header against process.env.SUPABASE_SERVICE_KEY
- Get user_id and agent_name from URL searchParams
- Query user_context where user_id matches
- Query agent_context where agent_name and user_id match
- Query last 20 context_events where user_id matches, order by created_at DESC
- Return JSON: { user, agent, recent_events }

--- FILE: nextjs-app/src/app/api/agent-report/route.ts ---
POST handler:
- Check Authorization: Bearer header
- Parse body: { user_id, agent_name, status, result, event }
- Upsert agent_context: set status, last_result=result, last_active=now(), updated_at=now()
  Use onConflict: 'agent_name,user_id'
- Insert context_event from event data with user_id and source=agent_name
- Return { success: true }

--- FILE: nextjs-app/src/app/api/agents/register/route.ts ---
POST handler:
- Check Authorization: Bearer header
- Parse body: { agent_name, user_id, capabilities }
- Upsert agent_context: set status='idle', capabilities, updated_at=now()
- Return { success: true, agent: upserted row }
"
track_gemini
commit_changes "feat: add agent communication API endpoints"

# ============================================================
# TASK 3: Context updater utility [GEMINI]
# Simple utility functions — no complex logic
# ============================================================
echo ""
echo ">>> Task 3/5: Context updater utility [GEMINI]"
echo "========================================="

gemini_write "nextjs-app/src/lib/context-updater.ts" "
Create a TypeScript utility for updating user context in Supabase.
Import { createClient } from './supabase-browser'

Export these async functions:

1. updateFocus(userId: string, focus: string): Promise<void>
   - const supabase = createClient()
   - upsert into user_context: { user_id: userId, current_focus: focus, updated_at: new Date().toISOString() }
   - onConflict: 'user_id'

2. updateActiveProject(userId: string, projectId: string): Promise<void>
   - upsert user_context with active_project_id

3. updateActiveContent(userId: string, contentId: string): Promise<void>
   - upsert user_context with active_content_id

4. updateFromBriefing(userId: string, data: { mood: string; energy_level: number }): Promise<void>
   - upsert user_context with mood, energy_level, last_briefing_date: new Date().toISOString().split('T')[0]

5. logContextEvent(userId: string, event: { source: string; event_type: string; title: string; details?: Record<string, unknown>; entity_type?: string; entity_id?: string }): Promise<void>
   - insert into context_events with user_id and all event fields

All functions should catch errors and console.error them (don't throw — context updates are non-critical).
"
track_gemini
commit_changes "feat: add context updater utility"

# ============================================================
# TASK 4: Context Pulse widget [GEMINI]
# UI component — Gemini generates well
# ============================================================
echo ""
echo ">>> Task 4/5: Context Pulse dashboard widget [GEMINI]"
echo "========================================="

gemini_write "nextjs-app/src/components/dashboard/ContextPulse.tsx" "
Create a React component for displaying Context Pulse on the Creator Mode dashboard.

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Activity, Bot, Zap } from 'lucide-react'

Interface types:
- AgentStatus: { agent_name: string, status: string, last_active: string }
- ContextEvent: { source: string, event_type: string, title: string, created_at: string }

The component should:
1. On mount, fetch from Supabase:
   - user_context (current user's focus)
   - agent_context (all agents for this user)
   - last 5 context_events
2. Display in a rounded-3xl card with:
   - Header: '⚡ Context Pulse'
   - Current focus: text showing what user is working on (or 'No active focus')
   - Agent status: list of agents with colored dot (green=active, yellow=idle, gray=offline)
   - Recent events: compact timeline (time + title)
3. If no data (tables don't exist yet), show friendly empty state:
   'Your AI agents will show their activity here once connected.'
4. Creator Mode styling: warm colors, rounded cards, soft shadows
5. Handle Supabase errors gracefully (tables might not exist yet)

Export default ContextPulse
"
track_gemini
commit_changes "feat: add Context Pulse dashboard widget"

# ============================================================
# TASK 5: Build verify [CLAUDE only if build fails]
# ============================================================
echo ""
echo ">>> Task 5/5: Build verification"
echo "========================================="

if verify_build; then
    echo "Build passed — no Claude needed!"
else
    echo "Build failed — calling Claude to diagnose and fix..."
    claude_with_context /tmp/jadisatu-context.md "
The Next.js build failed after adding Context Engine files.
Run 'cd /workspaces/jadisatu.cloud/nextjs-app && npm run build' to see errors.
Fix ALL TypeScript and build errors in nextjs-app/.
Common issues: wrong imports, missing types, Supabase client usage.
Rebuild to confirm. Commit: 'fix: resolve Phase 13 build errors'"
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
echo "  Phase 13 (Multi-Agent) Complete!"
echo "  $(date)"
echo "========================================="
