# JadisatuOS - System Context

> Dokumen ini adalah "memory" untuk AI agents. Baca ini PERTAMA sebelum melakukan perubahan apapun.

## Apa itu JadisatuOS?

All-in-one productivity & business management dashboard untuk UMKM Indonesia.
Live di: https://jadisatu.cloud

## Architecture Overview

```
User Browser
    │
    ├── Static Frontend (Nginx)
    │     Port 80/443 → /var/www/jadisatu.cloud/public/
    │     HTML + vanilla JS + Supabase client SDK
    │
    ├── Next.js Dashboard (PM2)
    │     Port 3000 (internal)
    │     Server-rendered dashboard + API routes
    │
    └── Hunter Agent API (PM2)
          Port 8000 (internal)
          Python FastAPI → Nginx proxied at /api/
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Static Frontend | Vanilla JS, HTML5, Supabase JS SDK |
| Dashboard App | Next.js 15, React 19, TypeScript 5.8, Tailwind CSS 3.4 |
| Auth & Database | Supabase (PostgreSQL + Realtime + Auth + Edge Functions) |
| AI Integration | Google Gemini API |
| Backend Agent | Python 3.13, FastAPI, uvicorn |
| Infra | Ubuntu 25.10 VPS, Nginx, PM2, GitHub Actions |
| CI/CD | GitHub Actions → SSH → deploy.sh → PM2 reload |

## File Map

```
jadisatu.cloud/
├── .github/workflows/deploy.yml  # CI/CD pipeline
├── deploy/
│   ├── deploy.sh                  # Deployment script (single source of truth)
│   └── check-status.sh            # Health check utility
├── docs/
│   ├── system-context.md          # THIS FILE - architecture & context
│   ├── current-roadmap.md         # Development priorities
│   ├── deployment.md              # Deployment guide
│   ├── ai-dev-guide.md            # Rules for AI development
│   ├── GOOGLE_OAUTH_SETUP.md      # OAuth setup guide
│   ├── HUNTER_AGENT_MIGRATION_SUMMARY.md
│   └── QUICK_START_LEADS.md
├── frontend/                      # Static HTML/JS dashboard
│   ├── index.html                 # Landing/main page
│   ├── dashboard.html             # Main dashboard view
│   ├── login.html                 # Auth page
│   ├── *-view.html                # Feature views (kanban, CRM, notes, etc.)
│   └── js/                        # 28 JS modules
│       ├── config.js              # Supabase client config
│       ├── auth.js                # Authentication logic
│       ├── main.js                # App initialization
│       ├── data-service.js        # Supabase data operations
│       ├── task-renderer.js       # Task/kanban rendering
│       ├── crm-renderer.js        # CRM view rendering
│       ├── juru-bubble.js         # AI assistant bubble
│       └── ...                    # Other modules
├── nextjs-app/                    # Next.js SSR dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Home page
│   │   │   ├── login/page.tsx     # Login page
│   │   │   ├── kanban/page.tsx    # Kanban board
│   │   │   ├── leads/page.tsx     # Lead management
│   │   │   ├── agents/page.tsx    # Agent monitoring
│   │   │   ├── projects/page.tsx  # Projects view
│   │   │   ├── settings/page.tsx  # Settings
│   │   │   ├── api/               # API routes
│   │   │   │   ├── tasks/route.ts
│   │   │   │   ├── domains/route.ts
│   │   │   │   ├── leads/route.ts
│   │   │   │   ├── agents/route.ts
│   │   │   │   ├── morning-briefing/route.ts
│   │   │   │   └── ...
│   │   │   └── auth/callback/route.ts
│   │   ├── components/
│   │   │   ├── dashboard/         # Dashboard components
│   │   │   └── layout/Sidebar.tsx
│   │   ├── lib/
│   │   │   ├── supabase.ts        # Supabase client
│   │   │   ├── supabase-browser.ts
│   │   │   ├── supabase-server.ts
│   │   │   └── utils.ts
│   │   └── middleware.ts           # Auth middleware
│   ├── package.json
│   └── tsconfig.json
├── hunter-agent/                   # Lead generator
│   ├── backend/
│   │   ├── api.py                  # FastAPI server (port 8000)
│   │   ├── database.py            # Supabase DB operations
│   │   ├── hunter_agent.py        # Main orchestrator
│   │   ├── reddit_scraper.py      # Reddit scraper
│   │   ├── linkedin_scraper.py    # LinkedIn scraper (Apify)
│   │   ├── gemini_analyzer.py     # Gemini AI analysis
│   │   └── requirements.txt
│   └── frontend/                   # Hunter dashboard (Next.js)
├── sql/                            # Database schemas
│   ├── supabase-schema.sql         # Main schema
│   ├── supabase-auth-migration.sql
│   ├── supabase-new-tables.sql
│   └── SUPABASE_SETUP_LEADS.sql
├── ecosystem.config.js             # PM2 process config
├── .env.example                    # Environment template
├── .gitignore
└── README.md
```

## Database Tables (Supabase)

| Table | Description |
|-------|------------|
| tasks | Task management (kanban items) |
| projects | Project tracking |
| domains | Work domains (work, learn, business, personal) |
| activities | Activity/history log |
| agents | AI agent registry |
| agent_logs | Agent execution logs |
| leads | Hunter agent leads/pain points |
| schedule | Schedule entries |

## API Endpoints

### Next.js API Routes (localhost:3000)
- `GET/POST /api/tasks` - CRUD tasks
- `DELETE /api/tasks/[id]` - Delete task
- `GET/POST /api/domains` - Domain management
- `GET/POST /api/projects` - Project management
- `GET /api/leads` - Lead data
- `GET /api/agents` - Agent status
- `GET /api/morning-briefing` - Daily briefing
- `GET /api/activities` - Activity feed
- `POST /api/init-user` - Initialize new user
- `GET /api/context-digest` - AI context digest
- `GET /api/schedule` - Schedule data
- `POST /api/setup-leads` - Setup leads table

### Hunter Agent API (localhost:8000)
- `GET /docs` - FastAPI auto-docs
- `POST /api/run-cycle` - Run full scrape cycle
- `GET /api/leads` - Get all leads
- `GET /api/stats` - Dashboard stats

## Environment Variables

See `.env.example` for the full list. Key variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (public)
- `SUPABASE_SERVICE_KEY` - Supabase service key (SERVER ONLY)
- `GEMINI_API_KEY` - Google Gemini API key
- `APIFY_TOKEN` - Apify API token (LinkedIn scraping)
