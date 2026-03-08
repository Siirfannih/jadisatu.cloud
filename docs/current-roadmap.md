# JadisatuOS - Current Roadmap

> Update file ini setiap kali ada perubahan prioritas atau fitur baru selesai.

## Status Legend
- [x] Done
- [~] In progress
- [ ] Not started

## Completed
- [x] Static frontend dashboard (HTML/JS) with all views
- [x] Task management (Kanban + List view)
- [x] Project tracking
- [x] CRM & Lead management views
- [x] Creative Hub (content planning)
- [x] AI Assistant bubble (Juru)
- [x] Morning Briefing
- [x] Notes & Focus Mode
- [x] Next.js dashboard with Supabase auth (SSR)
- [x] Hunter Agent - Reddit & LinkedIn lead scraper
- [x] Hunter Agent - Gemini AI analysis
- [x] Supabase database schema & migrations
- [x] Google OAuth integration
- [x] GitHub repository setup & audit
- [x] Secrets removed from codebase
- [x] CI/CD pipeline (GitHub Actions → VPS)
- [x] PM2 process management
- [x] Deployment observability (structured logging)

## In Progress
- [~] AI-assisted development workflow documentation
- [~] Consolidate static frontend vs Next.js app

## Next Up (Priority Order)
1. [ ] Carousel content generator
2. [ ] Mobile-responsive dashboard
3. [ ] Morning briefing automation (scheduled)
4. [ ] Agent control center (start/stop/monitor agents)
5. [ ] Multi-user workspace support
6. [ ] Content calendar integration

## Architecture Debt
- [ ] Decide primary frontend: static HTML or Next.js (currently both exist)
- [ ] Add health check API endpoints (`/healthz`)
- [ ] Add error monitoring (Sentry or equivalent)
- [ ] Add unit tests for API routes
- [ ] Consolidate hunter-agent frontend into main Next.js app
- [ ] Set up proper SSL certificate (currently self-signed)

## Infrastructure Debt
- [ ] Set up log rotation for PM2 and deploy logs
- [ ] Add uptime monitoring (UptimeRobot or similar)
- [ ] Configure VPS firewall rules (ufw)
- [ ] Add database backups (Supabase automatic + manual exports)
