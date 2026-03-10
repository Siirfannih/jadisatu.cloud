# Jadisatu.cloud - Claude Code Instructions

## Project Overview

Jadisatu.cloud is a personal "Creator Operating System" built with Next.js 15 + React 19 + Supabase.
The goal is to become the "Source of Truth" for all content creation workflows.

## Tech Stack

- **Frontend**: Next.js 15.1.6 (App Router), React 19, TypeScript 5.8
- **Styling**: Tailwind CSS 3.4, Framer Motion 12, Lucide React icons
- **Database**: Supabase (PostgreSQL + RLS + Auth)
- **Auth**: Supabase Auth (Google OAuth + Email/Password)
- **Charts**: Recharts 3.7
- **Utilities**: clsx, tailwind-merge

## Repository Structure

```
jadisatu.cloud/
├── nextjs-app/              # PRIMARY - Next.js app
│   ├── src/app/             # App Router pages + API routes
│   │   ├── page.tsx         # Dashboard overview
│   │   ├── kanban/          # Kanban board
│   │   ├── projects/        # Project management
│   │   ├── ideas/           # Ideas capture
│   │   ├── leads/           # Hunter Agent leads
│   │   ├── agents/          # AI agent monitoring
│   │   ├── history/         # Activity history
│   │   ├── settings/        # User settings
│   │   ├── context/         # Context digest
│   │   ├── login/           # Auth page
│   │   └── api/             # 13 API route handlers
│   ├── src/components/      # React components
│   │   ├── dashboard/       # Dashboard widgets
│   │   └── layout/          # Sidebar layout
│   └── src/lib/             # Supabase client utilities
├── sql/                     # Database schema files
├── hunter-agent/            # Python FastAPI lead generation (port 8000)
├── visual-engine/           # Python FastAPI carousel generator (port 8100)
└── frontend/                # LEGACY static HTML (do not modify)
```

## Database Schema (Supabase)

### Core Tables
- **ideas**: id, title, content, tags[], source, status ('active'|'archived'), user_id
- **tasks**: id, title, description, status ('backlog'|'todo'|'in_progress'|'done'), priority, project_id, domain, user_id
- **projects**: id, name, description, status ('active'|'paused'|'completed'), progress, user_id
- **agents**: id, name (unique), status, last_active, current_task, location, cpu/memory
- **history**: id, action, details (jsonb), source

### Additional Tables
- **morning_briefings**: daily energy/focus check-in
- **domains**: life domain categories (work, learn, business, personal)
- **schedule_blocks**: time-blocked schedule
- **leads**: scraped pain points from Reddit/LinkedIn
- **carousel_edit_feedback**: tracks user edits on carousel templates
- **user_template_folders**: visual engine template storage

### Security
- All tables have RLS enabled
- User-specific CRUD policies on all tables
- All tables indexed on user_id

## Companion Repositories (cloned at /workspaces/)

### JadisatuLight (/workspaces/Jadisatulight/)
Light-theme UI prototype. Key reusable elements:
- **Layout**: Sidebar.tsx + TopNav.tsx (cleaner design)
- **Creative Hub**: app/creative/page.tsx + CreativePreview.tsx
- **Dashboard widgets**: OverviewCards, TasksList, RecentNotes, ActivityTimeline
- **Theme**: Light color palette in globals.css + tailwind.config.ts
- No backend logic - UI only

### Narrative Engine (/workspaces/jadisatu-narrative-engine/)
n8n-based content automation pipeline:
- **Data source**: CryptoCompare API (crypto news)
- **AI Stage 1**: Gemini 2.0 Flash - triage/filter signals
- **AI Stage 2**: Gemini 2.5 Pro - generate social media content drafts
- **Storage**: Google Sheets (ContentLog)
- **Approval**: Telegram bot with Approve/Reject buttons
- **Publishing**: Repliz webhook (placeholder, not yet connected)
- Runs on GCP VM (34.9.12.1), n8n workflow defined in workflow.json

## Known Bug

Creative Hub throws: "new row for relation 'ideas' violates check constraint 'ideas_status_check'"

The ideas table has a CHECK constraint limiting status values. The frontend is likely sending
status values that don't match the allowed enum. Check the actual constraint in Supabase
and align frontend values accordingly.

From schema: status default 'active' with comment -- 'active', 'archived'
But Creative Hub likely sends different status values (e.g., 'idea', 'draft', 'script', 'ready', 'published').

## Environment Variables

Required in .env.local (auto-created from Codespace secrets):
```
NEXT_PUBLIC_SUPABASE_URL=<from secrets>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from secrets>
SUPABASE_SERVICE_KEY=<from secrets>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Development Commands

```bash
cd /workspaces/jadisatu.cloud/nextjs-app
npm run dev     # Start dev server on port 3000
npm run build   # Production build
```

## Implementation Task

### GOAL
Evolve Jadisatu.cloud into a unified creator operating system.

### IMPLEMENTATION ORDER (follow strictly)

#### Phase 1: Fix Database Bug
- Investigate the `ideas_status_check` constraint in Supabase
- Determine what status values the frontend sends vs what the DB allows
- Fix the mismatch (either update DB constraint or fix frontend values)
- Create a SQL migration file in /sql/ for any DB changes

#### Phase 2: Refactor Creative Hub
- Preserve existing workflow structure from jadisatu.cloud
- Adopt layout approach from JadisatuLight (reference /workspaces/Jadisatulight/app/creative/)
- Implement 3-panel layout:
  - Left: Content library with filters (Ideas, Drafts, Scripts, Ready, Published)
  - Center: Main writing editor (script, caption, content drafts, outlines)
  - Right: Content metadata (platform, tags, project, status, publish date)
  - Top: Pipeline stage indicator (Idea → Script → Shoot → Publish)
- Must feel like a creator workspace, not a social media dashboard

#### Phase 3: Theme System
- Implement Dark Mode (current UI) + Light Mode (from JadisatuLight)
- Use CSS variables / Tailwind dark: classes
- Reference JadisatuLight's globals.css + tailwind.config.ts for light palette
- Theme toggle in settings or header
- Rules:
  - Themes must NOT change page architecture, routes, or workflows
  - Only visual styling differs
  - All features behave identically in both themes

#### Phase 4: Narrative Engine Page
- Create new route: /narrative-engine
- Study the n8n workflow in /workspaces/jadisatu-narrative-engine/workflow.json
- Build UI for:
  1. Enter topic or narrative
  2. Run research (simulate the CryptoCompare + Gemini triage flow)
  3. View summarized research
  4. Generate social media content script
- Outputs: research_summary, content_angles, draft_script
- Users can send generated ideas directly into Creative Hub

#### Phase 5: Integrate Narrative Engine with Creative Hub
- "Send to Creative Hub" button on generated content
- Creates new content entry with pre-filled data

#### Phase 6: Juru AI Copilot
- AI copilot that can interact with:
  - Creative Hub, Narrative Engine, Tasks, Projects, Notes
- Support actions:
  - Create content idea
  - Generate script
  - Break script into content formats
  - Create tasks from content
  - Run research via Narrative Engine

#### Phase 7: Cross-Theme Validation
- Verify all features work in both Dark and Light modes
- No console errors, all routes load, CRUD works, constraints respected

### Content Data Model (for Creative Hub)
New or updated fields needed:
- title, script, caption, platform, status
- publish_date, thumbnail, image_assets, video_link
- carousel_assets, external_publish_id, project_id
- created_at, updated_at

### Validation After Each Phase
- All routes load without errors
- No console errors
- CRUD operations work
- Database constraints are respected
- Theme switching works (after Phase 3)

## Code Style
- Use TypeScript strictly
- Follow existing patterns in the codebase
- Use Tailwind CSS for styling (no inline styles)
- Use Supabase client from src/lib/ for all database operations
- Use App Router conventions (server components by default, 'use client' only when needed)
