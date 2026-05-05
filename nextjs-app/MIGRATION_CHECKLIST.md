# Migration Checklist: JadisatuDashboardNew → nextjs-app

## Pre-Migration: Page Parity Check

### Core Pages
- [x] `/` Dashboard — redesigned with parallel API, lazy charts, animations
- [x] `/content` Content Studio — Kanban + Notion workspace + calendar
- [x] `/crm` CRM — redesigned with animations
- [x] `/analytics` Analytics — lazy-loaded charts
- [ ] `/login` Login — needs redesign to match new design system
- [ ] `/leads` Leads — needs redesign
- [ ] `/history` History — needs redesign
- [ ] `/settings` Settings — needs redesign
- [ ] `/business-profile` Business Profile — needs redesign
- [ ] `/my-network` My Network — needs redesign

### Mandala Pages
- [ ] `/mandala` Overview — needs redesign (CockpitOverview)
- [x] `/mandala/conversations` — redesigned, flex layout
- [ ] `/mandala/pipeline` — needs redesign
- [ ] `/mandala/outreach` — needs redesign
- [ ] `/mandala/tasks` — needs redesign
- [ ] `/mandala/analytics` — needs redesign
- [ ] `/mandala/knowledge` — needs redesign
- [ ] `/mandala/policies` — needs redesign
- [ ] `/mandala/whatsapp` — needs redesign

### AI Agent Pages
- [ ] `/ai-agent` — needs redesign
- [ ] `/ai-agent/knowledge` — needs redesign
- [ ] `/ai-agent/policies` — needs redesign
- [ ] `/ai-agent/training` — needs redesign

### Components
- [x] Sidebar — flyout for collapsed mode
- [x] RevenueChart — extracted, lazy-loadable
- [x] AnalyticsCharts — extracted, lazy-loadable
- [x] CockpitConversations — flex layout fix
- [ ] JuruCopilot — verify still works
- [ ] All Cockpit* components — verify API connections

## Pre-Migration: Technical Checks
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Auth flow works (login → callback → redirect)
- [ ] Middleware redirects are correct
- [ ] All env vars from .env.local are set on VPS
- [ ] Mandala proxy (localhost:3100) works via /api/mandala/[...path]
- [ ] Juru copilot chat works
- [ ] RAG/embedding endpoints work

## Deployment Steps
1. SSH into VPS
2. `cd /root/jadisatu.cloud`
3. `mv nextjs-app nextjs-app-old`
4. Copy new dashboard as `nextjs-app`
5. `cd nextjs-app && npm install`
6. Copy `.env.local` from backup: `cp ../nextjs-app-old/.env.local .`
7. `npm run build`
8. `pm2 restart jadisatu-nextjs`
9. Verify: `curl https://jadisatu.cloud` returns 200
10. Verify: login flow works
11. If broken: `mv nextjs-app nextjs-app-broken && mv nextjs-app-old nextjs-app && pm2 restart jadisatu-nextjs`

## Priority Order for Remaining Pages
1. Login (gateway — must work perfectly)
2. Mandala Overview (most used Mandala page)
3. Mandala Pipeline + Outreach (sales workflow)
4. Settings + Business Profile (user config)
5. Leads + History (secondary pages)
6. AI Agent pages (lower traffic)
7. My Network (newest feature)
