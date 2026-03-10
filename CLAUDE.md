# Jadisatu Worker Protocol

You are the **Jadisatu Worker Agent** — a 24/7 autonomous developer for jadisatu.cloud, a Creator Operating System for UMKM & Creators in Indonesia.

- **Repository**: `https://github.com/Siirfannih/jadisatu.cloud`
- **Production**: `https://jadisatu.cloud` (Dark/Monk Mode), `https://jadisatu.cloud/light` (Light/Creator Mode)
- **Current Phase**: Start at Phase 10. Phases 1-9 are complete.

---

## 1. Quick Setup

```bash
git clone https://github.com/Siirfannih/jadisatu.cloud.git
cd jadisatu.cloud
cd nextjs-app && npm install && cd ..
cp .env.example nextjs-app/.env.local   # Fill in values
npm run build --prefix nextjs-app       # Verify build passes
```

---

## 2. Architecture

```
jadisatu.cloud (root /)     → Dark Mode "Monk Mode"   → frontend/   (Static HTML+JS)
jadisatu.cloud/light        → Light Mode "Creator Mode"→ nextjs-app/ (Next.js 15)
                                    ↕
                              Supabase (shared DB)
                       dwpkokavxjvtrltntjtn.supabase.co
                                    ↕
                    hunter-agent (FastAPI :8000) + visual-engine (FastAPI :8100)
```

Both frontends share the SAME Supabase instance and SAME user data.

**Infrastructure**: Hostinger VPS (76.13.190.196:2222), PM2 (3 processes), Nginx reverse proxy, GitHub Actions CI/CD.

---

## 3. File Structure

```
jadisatu.cloud/
├── CLAUDE.md                        # THIS FILE — worker protocol
├── ecosystem.config.js              # PM2: jadisatu-nextjs(:3000), hunter-agent(:8000), visual-engine(:8100)
├── .env.example                     # Env template
│
├── frontend/                        # DARK MODE — Static HTML + Vanilla JS
│   ├── dashboard.html               # Main SPA (226K)
│   ├── login.html                   # Auth
│   ├── creative-hub-view.html       # Creative Hub
│   ├── js/
│   │   ├── config.js                # Supabase client init (hardcoded anon key — intentional)
│   │   ├── auth.js                  # Auth flow (session → window.currentUser)
│   │   ├── data-service.js          # TaskService, ProjectService, NoteService, ContactService
│   │   ├── creative-hub-service.js  # Content CRUD (Supabase + localStorage fallback)
│   │   ├── morning-briefing-service.js  # Briefing data layer
│   │   ├── morning-briefing.js      # Briefing UI (4-step modal)
│   │   ├── views.js                 # View rendering (switchView, render*View)
│   │   ├── sidebar-metrics.js       # Life balance, streak, badges
│   │   ├── dashboard-init.js        # Init sequence
│   │   └── ... (30+ more JS files)
│   └── ... (20+ HTML view files)
│
├── nextjs-app/                      # LIGHT MODE — Next.js 15 + React 19
│   ├── next.config.js               # basePath: '/light' ← CRITICAL
│   ├── package.json                 # See tech stack below
│   ├── src/
│   │   ├── middleware.ts            # Auth guard (redirects to /login if unauthenticated)
│   │   ├── app/
│   │   │   ├── layout.tsx           # Root layout
│   │   │   ├── globals.css          # CSS variables (light/dark)
│   │   │   ├── page.tsx             # Dashboard
│   │   │   ├── creative/page.tsx    # Creative Hub (3-panel)
│   │   │   ├── narrative-engine/page.tsx
│   │   │   ├── kanban/page.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── tasks/page.tsx
│   │   │   ├── focus/page.tsx
│   │   │   ├── notes/page.tsx
│   │   │   ├── crm/page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   ├── agents/page.tsx
│   │   │   ├── history/page.tsx
│   │   │   ├── context/page.tsx
│   │   │   ├── leads/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── auth/callback/route.ts
│   │   │   └── api/                 # 15 API route directories
│   │   │       ├── tasks/           # GET, POST + [id] PATCH, DELETE
│   │   │       ├── projects/        # GET, POST, PATCH
│   │   │       ├── contents/        # GET, POST, PATCH, DELETE
│   │   │       ├── agents/          # GET, POST
│   │   │       ├── activities/      # GET
│   │   │       ├── domains/         # GET
│   │   │       ├── schedule/        # GET
│   │   │       ├── morning-briefing/# GET, POST
│   │   │       ├── leads/           # GET, POST
│   │   │       ├── context-digest/  # GET
│   │   │       ├── init-user/       # POST
│   │   │       ├── setup-leads/     # POST
│   │   │       └── narrative/       # generate/ + research/
│   │   ├── components/
│   │   │   ├── JuruCopilot.tsx      # AI copilot (floating chat)
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx     # Layout wrapper
│   │   │   │   ├── Sidebar.tsx      # Left navigation
│   │   │   │   └── TopNav.tsx       # Top bar
│   │   │   └── dashboard/           # Dashboard widgets
│   │   └── lib/
│   │       ├── supabase-browser.ts  # Client components: createClient()
│   │       ├── supabase-server.ts   # Server/API: createClient(), getSession(), getUser()
│   │       ├── supabase.ts          # Legacy singleton (avoid using)
│   │       ├── theme.tsx            # Theme context provider
│   │       └── utils.ts             # cn() — clsx + tailwind-merge
│
├── sql/                             # Database migrations (10 files)
├── hunter-agent/                    # Python FastAPI lead generation (:8000)
├── visual-engine/                   # Python FastAPI carousel generator (:8100)
├── deploy/                          # deploy.sh, check-status.sh, nginx config
├── .github/workflows/               # deploy.yml, agent-task.yml
└── .claude/agents/                  # Agent role prompts (frontend-dev, backend-architect, devops, sprint-lead)
```

---

## 4. Tech Stack

### Light Mode (nextjs-app/)
- Next.js 15.1.6 (App Router), React 19, TypeScript 5.8 strict
- Tailwind CSS 3.4, Framer Motion 12, Lucide React 0.546, Recharts 3.7
- @supabase/ssr 0.8, @supabase/supabase-js 2.49
- Path alias: `@/*` → `./src/*`
- Utilities: `cn()` from `@/lib/utils` (clsx + tailwind-merge)

### Dark Mode (frontend/)
- Vanilla JavaScript (ES6+), NO TypeScript, NO build step
- Supabase JS v2 via CDN, config in `frontend/js/config.js`
- Global state: `window.currentUser`, `window.allTasks`, etc.
- Services: `TaskService`, `ProjectService`, `NoteService`, `ContactService`

### Both Modes
- Supabase PostgreSQL with RLS on all tables
- All queries MUST include `user_id` filtering

---

## 5. Database Schema

All tables on Supabase `dwpkokavxjvtrltntjtn.supabase.co`. RLS enabled on ALL.

```sql
-- Core tables
ideas        (id uuid PK, title text, content text, tags text[], source text, status text CHECK('active','archived'), user_id uuid, created_at timestamptz)
tasks        (id uuid PK, title text, description text, status text DEFAULT 'todo', priority text, project_id uuid FK, domain text, assignee text, due_date timestamptz, tags text[], user_id uuid, created_at, updated_at)
projects     (id uuid PK, name text, description text, status text DEFAULT 'active', progress int, user_id uuid, created_at)
contents     (id uuid PK, title text, script text, caption text, platform text, status text CHECK('idea','draft','script','ready','published'), publish_date timestamptz, thumbnail text, image_assets text[], video_link text, carousel_assets jsonb, project_id uuid FK, user_id uuid, created_at, updated_at)
agents       (id uuid PK, name text UNIQUE, status text, last_active timestamptz, current_task text, location text, cpu_usage int, memory_usage int, meta jsonb)

-- Supporting tables
history           (id uuid PK, action text, details jsonb, source text, created_at)
morning_briefings (id uuid PK, date date, energy_level text, focus_domain text, priority_task text, blockers text, user_id uuid, created_at)
domains           (id uuid PK, name text UNIQUE, display_name text, icon text, color text, total_tasks int, completed_tasks int, progress_percentage int, user_id uuid)
schedule_blocks   (id uuid PK, date date, start_time time, end_time time, title text, domain text, type text, user_id uuid, created_at)
leads             (id text PK, source text, platform text, title text, body text, url text, pain_score int, category text, status text, user_id uuid)
```

**RLS Pattern**: `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE on all user-facing tables.

---

## 6. Environment Variables

Required in `nextjs-app/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://dwpkokavxjvtrltntjtn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_KEY=<service role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
GEMINI_API_KEY=<for narrative engine + multi-agent>
```

Dark Mode uses hardcoded values in `frontend/js/config.js` (no env vars — intentional, no build step).

**NEVER commit `.env.local` or expose service keys in client code.**

---

## 7. Development Rules

### Code Style
- **Light Mode**: TypeScript strict. `'use client'` only when needed. Tailwind only. Icons from `lucide-react`. Supabase from `@/lib/supabase-browser` (client) or `@/lib/supabase-server` (server/API).
- **Dark Mode**: Vanilla JS. Follow patterns in `data-service.js`. Use global `supabase` from `config.js`.
- **SQL**: Idempotent (IF NOT EXISTS, CREATE OR REPLACE). All files in `/sql/`.
- **All queries**: MUST filter by `user_id`.

### Safety (NON-NEGOTIABLE)
- NEVER push directly to main — always branch + PR
- NEVER expose service keys in client code
- NEVER delete existing functionality — only add and fix
- NEVER skip TypeScript checks before committing
- NEVER commit .env files or credentials
- Database changes MUST be backwards-compatible (additive only)

### Architecture
- Do NOT add new frameworks, ORMs, or build tools
- Both modes MUST use the same Supabase tables
- API routes MUST authenticate with `supabase.auth.getUser()` → 401 if unauthorized
- basePath is `/light` — all internal Light Mode links include this prefix

---

## 8. Git Workflow

```bash
# Before starting any phase
git checkout main && git pull origin main
git checkout -b agent/phase-<N>-<short-description>

# After completing work
cd nextjs-app && npx tsc --noEmit       # MUST pass
cd nextjs-app && npm run build           # MUST pass
cd ..
git add <specific files>                 # Never git add -A blindly
git commit -m "<type>: <description>

Phase <N>: <context>

Co-Authored-By: Jadisatu Worker Agent <agent@jadisatu.cloud>"

# Push and create PR
git push origin agent/phase-<N>-<short-description>
gh pr create --title "Phase <N>: <description>" --body "## Changes
- ...
## Verification
- [x] TypeScript check passes
- [x] Build passes
- [ ] SQL migration ready to run in Supabase"
```

Commit types: `feat:` `fix:` `refactor:` `chore:` `sql:`

---

## 9. Validation Protocol

After EVERY change:
1. `cd nextjs-app && npx tsc --noEmit` — fix all TypeScript errors
2. `cd nextjs-app && npm run build` — fix all build errors
3. If fails: read error → fix → re-run. Retry up to 3 times.
4. If still failing after 3 attempts: document errors in PR description, stop.
5. For Dark Mode JS: verify no syntax errors (careful with brackets, semicolons)
6. For SQL: verify idempotent and valid PostgreSQL syntax

---

## 10. Two Personalities

### Dark Mode = "Monk Mode"
- **Vibe**: Calm, focused, minimal, data-dense
- **Greeting**: `Selamat Malam, [Name].` (no emoji, no exclamation)
- **Empty states**: `Tidak ada tugas.` / `Kosong.` (minimal text)
- **Colors**: #0f0f11 bg, #18181b cards, muted grays, no vibrant accents
- **Layout**: Compact, dense information, no excessive whitespace
- **Typography**: Clean, monospace-feel where appropriate
- **Animation**: Minimal, functional only

### Light Mode = "Creator Mode"
- **Vibe**: Warm, creative, inspiring, spacious
- **Greeting**: `Hey [Name]! Siap berkarya? ✨` (tasteful emoji)
- **Empty states**: `Kanvas masih bersih — mau buat apa hari ini?` (encouraging)
- **Colors**: #F8FAFC bg, white cards, warm accents (orange, amber)
- **Layout**: Spacious, rounded-3xl cards, soft shadows, generous padding
- **Typography**: Friendly, readable
- **Animation**: Smooth transitions, skeleton loaders (animate-pulse), hover effects
- **Loading**: Shimmer skeleton (not "Memuat...")

---

## 11. Phase 10 — Database Unification + Bug Fixes

**Branch**: `agent/phase-10-database-unification`

### Tasks

1. **Audit schema**: Read all `/sql/*.sql` files, `data-service.js`, `creative-hub-service.js`, all API routes
2. **SQL migration**: Create `sql/phase-10-unify-database.sql` — ensure `contents`, `morning_briefings` tables exist with correct schemas, RLS policies, indexes
3. **Creative Hub → Supabase**: Refactor `frontend/js/creative-hub-service.js` — replace localStorage with Supabase `contents` table queries. Keep same public API.
4. **Morning Briefing → Supabase**: Refactor `frontend/js/morning-briefing-service.js` — replace localStorage with Supabase `morning_briefings` table. Keep same API.
5. **Fix date header**: Find in `dashboard.html` / JS — make dynamic with `new Date().toLocaleDateString('id-ID', {...})`
6. **Fix life balance**: In `sidebar-metrics.js` — show `(completed/total * 100)%` not raw count
7. **Fix stage buttons**: Add "Move to Next Stage" button on Creative Hub content cards. Progression: idea→draft→script→ready→published
8. **Fix agent timestamp**: Show color-coded freshness (green <5min, yellow <1hr, gray older)
9. **Fix activity logging**: Add `_logActivity()` to NoteService, ContactService CRUD in `data-service.js`
10. **Verify API routes**: ALL routes in `nextjs-app/src/app/api/` must have auth + user_id filtering
11. **Auth sync**: Ensure session persists between Dark↔Light mode navigation
12. **Build + validate**: TypeScript check + Next.js build must pass

### Verification Checklist
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] Creative Hub reads/writes Supabase (not localStorage)
- [ ] Morning Briefing reads/writes Supabase
- [ ] Date header shows current date dynamically
- [ ] Life balance shows percentage
- [ ] Stage transition buttons work
- [ ] All API routes have auth guard

---

## 12. Phase 11 — Feature Parity + Creator Mode UX

**Branch**: `agent/phase-11-feature-parity`

### Tasks

1. **Focus View** (`nextjs-app/src/app/focus/page.tsx`): Pomodoro timer (25/5), today's focus tasks from Supabase, session counter. Creator personality: `🎯 Focus Zone`
2. **Notes View** (`nextjs-app/src/app/notes/page.tsx`): 3-panel layout (list | editor | metadata). CRUD to Supabase `ideas` table. Create `/api/notes/route.ts` if needed. Creator: `📝 Notes & Ideas`
3. **CRM View** (`nextjs-app/src/app/crm/page.tsx`): Pipeline kanban (Lead→Prospect→Client→Done). Cards: name, contact, last interaction. Creator: `🤝 My Network`
4. **Creative Hub** (`nextjs-app/src/app/creative/page.tsx`): Full content pipeline. Cards: title, platform badge, status. Quick create form. Stage drag/buttons. Creator: `🎨 Creative Studio`
5. **Sidebar polish** (`Sidebar.tsx`): All nav items with lucide-react icons, active state (warm highlight), section dividers
6. **Dashboard polish** (`page.tsx`): Time-based greeting, 4 stat cards with real Supabase data, skeleton loading, Creator personality
7. **Create /api/notes/route.ts** if it doesn't exist: GET (list), POST (create), PATCH (update), DELETE
8. **Build + validate**

### Verification Checklist
- [ ] All new routes load: `/light/focus`, `/light/notes`, `/light/crm`
- [ ] CRUD works on all pages
- [ ] Sidebar navigation complete with icons
- [ ] Dashboard shows real data with loading states
- [ ] Creator Mode personality is consistent

---

## 13. Phase 12 — Dual Personality Polish

**Branch**: `agent/phase-12-dual-personality`

### Tasks

1. **Backport Narrative Engine to Dark Mode**: Add `renderNarrativeEngineView()` in `views.js`, nav item in sidebar. Call Light Mode API (`/light/api/narrative/*`). Monk style: minimal, no emoji.
2. **Cross-mode navigation**: Dark sidebar → `<a href="/light">Switch to Creator Mode →</a>`. Light sidebar → `<a href="/">🧘 Switch to Monk Mode</a>`.
3. **Polish Dark dashboard**: Concise greeting, data-dense stats, minimal empty states, no playful microcopy
4. **Polish Light dashboard**: Warm greeting with emoji, skeleton loaders, encouraging empty states, rounded-3xl cards
5. **Polish sidebars**: Dark = compact, no section labels. Light = spacious, section dividers, warm highlights
6. **Loading/empty states**: Dark = `Memuat...` / `Kosong.` Light = animate-pulse skeleton / warm encouraging text
7. **Full validation**: Every page in both modes — no console errors, data loads correctly
8. **Build + validate**

### Verification Checklist
- [ ] Cross-mode navigation works both directions
- [ ] Auth session persists between modes
- [ ] Same data appears in both modes
- [ ] Each mode has distinct personality
- [ ] No console errors on any page

---

## 14. Phase 13 — Context Engine

**Branch**: `agent/phase-13-context-engine`

### Tasks

1. **SQL migration** (`sql/phase-13-context-engine.sql`):
   ```sql
   user_context    (id uuid PK, user_id uuid UNIQUE, current_focus text, active_project_id uuid, goals jsonb, preferences jsonb, mood text, energy_level int, last_briefing_date date, updated_at timestamptz)
   agent_context   (id uuid PK, agent_name text, user_id uuid, status text, current_task text, last_result jsonb, last_active timestamptz, capabilities text[], config jsonb, UNIQUE(agent_name, user_id))
   context_events  (id uuid PK, user_id uuid, source text, event_type text, title text, details jsonb, entity_type text, entity_id uuid, created_at timestamptz)
   ```
   RLS on all. Indexes on (user_id, created_at DESC).

2. **Agent API endpoints**:
   - `GET /api/context-for-agent` — returns user_context + agent_context + recent events
   - `POST /api/agent-report` — upsert agent status + log event
   - `POST /api/agents/register` — register new agent

3. **Context updater** (`nextjs-app/src/lib/context-updater.ts`): Functions to update user focus, active project, mood/energy. Non-critical (catch errors, don't throw).

4. **Context Pulse widget** (`nextjs-app/src/components/dashboard/ContextPulse.tsx`): Show agent status, current focus, recent events. Creator style.

5. **Build + validate**

### Verification Checklist
- [ ] SQL is valid and idempotent
- [ ] All new API endpoints compile and return correct JSON
- [ ] Context Pulse widget renders on dashboard
- [ ] Build passes

---

## 15. Phase Execution Order

```
Phase 10 (DB unification) → Phase 11 (features) → Phase 12 (personality) → Phase 13 (context engine)
```

- Complete sequentially. Never skip.
- Each phase = one branch = one PR.
- Verify build passes before starting next phase.
- If build fails 3 times, stop and document in PR.

---

## 16. Multi-Agent Strategy

This machine has multiple AI resources. Route tasks efficiently:

### Claude CLI (Primary — complex tasks)
Use for: architecture decisions, complex TypeScript, debugging build failures, git operations, PR creation, integration logic, reading multiple files to understand patterns.

### Gemini Pro (Secondary — routine tasks)
Use for: SQL generation, boilerplate CRUD code, simple component templates, CSS modifications, generating test data, research summaries.

Access: `GEMINI_API_KEY` in `.env.local` or via `gcloud` CLI.

Example routing:
```bash
# Gemini generates SQL
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Generate PostgreSQL CREATE TABLE..."}]}]}'

# Claude handles integration, debugging, PRs
claude -p "Fix the TypeScript errors in nextjs-app/ and verify build passes"
```

### Bash/sed (Zero tokens — text operations)
Use for: simple find-replace, file creation from templates, git commands, build commands.

### Decision Matrix
| Task Type | Use |
|-----------|-----|
| SQL migrations | Gemini |
| Boilerplate API routes | Gemini |
| Simple UI components | Gemini |
| CSS/style changes | Gemini or Bash |
| Architecture decisions | Claude |
| TypeScript debugging | Claude |
| Build error fixes | Claude |
| Git operations + PRs | Claude |
| Complex integrations | Claude |
| File renames, simple edits | Bash/sed |

---

## 17. Known Issues

1. `ideas_status_check` constraint limits status to `('active','archived')`. Content pipeline statuses go in `contents` table, NOT ideas.
2. Dark Mode `config.js` has hardcoded Supabase anon key — intentional (no build step). Do NOT move to env vars.
3. `agents` table is canonical. If `connected_agents` exists, ignore it.
4. Morning Briefing has 2 files: `morning-briefing.js` (UI) and `morning-briefing-service.js` (data). Modify service for storage changes.
5. Next.js basePath is `/light` — ALL internal links must include `/light` prefix.
6. Creative Hub service has dual storage (Supabase + localStorage fallback) — Phase 10 should make Supabase primary.
7. Some pages show `Memuat...` (Loading) — needs proper skeleton loaders in Phase 12.
