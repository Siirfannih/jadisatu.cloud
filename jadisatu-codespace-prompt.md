You are now the lead full-stack engineer responsible for evolving Jadisatu.cloud into the unified creator operating system.

================================================
REPOSITORY LOCATIONS IN THIS CODESPACE
================================================

Main repo (your working directory):
/workspaces/jadisatu.cloud/nextjs-app/

Light theme reference (UI only, no backend):
/workspaces/Jadisatulight/

Narrative Engine reference (n8n workflow logic):
/workspaces/jadisatu-narrative-engine/

GitHub URLs:
https://github.com/Siirfannih/jadisatu.cloud
https://github.com/Siirfannih/Jadisatulight
https://github.com/Siirfannih/jadisatu-narrative-engine

================================================
TECHNICAL CONTEXT
================================================

Tech Stack:
- Frontend: Next.js 15.1.6 (App Router), React 19, TypeScript 5.8
- Styling: Tailwind CSS 3.4, Framer Motion 12, Lucide React icons
- Database: Supabase (PostgreSQL + RLS + Auth)
- Auth: Supabase Auth (Google OAuth + Email/Password) via @supabase/ssr
- Charts: Recharts 3.7
- Utilities: clsx, tailwind-merge

AI API:
Use Google Gemini API for Narrative Engine research and Juru AI features.
The Narrative Engine repo uses Gemini 2.0 Flash for triage and Gemini 2.5 Pro for content synthesis.
Check /workspaces/jadisatu-narrative-engine/workflow.json for the exact prompts and API structure.

Content Storage:
Create a new table "contents" for the full content pipeline data model.
Keep the existing "ideas" table for quick idea capture.
The "contents" table is for full content lifecycle management in Creative Hub.

Environment:
Supabase credentials are in /workspaces/jadisatu.cloud/nextjs-app/.env.local
Supabase client utilities are in /workspaces/jadisatu.cloud/nextjs-app/src/lib/

================================================
EXISTING DATABASE SCHEMA (Supabase)
================================================

Current tables:
- ideas: id, title, content, tags[], source, status ('active'|'archived'), user_id
- tasks: id, title, description, status ('backlog'|'todo'|'in_progress'|'done'), priority, project_id, domain, user_id
- projects: id, name, description, status ('active'|'paused'|'completed'), progress, user_id
- agents: id, name (unique), status, last_active, current_task, location, cpu/memory, meta (jsonb)
- history: id, action, details (jsonb), source
- morning_briefings: date, energy_level, focus_domain, priority_task, blockers, user_id
- domains: name, display_name, icon, color, total_tasks, completed_tasks, progress_percentage, user_id
- schedule_blocks: date, start_time, end_time, title, domain, type, user_id
- leads: pain points from Reddit/LinkedIn with pain_score, category, opportunity_level

All tables have RLS enabled with user-specific CRUD policies.
SQL migration files are in /workspaces/jadisatu.cloud/sql/

Existing Next.js pages:
/ (dashboard), /kanban, /projects, /ideas, /leads, /agents, /history, /settings, /context, /login

Existing API routes:
/api/tasks, /api/tasks/[id], /api/projects, /api/leads, /api/agents, /api/domains, /api/activities, /api/schedule, /api/morning-briefing, /api/context-digest, /api/init-user, /api/setup-leads

================================================
WHAT JADISATULIGHT CONTAINS (reference only)
================================================

JadisatuLight is a light-theme UI prototype with:
- Layout: Sidebar.tsx + TopNav.tsx (cleaner, modern design)
- Pages: /, /ai, /creative, /crm, /focus, /history, /kanban, /notes, /projects, /tasks
- Key components: CreativePreview.tsx, OverviewCards.tsx, TasksList.tsx, RecentNotes.tsx, ActivityTimeline.tsx, QuickNote.tsx, FocusWidget.tsx
- Light color palette in app/globals.css and tailwind.config.ts
- Built with Tailwind CSS, no shadcn/ui, all custom components
- No backend logic, no Supabase integration

Use this repo as VISUAL REFERENCE ONLY. Copy styling patterns, not code directly.

================================================
WHAT NARRATIVE ENGINE CONTAINS (reference only)
================================================

The Narrative Engine is an n8n workflow with this pipeline:
1. Schedule Trigger (every 6 hours)
2. Ingest data from CryptoCompare API (crypto news)
3. LLM Triage via Gemini 2.0 Flash (filter noise, extract real signals)
4. If signal exists → Synthesize Draft via Gemini 2.5 Pro (generate social media content)
5. Save to Google Sheets with status "Pending"
6. Send to Telegram with Approve/Reject buttons
7. On approval → Post via Repliz webhook → Update sheet to "Published"

For Jadisatu integration: replicate this pipeline as a UI-driven feature, not as n8n automation.
Users should manually trigger research and generation from the /narrative-engine page.

================================================
MAIN PRODUCT GOAL
================================================

Jadisatu.cloud should become the "Source of Truth" for all content creation.

Creators will:
1. research topics
2. generate ideas
3. write scripts
4. manage content pipeline
5. store all assets
6. distribute through Repliz

Jadisatu manages content.
Repliz handles publishing.

================================================
THEME SYSTEM
================================================

Jadisatu must support two visual themes:

Dark Mode (current UI from Jadisatu.cloud)
Light Mode (UI design inspired by JadisatuLight)

Important rules:
- Themes must not change page architecture, routes, or workflows
- Only visual styling should differ
- All features must behave identically in both themes
- Use CSS variables + Tailwind dark: classes
- Reference JadisatuLight's globals.css and tailwind.config.ts for light palette
- Add theme toggle in the header/sidebar

================================================
CREATIVE HUB
================================================

Creative Hub must preserve the workflow structure from Jadisatu.cloud but adopt the layout approach from JadisatuLight.

Pipeline stages:
Idea → Script → Shoot → Publish

Final layout:

Left panel - Content library with filters:
Ideas, Drafts, Scripts, Ready, Published

Center panel - Main writing editor for:
script, caption, content drafts, outlines

Right panel - Content metadata:
platform, tags, project, status, publish date

Top area - Pipeline stage indicator:
Idea → Script → Shoot → Publish

Creative Hub must feel like a creator workspace rather than a social media manager dashboard.

Reference /workspaces/Jadisatulight/app/creative/page.tsx for layout inspiration.
Reference /workspaces/Jadisatulight/components/CreativePreview.tsx for content cards.

================================================
CONTENT DATA MODEL
================================================

Create a new "contents" table in Supabase with these fields:

id (uuid, primary key)
title (text, not null)
script (text)
caption (text)
platform (text) -- 'instagram', 'tiktok', 'youtube', 'linkedin', 'twitter'
status (text) -- 'idea', 'draft', 'script', 'ready', 'published'
publish_date (timestamp with time zone)
thumbnail (text) -- URL
image_assets (text[]) -- array of URLs
video_link (text)
carousel_assets (jsonb)
external_publish_id (text)
project_id (uuid, references projects)
user_id (uuid, references auth.users)
created_at (timestamp with time zone)
updated_at (timestamp with time zone)

Add RLS policies matching the existing pattern.
Create a SQL migration file in /workspaces/jadisatu.cloud/sql/create-contents-table.sql

================================================
NARRATIVE ENGINE PAGE
================================================

Create a new page: /narrative-engine

First inspect /workspaces/jadisatu-narrative-engine/workflow.json to understand the workflow.

Then build a UI that allows users to:
1. Enter a topic or narrative (text input)
2. Click "Run Research" to trigger research
3. View summarized research results
4. Click "Generate Content" to create social media content script

For the AI backend, create these API routes:
- POST /api/narrative/research -- takes a topic, calls Gemini to research and summarize
- POST /api/narrative/generate -- takes research summary, generates content draft

Outputs should include:
- research_summary
- content_angles (array of possible angles)
- draft_script

Users should be able to click "Send to Creative Hub" to create a new content entry from the generated output.

Note: For now, implement with mock/simulated research if GEMINI_API_KEY is not available. The UI and data flow should be fully functional. Add a note in the code where the actual Gemini API integration should go.

================================================
JURU AI COPILOT
================================================

Juru should act as an AI copilot accessible from a floating button or sidebar panel on every page.

Juru can interact with:
- Creative Hub
- Narrative Engine
- Tasks
- Projects
- Notes

Juru should support actions such as:
- "Create content idea about [topic]" → creates entry in Creative Hub
- "Generate script for [idea]" → fills script field in content
- "Break this script into carousel slides" → generates carousel_assets
- "Create tasks from this content" → creates tasks linked to content
- "Research [topic]" → triggers Narrative Engine research

Implementation: Create a Juru component that appears as a chat-like interface.
For now, Juru can use predefined action patterns. Full AI integration can be added later with Gemini API.

================================================
BUG FIX REQUIRED
================================================

Currently Creative Hub throws the error:
"new row for relation 'ideas' violates check constraint 'ideas_status_check'"

Investigation notes:
- The ideas table schema defines status with default 'active' and allowed values 'active', 'archived'
- But Creative Hub likely sends different status values like 'idea', 'draft', 'script', 'ready', 'published'
- There may be a CHECK constraint added directly in Supabase that is not in the SQL files

Fix approach:
1. Check the actual constraint in the database (query information_schema or pg_constraint)
2. The ideas table should keep its original status values ('active', 'archived')
3. Content pipeline statuses ('idea', 'draft', 'script', 'ready', 'published') belong in the new "contents" table
4. Fix the frontend to use the correct table for content pipeline operations
5. Create a SQL migration file for any database changes

================================================
IMPLEMENTATION ORDER (follow strictly)
================================================

Phase 1: Fix Database Bug
- Investigate ideas_status_check constraint
- Create the new "contents" table with proper status enum
- Fix frontend to use correct table
- Create SQL migration files in /sql/

Phase 2: Refactor Creative Hub
- Build 3-panel layout (left: library, center: editor, right: metadata)
- Add pipeline stage indicator at top
- Connect to new "contents" table
- Reference JadisatuLight for layout style
- Preserve all existing functionality

Phase 3: Theme System
- Implement Dark + Light mode with CSS variables
- Extract light palette from JadisatuLight's globals.css and tailwind.config.ts
- Add theme toggle
- Ensure all pages render correctly in both themes

Phase 4: Narrative Engine Page
- Create /narrative-engine route
- Build research input UI
- Build results display
- Create API routes for research and generation
- Add "Send to Creative Hub" button

Phase 5: Integrate Narrative Engine with Creative Hub
- "Send to Creative Hub" creates content entry with pre-filled data
- Narrative Engine outputs appear in Creative Hub library

Phase 6: Juru AI Copilot
- Create floating Juru component
- Implement action patterns for content creation, task creation, research
- Wire to Creative Hub and Narrative Engine

Phase 7: Cross-Theme Validation
- Test all features in both Dark and Light modes
- Verify no console errors on any page
- Verify all CRUD operations work
- Verify database constraints are respected

================================================
VALIDATION (after each phase)
================================================

After implementing each phase:
- Verify all routes load without errors
- Verify no console errors in browser
- Verify CRUD operations work correctly
- Verify database constraints are respected
- Verify theme switching works correctly (after Phase 3)
- Run: npm run build (must pass without errors)

================================================
GIT WORKFLOW
================================================

After completing each phase:
1. Stage changed files
2. Commit with descriptive message
3. Push to main branch

This allows the project owner to track progress via GitHub commits.

================================================
OUTPUT
================================================

After completing ALL phases, provide a development summary including:
- Files modified
- Files created
- Features added
- Bugs fixed
- Database changes made
- Remaining issues or TODOs
- Architectural decisions made
