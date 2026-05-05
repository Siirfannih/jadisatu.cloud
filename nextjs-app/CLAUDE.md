# Jadisatu Dashboard — Claude Code Worker Protocol

You are the **Jadisatu Frontend Worker** — the developer for jadisatu.cloud's new dashboard UI.

- **Repository**: `https://github.com/Siirfannih/jadisatu.cloud`
- **Production**: `https://jadisatu.cloud`
- **Status**: UI Redesign — replacing old `nextjs-app/` with this new dashboard

> **CRITICAL**: This is a PRODUCTION app, NOT an MVP. Every page must be complete, polished, and connected to real backend APIs. Never use placeholder data where real APIs exist. Never treat working features as "coming soon."

---

## 1. Architecture Overview

```
jadisatu.cloud/
├── nextjs-app/          ← OLD UI (being replaced by THIS project)
├── mandala-engine/      ← Hono backend on :3100 (DO NOT MODIFY)
├── hunter-agent/        ← FastAPI on :8000 (DO NOT MODIFY)
├── visual-engine/       ← FastAPI on :8100 (DO NOT MODIFY)
├── sql/                 ← 23 Supabase migrations (DO NOT MODIFY)
└── deploy/              ← PM2 + Nginx config

THIS PROJECT (JadisatuDashboardNew) = replacement for nextjs-app/
```

**Integration strategy**: This dashboard calls the SAME Supabase database and the SAME backend services. All API routes in `src/app/api/` are the bridge between UI and backend. Do not change API contracts.

---

## 2. Tech Stack (Non-Negotiable)

| Layer | Tech | Version |
|-------|------|---------|
| Framework | Next.js (App Router) | 15.1.6 |
| React | React + Hooks only | 19.0.0 |
| Language | TypeScript strict | 5.8.2 |
| Styling | Tailwind CSS | 3.4.0 |
| Icons | Lucide React | 0.546.0 |
| Charts | Recharts (lazy-loaded) | 3.8.1 |
| Database | Supabase (SSR) | 2.49.0 |
| Auth | Supabase Auth (Google OAuth + Email) | via @supabase/ssr |
| Animations | CSS native (NO Framer Motion) | — |
| Drag & Drop | HTML5 native (NO dnd-kit) | — |

**BANNED**: Framer Motion, dnd-kit, any new animation/DnD library. We use CSS `animation` + native HTML5 drag-and-drop only.

---

## 3. Design System Tokens

### Colors
```
Primary:        #0060E1 (brand blue)
Primary hover:  #1D4ED8 (blue-700)
Success:        #10B981 (emerald-500)
Page background:#F8FAFC (slate-50)
Card background: white
Card shadow:    shadow-[0_1px_3px_rgba(0,0,0,0.04)]
Card radius:    rounded-2xl
Border:         border-slate-100
```

### Score Colors (IMPORTANT — NEVER use red for scores)
```
Score ≥ 80:   text-emerald-600 + bg-emerald-50
Score 50-79:  text-[#0060E1] + bg-blue-50
Score < 50:   text-slate-500 + bg-slate-50
```

### Typography
```
Page title:     text-xl font-bold text-slate-800
Section title:  text-xs font-bold uppercase tracking-wider text-slate-400
Card title:     text-sm font-semibold text-slate-800
Body text:      text-sm text-slate-600
Tiny label:     text-[10px] font-bold uppercase tracking-wider text-slate-400
```

### Entrance Animations (ALL pages must have this)
```css
@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Apply via inline style: */
style={{
  animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
  animationDelay: '0.05s'  /* stagger: 0.05s, 0.1s, 0.15s, etc. */
}}
```

### Card Pattern
```tsx
<div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100 p-5">
  {/* content */}
</div>
```

### Kanban Column Pattern (Content Studio)
```
Monochrome blue scale:
  Ide:      border-t-[#0060E1]
  Draft:    border-t-[#3B82F6]
  Script:   border-t-[#60A5FA]
  Siap:     border-t-[#93C5FD]
  Terbit:   border-t-[#10B981]
```

---

## 4. Page Status & Requirements

### ✅ DONE (redesigned, production-quality)

| Page | Route | Key Features |
|------|-------|-------------|
| Dashboard | `/` | Parallel API calls (Promise.all), lazy-loaded RevenueChart, entrance animations, greeting + metric cards + main grid |
| Content Studio | `/content` | 3 tabs (Ringkasan/Perencana/Inspirasi), Kanban with native HTML5 DnD, full-page Notion-style workspace editor, mini-calendar in Ringkasan, published scorecard with deterministic analytics |
| CRM | `/crm` | Entrance animations, stats row, search/filter bar |
| Analytics | `/analytics` | Lazy-loaded charts (RevenueLineChart, ChannelPieChart) |
| Mandala Conversations | `/mandala/conversations` | 3-panel WhatsApp inbox, flex layout (no cutoff) |
| Sidebar | component | Flyout popup for Mandala when collapsed (icon-only mode) |

### 🔧 NEEDS REDESIGN (pages exist but use old UI pattern)

| Page | Route | Backend API | Notes |
|------|-------|------------|-------|
| Login | `/login` | Supabase Auth | Google OAuth + Email/Password |
| Mandala Overview | `/mandala` | `/api/mandala/stats` | CockpitOverview component |
| Mandala Pipeline | `/mandala/pipeline` | `/api/mandala/leads` | CockpitPipeline component |
| Mandala Outreach | `/mandala/outreach` | `/api/mandala/outreach` | CockpitOutreach component |
| Mandala Tasks | `/mandala/tasks` | `/api/mandala/tasks` | CockpitTasks component |
| Mandala Analytics | `/mandala/analytics` | `/api/mandala/stats` | CockpitAnalytics component |
| Mandala Knowledge | `/mandala/knowledge` | `/api/mandala/knowledge` | CockpitKnowledge component |
| Mandala Policies | `/mandala/policies` | `/api/mandala/policies` | CockpitPolicies component |
| Mandala WhatsApp | `/mandala/whatsapp` | `/api/mandala/whatsapp` | CockpitWhatsApp component |
| AI Agent | `/ai-agent` | `/api/agents` | Agent config pages |
| AI Agent Knowledge | `/ai-agent/knowledge` | `/api/mandala/knowledge` | |
| AI Agent Policies | `/ai-agent/policies` | `/api/mandala/policies` | |
| AI Agent Training | `/ai-agent/training` | `/api/mandala/training` | |
| Leads | `/leads` | `/api/leads` | Lead management |
| History | `/history` | `/api/activities` | Activity log |
| Settings | `/settings` | Supabase Auth | User preferences |
| Business Profile | `/business-profile` | `/api/notes`, `/api/domains` | Notes + domains |
| My Network | `/my-network` | `/api/leads` | Network view |

### When redesigning a page:
1. Read 2-3 DONE pages first to understand patterns
2. Use the same design tokens (colors, shadows, radius, typography)
3. Add entrance animations with staggered delays
4. Connect to REAL API endpoints — no dummy data unless API doesn't exist yet
5. Use lazy-loading for heavy components (recharts, etc.)
6. All pages must be `'use client'` if they use hooks/state

---

## 5. API Routes Reference

All routes require authenticated Supabase session unless noted. **Do not modify API route logic** — only modify UI pages and components.

### Core
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/activities` | Activity log |
| GET | `/api/agents` | List AI agents |
| GET | `/api/context-digest` | Lightweight context for agents |
| GET,POST | `/api/domains` | User domains (Work, Learn, Business, Personal) |
| POST | `/api/init-user` | Initialize new user defaults |
| GET,POST | `/api/morning-briefing` | Daily briefing |
| GET,POST | `/api/schedule` | Schedule blocks |

### Content & Creative
| Method | Route | Purpose |
|--------|-------|---------|
| GET,POST,PATCH,DELETE | `/api/contents` | Content CRUD |
| POST | `/api/narrative/generate` | AI content generation (RAG) |
| POST | `/api/narrative/research` | Research synthesis |
| POST | `/api/rag/embed` | Single embedding |
| POST | `/api/rag/batch-embed` | Batch embeddings |
| POST | `/api/rag/generate` | RAG generation |

### Tasks & Projects
| Method | Route | Purpose |
|--------|-------|---------|
| GET,POST,PATCH | `/api/tasks` | Task CRUD |
| DELETE | `/api/tasks/[id]` | Delete task |
| GET,POST | `/api/projects` | Project CRUD |
| PATCH,DELETE | `/api/projects/[id]` | Update/delete project |

### CRM
| Method | Route | Purpose |
|--------|-------|---------|
| GET,POST | `/api/leads` | Lead management |
| POST | `/api/setup-leads` | Seed sample leads |
| GET,POST,PATCH,DELETE | `/api/notes` | Quick notes |

### Mandala (CRM/Sales AI)
| Method | Route | Purpose |
|--------|-------|---------|
| * | `/api/mandala/[...path]` | Catch-all proxy to mandala-engine :3100 |
| GET,POST | `/api/mandala/conversations` | AI conversations |
| GET | `/api/mandala/hunter` | Hunter prospects |
| POST | `/api/mandala/hunter/run` | Run Hunter |
| GET | `/api/mandala/knowledge` | Knowledge base |
| GET,POST | `/api/mandala/leads` | Mandala leads |
| GET,POST | `/api/mandala/outreach` | Outreach queue |
| GET | `/api/mandala/policies` | Policies |
| GET | `/api/mandala/stats` | Statistics |
| GET,POST | `/api/mandala/tasks` | Agent tasks |
| GET | `/api/mandala/training` | Training data |
| GET | `/api/mandala/whatsapp` | WhatsApp integration |

### Copilot
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/juru/chat` | Juru copilot AI chat |

---

## 6. File Structure

```
src/
├── app/
│   ├── page.tsx                  ← Dashboard (DONE)
│   ├── layout.tsx                ← Root layout
│   ├── login/page.tsx
│   ├── content/page.tsx          ← Content Studio (DONE)
│   ├── crm/page.tsx              ← CRM (DONE)
│   ├── analytics/page.tsx        ← Analytics (DONE)
│   ├── leads/page.tsx
│   ├── history/page.tsx
│   ├── settings/page.tsx
│   ├── business-profile/page.tsx
│   ├── my-network/page.tsx
│   ├── mandala/
│   │   ├── page.tsx              ← Mandala overview
│   │   ├── conversations/page.tsx ← Conversations (DONE)
│   │   ├── pipeline/page.tsx
│   │   ├── outreach/page.tsx
│   │   ├── tasks/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── knowledge/page.tsx
│   │   ├── policies/page.tsx
│   │   └── whatsapp/page.tsx
│   ├── ai-agent/
│   │   ├── page.tsx
│   │   ├── knowledge/page.tsx
│   │   ├── policies/page.tsx
│   │   └── training/page.tsx
│   ├── auth/
│   │   ├── bridge/page.tsx
│   │   └── callback/route.ts
│   └── api/                      ← All API routes (DO NOT MODIFY logic)
│       └── ... (see Section 5)
│
├── components/
│   ├── JuruCopilot.tsx
│   ├── charts/
│   │   ├── RevenueChart.tsx      ← Lazy-loaded bar chart
│   │   └── AnalyticsCharts.tsx   ← Lazy-loaded line + pie charts
│   ├── dashboard/                ← Dashboard widgets
│   ├── layout/
│   │   ├── app-sidebar.tsx       ← Main sidebar with Mandala flyout (DONE)
│   │   ├── app-layout.tsx
│   │   └── TopNav.tsx
│   ├── mandala/                  ← Mandala cockpit components
│   │   ├── CockpitOverview.tsx
│   │   ├── CockpitConversations.tsx (DONE)
│   │   ├── CockpitPipeline.tsx
│   │   ├── CockpitOutreach.tsx
│   │   ├── CockpitTasks.tsx
│   │   ├── CockpitAnalytics.tsx
│   │   ├── CockpitKnowledge.tsx
│   │   ├── CockpitPolicies.tsx
│   │   ├── CockpitWhatsApp.tsx
│   │   ├── design.ts
│   │   └── types.ts
│   └── ui/                       ← Shadcn/Radix primitives
│
├── lib/
│   ├── supabase.ts               ← Proxy client (use this)
│   ├── supabase-server.ts        ← Server client (createClient, getSession, getUser)
│   ├── supabase-browser.ts       ← Browser client
│   ├── mandala-api.ts            ← Mandala API utilities
│   ├── mandala-auth.ts           ← Owner check (irfangede1789@gmail.com)
│   ├── utils.ts
│   ├── juru/                     ← Copilot AI routing
│   ├── narrative/                ← Content scraping
│   └── rag/gemini.ts             ← RAG embeddings & generation
│
├── middleware.ts                  ← Auth guard + route redirects
└── hooks/useMediaQuery.ts
```

---

## 7. Supabase Configuration

```env
NEXT_PUBLIC_SUPABASE_URL=https://dwpkokavxjvtrltntjtn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<in .env.local>
SUPABASE_SERVICE_KEY=<in .env.local>
GEMINI_API_KEY=<in .env.local>
OPENROUTER_API_KEY=<in .env.local>
```

**Client usage**:
- Server components / API routes: `import { createClient } from '@/lib/supabase-server'`
- Client components: `import { createClient } from '@/lib/supabase-browser'`
- Never create new Supabase instances

**Key tables**: tasks, projects, contents, domains, leads, agents, activity_log, morning_briefings, schedule_blocks, ideas, mandala_conversations, mandala_outreach_queue, mandala_hunter_prospects, mandala_tasks

---

## 8. Component Patterns

### Lazy-loading heavy components
```tsx
import dynamic from 'next/dynamic'
const RevenueChart = dynamic(() => import('@/components/charts/RevenueChart'), { ssr: false })
```

### Parallel API calls on dashboard
```tsx
const [a, b, c] = await Promise.all([
  fetch('/api/endpoint-a'),
  supabase.from('table_b').select('*'),
  supabase.from('table_c').select('*'),
])
```

### HTML5 native drag-and-drop
```tsx
<div draggable onDragStart={(e) => { setDraggedCard(card); e.dataTransfer.effectAllowed = 'move' }}>
<div onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
     onDrop={(e) => { e.preventDefault(); handleDrop(targetStatus) }}>
```

### Full-page workspace overlay (Notion-style, used in Content Studio)
```tsx
<div className="fixed inset-0 z-50 bg-white">
  {/* Top bar with back button + save */}
  <div className="flex h-[calc(100vh-72px)]">
    <div className="flex-1 px-8 py-8">      {/* Writing area 70% */}
    <div className="w-[280px] bg-slate-50">   {/* Metadata sidebar 30% */}
  </div>
</div>
```

### Sidebar flyout (for collapsed mode)
```tsx
{collapsed && mandalaFlyout && (
  <div className="fixed z-50" style={{ left: '52px', top: triggerRef.current?.getBoundingClientRect().top }}>
    {/* flyout menu */}
  </div>
)}
```

---

## 9. Workflow & Validation

```bash
# 1. Before modifying any page, read 2-3 completed pages for patterns
# 2. Make changes
# 3. Verify TypeScript
npx tsc --noEmit
# 4. Verify build
npm run build
# 5. Test in browser
npm run dev
```

### Rules
1. **Never skip TypeScript checks** — `npx tsc --noEmit` must pass
2. **Never modify API route logic** unless explicitly asked — only UI pages and components
3. **Always include entrance animations** on new/redesigned pages
4. **Never use red for scores** — use green/blue/slate scale
5. **Always use existing Supabase clients** from `src/lib/`
6. **All database queries must filter by user_id** (RLS is enabled)
7. **Lazy-load recharts** — never import directly in page files
8. **Use native HTML5 DnD** — no dnd-kit or other libraries
9. **Use CSS animations** — no Framer Motion

---

## 10. Migration Plan

This project replaces `jadisatu.cloud/nextjs-app/`. When ready to deploy:

```bash
# On the VPS:
cd /root/jadisatu.cloud
mv nextjs-app nextjs-app-old          # Backup old UI
cp -r JadisatuDashboardnew nextjs-app # Replace with new UI
cd nextjs-app
npm install
npm run build
pm2 restart jadisatu-nextjs
```

**Pre-migration checklist**:
- [ ] All pages from old UI are redesigned or intentionally removed
- [ ] All API routes work identically
- [ ] Auth flow (login → callback → dashboard) works
- [ ] Middleware redirects are correct
- [ ] Environment variables are set
- [ ] TypeScript compiles clean
- [ ] Build succeeds
- [ ] Mandala engine proxy (localhost:3100) still works
