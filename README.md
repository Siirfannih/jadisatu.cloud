# JadiSatu.cloud

**JadiSatu OS** - Dashboard produktivitas & manajemen bisnis all-in-one untuk UMKM Indonesia.

## Struktur Project

```
jadisatu.cloud/
├── frontend/         # Static HTML/JS dashboard (deployed via nginx)
├── nextjs-app/       # Next.js dashboard app (SSR version)
├── hunter-agent/     # Lead generator & CRM agent
├── docs/             # Setup guides & documentation
├── sql/              # Supabase schema & migrations
├── .env.example      # Environment variable template
└── .gitignore
```

## Tech Stack

- **Frontend**: Vanilla JS + Supabase Client, served via Nginx
- **Next.js App**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **AI**: Google Gemini API (via Supabase Edge Functions)
- **Hosting**: VPS (Ubuntu) + Nginx reverse proxy

## Fitur Utama

- Task Management (Kanban & List view)
- Project Tracking
- CRM & Lead Management
- Creative Hub (Content Planning)
- AI Assistant (Juru)
- Morning Briefing
- Notes & Focus Mode
- Agent Monitoring

## Setup

### Frontend (Static)
```bash
# Copy frontend/ ke web server root
# Konfigurasi nginx sesuai kebutuhan
```

### Next.js App
```bash
cd nextjs-app
cp ../.env.example .env.local
# Edit .env.local dengan credentials Supabase kamu
npm install
npm run dev
```

### Database
```bash
# Jalankan SQL files di Supabase SQL Editor:
# 1. sql/supabase-schema.sql
# 2. sql/supabase-auth-migration.sql
# 3. sql/supabase-new-tables.sql
```

## Deployment

Deployed di VPS Ubuntu via:
- **Nginx** → serves `frontend/` sebagai static files
- **Systemd** → runs Next.js app on port 3000
- **Supabase** → managed cloud database & auth

## License

Private - All rights reserved.
