# Issue #17 — Product & IA Blueprint: Mandala as Multi-Tenant Business Operator

> **Status**: Draft
> **Author**: Jadisatu Worker Agent (Architecture)
> **Date**: 2026-03-27
> **Depends on**: Mandala Engine (running), Supabase schema (deployed), Next.js Light Mode (running)

---

## 1. Executive Summary

Mandala is JadiSatu's autonomous business operator — an AI runtime that manages customer conversations, qualifies leads, and hunts prospects across WhatsApp and Telegram. Today it exists as a **running system** with a robust backend engine (`mandala-engine/`), 7 database tables, a knowledge/skills filesystem, and a single owner-only dashboard page (`nextjs-app/src/app/mandala/page.tsx`).

This blueprint reframes Mandala from an internal owner dashboard into a **multi-tenant, user-facing product feature** inside JadiSatu OS. Any JadiSatu user (UMKM owner, creator) should be able to activate Mandala for their business, train it with their product knowledge, assign it tasks, and review its work — all through a structured "cockpit" UI.

### What changes

| Dimension | Current State | Proposed State |
|-----------|--------------|----------------|
| Access | Owner-only (`isMandalaOwner()`) | Role-based (owner, operator, admin) per tenant |
| Tenancy | Single hardcoded tenant (`mandala.yml`) | Dynamic tenants from DB, self-service activation |
| UI | 1 page with 3 tabs | 8-section cockpit + main dashboard widget |
| Training | Files on disk (`mandala/knowledge/*.md`) | DB-backed knowledge base with CRUD UI |
| Policies | Hardcoded in YAML + markdown | Configurable per tenant through UI |
| Hunter | Background cron, env-var config | User-triggered campaigns with review UI |

### What stays the same

- `mandala-engine/` runtime architecture (Hono, Supabase, Gemini)
- Conversation state machine (5 phases, scoring, handoff)
- Webhook infrastructure (WhatsApp/Telegram/OpenClaw)
- Shadow evaluator pipeline
- Customer memory system
- Message routing and context assembly

---

## 2. Current State Analysis

### 2.1 Runtime — `mandala-engine/`

The engine is a standalone Hono server (port 3100) with these core modules:

| Module | File | Purpose |
|--------|------|---------|
| Entry point | `mandala-engine/src/index.ts` | Loads tenants, starts handoff timer + hunter scheduler |
| Types | `mandala-engine/src/types/shared.ts` | 188-line type system (Mode, Phase, Handler, Temperature) |
| Router | `mandala-engine/src/channels/router.ts` | Incoming message orchestration |
| Webhooks | `mandala-engine/src/routes/webhooks.ts` | WhatsApp, Telegram, OpenClaw endpoints |
| API | `mandala-engine/src/routes/api.ts` | Conversation, lead, handoff, hunter endpoints |
| Context | `mandala-engine/src/ai/context-assembler.ts` | Assembles prompt from identity + rules + mode + skills + knowledge + memory |
| Evaluator | `mandala-engine/src/evaluator/shadow-evaluator.ts` | Intent classification, buying signal, score delta |
| Memory | `mandala-engine/src/evaluator/memory-updater.ts` | Per-customer memory (business type, pain points, style) |
| Scoring | `mandala-engine/src/tools/lead-scorer.ts` | 0-100 score with temperature bands |
| Store | `mandala-engine/src/memory/conversation-store.ts` | Supabase-backed conversation + message persistence |
| Tenants | `mandala-engine/src/tenants/manager.ts` | Loads from YAML files, supports hot-reload |
| Hunter | `mandala-engine/src/hunter/index.ts` | 4-step pipeline: Discover → Enrich → Classify → Cold Message |
| Maps | `mandala-engine/src/hunter/google-maps.ts` | Google Places API integration |
| Scheduler | `mandala-engine/src/hunter/scheduler.ts` | Background cron for hunter cycles |

**Conversation State Machine** (from `mandala-engine/src/state-machine/types.ts`):
```
kenalan → gali_masalah → tawarkan_solusi → closing
                                              ↓
                                           rescue (recovery path)
```

**Two Operating Modes**:
- `sales-shadow` — Invisible AI handling customer messages (anti-detection rules apply)
- `ceo-assistant` — Direct assistant for owner/admin conversations

### 2.2 Dashboard — `nextjs-app/src/app/mandala/page.tsx`

Single 555-line client component. Owner-only access via `isMandalaOwner()` (`nextjs-app/src/lib/mandala-auth.ts`). Displays:

- 4 stat cards (conversations, conversion rate, avg score, hunter prospects)
- 3 tabs: Pipeline (lead temperature), Conversations (list with takeover/release), Hunter Prospects
- 30-second auto-refresh
- No training UI, no policy management, no knowledge editing

### 2.3 API Routes — `nextjs-app/src/app/api/mandala/`

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/mandala/stats` | GET | Dashboard stats (owner-only) |
| `/api/mandala/conversations` | GET, POST | List + takeover/release actions |
| `/api/mandala/hunter` | GET | List hunter prospects |
| `/api/mandala/hunter/run` | POST | Trigger hunter pipeline |
| `/api/mandala/leads` | GET | Lead pipeline with temperature filter |

All routes enforce owner-only access. No tenant parameter — assumes single tenant.

### 2.4 Tenant Config — `tenants/mandala.yml`

73-line YAML defining: owner identity, channels (WhatsApp + Telegram), AI models, routing rules, handoff timing, scoring thresholds, knowledge file paths, and cron schedules. Currently the only tenant.

### 2.5 Knowledge & Skills — `mandala/`

18 markdown files organized as:
```
mandala/
├── core/identity.md          # Who Mandala is
├── core/rules.md             # Security, anti-detection, data rules
├── modes/ceo-assistant.md    # Owner-facing behavior
├── modes/sales-shadow.md     # Customer-facing behavior (108 lines)
├── knowledge/
│   ├── jadisatu-products.md  # Product catalog
│   ├── faq.md                # Common questions
│   └── competitors.md        # Market positioning
└── skills/
    ├── sales/qualifying.md
    ├── sales/objection-handling.md
    ├── sales/closing.md
    ├── sales/product-knowledge.md
    ├── conversation/natural-flow.md
    ├── conversation/style-matching.md
    ├── conversation/handoff.md
    ├── admin/github-ops.md
    ├── admin/notion-ops.md
    ├── admin/server-ops.md
    └── admin/reporting.md
```

These are loaded by `ContextAssembler` at runtime. Not editable through UI.

### 2.6 Database Schema — `sql/mandala-schema.sql`

7 tables, all with RLS:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `mandala_conversations` | Active/closed conversations | tenant_id, customer_name, phase, handler, mode, lead_score |
| `mandala_messages` | Message log | conversation_id, direction, sender, content |
| `mandala_lead_scores` | Per-conversation scoring | score, temperature, phase, signals (jsonb) |
| `mandala_handoff_events` | Owner↔Mandala transfer audit | direction, reason |
| `mandala_customer_memory` | Per-customer intelligence | business_name, pain_points[], communication_style, negotiation_position |
| `mandala_evaluator_log` | Shadow evaluator output | intent, buying_signal, score_delta, resistance_type |
| `mandala_hunter_prospects` | Google Maps sourced leads | business_name, pain_score, status, priority, cold_message tracking |

### 2.7 Navigation — `nextjs-app/src/components/layout/Sidebar.tsx`

Mandala occupies its own sidebar section ("Mandala AI") with a single nav item pointing to `/mandala`. It sits between Creative and Insights sections.

### 2.8 Gaps Identified

1. **No multi-tenancy in UI** — Engine supports multiple tenants via `TenantManager`, but UI assumes single owner
2. **No role system** — Only `isMandalaOwner()` check (email match or allow-all)
3. **No training UI** — Knowledge/skills are markdown files, not DB-editable
4. **No policy UI** — Handoff rules, scoring thresholds, response delays are YAML-only
5. **No conversation review workflow** — Can view conversations but no structured review/approval flow
6. **No outreach campaign management** — Hunter runs via cron or manual API call, no campaign UI
7. **Single nav entry** — Complex feature compressed into one page with 3 tabs
8. **No main dashboard integration** — Mandala stats don't appear on the JadiSatu dashboard

---

## 3. Product Model

### 3.1 What is Mandala (Product Definition)

**Mandala is a multi-tenant autonomous business operator** that each JadiSatu user can activate for their business. It:

- Handles customer conversations on WhatsApp and Telegram
- Qualifies leads through a 5-phase sales pipeline
- Hunts new prospects via Google Maps intelligence
- Learns from the owner's communication style and product knowledge
- Hands off to humans when needed, takes back when humans go silent
- Operates 24/7 with configurable policies

**Mandala is NOT**: a chatbot builder, a generic AI assistant, or a customer support tool. It is specifically a **sales-shadow and business operations agent** with deep context about the owner's business.

### 3.2 Tenant Model

```
┌─────────────────────────────────────────────────┐
│ JadiSatu User (auth.users)                      │
│  ├── has one or more Mandala Tenants             │
│  │    ├── tenant config (DB, migrated from YAML) │
│  │    ├── channels (WhatsApp, Telegram)          │
│  │    ├── knowledge base (DB-backed)             │
│  │    ├── policies (DB-backed)                   │
│  │    ├── conversations                          │
│  │    ├── leads + prospects                      │
│  │    └── team members (roles)                   │
│  └── JadiSatu OS features (tasks, projects, etc) │
└─────────────────────────────────────────────────┘
```

**Phase 1 (MVP)**: One tenant per user. The user who activates Mandala is the owner.
**Phase 2**: Multiple tenants per user (e.g., one per business). Team member invites.

### 3.3 Role Definitions

| Role | Description | Permissions |
|------|-------------|-------------|
| **Owner** | Business owner who activated Mandala | Full access: configure, train, review, manage team, override Mandala decisions, takeover conversations |
| **Operator** | Team member handling day-to-day | View conversations, takeover/release, review leads, trigger hunter runs, view analytics. Cannot change policies or knowledge base |
| **Admin** | Technical administrator | All operator permissions + edit knowledge base, configure policies, manage channels, view evaluator logs |
| **Mandala (runtime)** | The AI agent itself | Converse with customers, score leads, update memory, request handoff, execute hunter pipeline. Cannot modify its own policies or knowledge |

**Current mapping**: Today's `isMandalaOwner()` maps to the Owner role. The `current_handler` field in `mandala_conversations` already tracks `owner | admin | mandala | unassigned` — this aligns with the role model.

### 3.4 Activation Flow

```
User opens /mandala (cockpit) for the first time
    → Activation wizard (3 steps):
       1. Connect channel (WhatsApp via Fonnte, or Telegram bot token)
       2. Add business basics (name, type, products/services)
       3. Set initial policies (response delay, handoff rules, operating hours)
    → Mandala tenant created in DB
    → Engine picks up new tenant via hot-reload (TenantManager.reload())
    → Mandala begins operating on connected channel
```

---

## 4. User Journeys

### 4.1 Activate Mandala

```
Trigger:  User clicks "Mandala" in sidebar for the first time
          (no active tenant for this user_id)

Steps:
  1. Landing page explains Mandala value prop
  2. User clicks "Aktifkan Mandala"
  3. Step 1/3: Connect WhatsApp (Fonnte webhook) or Telegram (bot token)
     → System verifies connection with test message
  4. Step 2/3: Business profile
     → Business name, type, primary products/services
     → Optional: upload existing FAQ document
  5. Step 3/3: Policies
     → Response delay range (default: 3-15s)
     → Auto-takeover delay (default: 120s)
     → Operating hours (default: 24/7)
     → Scoring thresholds (default: hot=70, warm=50, cold=30)
  6. Tenant record created in mandala_tenants table
  7. Engine loads tenant via API call to /api/tenants/reload
  8. Redirect to cockpit Overview

Exit:     Mandala is live and responding on connected channel
```

### 4.2 Train Mandala

```
Trigger:  Owner navigates to Cockpit → Knowledge or Cockpit → Training

Steps (Knowledge):
  1. View existing knowledge entries (product info, FAQ, competitors)
  2. Add/edit/delete knowledge entries via rich text editor
  3. Each entry: title, category (product|faq|competitor|custom), content (markdown)
  4. Changes saved to DB, engine reloads knowledge on next message

Steps (Training — conversation review):
  1. View completed conversations with Mandala's performance
  2. For each message: see evaluator output (intent, score delta, action)
  3. Owner can annotate: "good response" / "bad response" / "I would have said X"
  4. Annotations feed into Mandala's style matching over time

Exit:     Knowledge base updated, Mandala operates with new context
```

### 4.3 Assign Task to Mandala

```
Trigger:  Owner wants Mandala to proactively act (not just respond)

Steps:
  1. From Cockpit → Tasks or Cockpit → Outreach
  2. Task types:
     a. "Hunt prospects" → Configure: query, location, batch size, auto-contact
     b. "Follow up cold leads" → Select leads, compose template
     c. "Re-engage dormant conversations" → Select conversations, set approach
  3. Owner reviews task parameters
  4. Owner clicks "Jalankan" (Run)
  5. Task queued in mandala-engine via BullMQ
  6. Progress visible in Cockpit → Tasks with real-time status

Exit:     Task executing, results flowing into respective sections
```

### 4.4 Review Mandala Actions

```
Trigger:  Owner wants to audit what Mandala has been doing

Steps:
  1. Cockpit → Analytics/Review
  2. Dashboard: conversations handled, conversion rate, avg score, handoff count
  3. Drill into individual conversations:
     → Full message thread with sender labels
     → Evaluator annotations per message (intent, buying signal, action taken)
     → Lead score progression chart
     → Handoff events timeline
  4. Flag problematic conversations for retraining
  5. View evaluator accuracy trends over time

Exit:     Owner has clear picture of Mandala's performance
```

### 4.5 Manage Outreach and Conversations

```
Trigger:  Active conversations need human attention, or outreach campaign results

Steps (Live Conversations):
  1. Cockpit → Conversations
  2. Filter: active | waiting | closed, by phase, by handler, by temperature
  3. Real-time message thread view
  4. Owner can:
     → Takeover (sends via owner's identity)
     → Release back to Mandala
     → Flag for follow-up
     → Close conversation
  5. Handoff notifications when Mandala flags owner

Steps (Outreach):
  1. Cockpit → Outreach/Leads
  2. View hunter prospects with qualification data
  3. Filter by: status, pain score, priority, business type
  4. Approve/reject prospects for cold outreach
  5. Monitor cold message responses
  6. Convert responded prospects to active conversations

Exit:     Conversations managed, pipeline progressing
```

---

## 5. Cockpit Information Architecture

### 5.1 Structure

The Mandala cockpit replaces the single `/mandala` page with a sectioned interface accessible via nested navigation.

```
/mandala                    → Cockpit shell (layout with sub-navigation)
/mandala/overview           → Overview (default landing)
/mandala/conversations      → Live conversation management
/mandala/conversations/[id] → Single conversation thread + evaluator view
/mandala/tasks              → Mandala task queue and history
/mandala/training           → Conversation review + annotation
/mandala/knowledge          → Knowledge base CRUD
/mandala/policies           → Configuration (handoff, scoring, timing, channels)
/mandala/outreach           → Hunter prospects + cold outreach campaigns
/mandala/analytics          → Performance metrics + evaluator trends
```

### 5.2 Section Definitions

#### Overview (`/mandala/overview`)

**Purpose**: At-a-glance operational status of Mandala for this tenant.

**Content**:
- Status indicator: Mandala online/offline, last active timestamp
- Today's stats: conversations handled, leads scored, handoffs, conversion rate
- Active conversations requiring attention (flagged or high-temperature)
- Recent hunter discoveries (last 24h)
- Quick actions: trigger hunter run, view flagged conversations

**Data sources**:
- `GET /api/mandala/stats` (existing, needs tenant_id param)
- `mandala_conversations` where status = 'active'
- `mandala_hunter_prospects` where created_at > 24h ago

#### Conversations (`/mandala/conversations`)

**Purpose**: Real-time conversation management with takeover/release controls.

**Content**:
- Conversation list with filters (status, phase, handler, temperature)
- Each row: customer name, phase badge, temperature color, handler badge, last message preview, timestamp
- Click to open full thread view
- Thread view: message bubbles with sender labels, evaluator sidebar, lead score chart, handoff timeline
- Actions: takeover, release, close, flag

**Data sources**:
- `GET /api/mandala/conversations` (existing)
- `GET /api/mandala/conversations/[id]` (new — full thread with evaluator data)
- `POST /api/mandala/conversations` for takeover/release (existing)

#### Tasks (`/mandala/tasks`)

**Purpose**: View and manage proactive tasks assigned to Mandala.

**Content**:
- Task list: type, status (queued/running/completed/failed), created, progress
- Task types: hunter run, follow-up campaign, re-engagement
- Create new task form
- Task detail: parameters, results, errors

**Data sources**:
- New table `mandala_tasks` (see Data Model section)
- `POST /api/mandala/hunter/run` (existing, for hunter tasks)

#### Training (`/mandala/training`)

**Purpose**: Review Mandala's conversation performance and provide feedback.

**Content**:
- List of completed conversations sorted by evaluator confidence (low confidence first)
- Per-conversation view: full thread with evaluator annotations inline
- Per-message annotation: thumbs up/down, "I would have said..." text input
- Aggregate stats: accuracy trends, common misclassifications
- Export training data

**Data sources**:
- `mandala_conversations` where status = 'closed'
- `mandala_evaluator_log` joined with `mandala_messages`
- New table `mandala_training_annotations` (see Data Model section)

#### Knowledge (`/mandala/knowledge`)

**Purpose**: Manage the information Mandala uses to answer questions and sell.

**Content**:
- Knowledge entries organized by category: Products, FAQ, Competitors, Custom
- CRUD interface: title, category, content (markdown editor)
- Preview: see how Mandala would incorporate this knowledge in a response
- Import: upload markdown files or paste text

**Data sources**:
- New table `mandala_knowledge` (see Data Model section)
- Replaces file-based `mandala/knowledge/*.md` for user tenants
- Internal tenant (`mandala`) can continue using file-based knowledge during migration

#### Policies (`/mandala/policies`)

**Purpose**: Configure Mandala's behavior rules and operational parameters.

**Content**:
- **Channels**: Connected channels, webhook URLs, connection status
- **Handoff**: Auto-takeover delay, typing indicator cancel, flag response timeout
- **Response timing**: Min/max delay, long delay chance
- **Scoring**: Hot/warm/cold thresholds
- **Operating hours**: Active hours per day, timezone
- **AI models**: Conversation model, classifier model, temperature setting
- **Team**: Invite operators/admins (Phase 2)

**Data sources**:
- New table `mandala_tenants` (migrated from YAML, see Data Model section)
- Replaces `tenants/mandala.yml` for user tenants

#### Outreach / Leads (`/mandala/outreach`)

**Purpose**: Manage the prospect pipeline from discovery to first conversation.

**Content**:
- Hunter prospect list with filters (status, priority, pain score, business type)
- Prospect detail: business info, Google Maps data, pain classification, enrichment data
- Actions: approve for contact, reject, mark as contacted
- Campaign view: batch cold outreach with template customization
- Response tracking: which prospects replied, conversion to active conversation
- Trigger new hunter run with query + location + batch size

**Data sources**:
- `GET /api/mandala/hunter` (existing)
- `POST /api/mandala/hunter/run` (existing)
- `mandala_hunter_prospects` table
- `GET /api/mandala/leads` (existing)

#### Analytics / Review (`/mandala/analytics`)

**Purpose**: Performance metrics, trends, and operational intelligence.

**Content**:
- **Conversion funnel**: kenalan → gali_masalah → tawarkan_solusi → closing (drop-off rates)
- **Lead temperature distribution** over time (chart)
- **Handler breakdown**: % handled by Mandala vs Owner vs Admin
- **Response time metrics**: avg response time by handler
- **Evaluator performance**: confidence distribution, score delta accuracy
- **Hunter ROI**: prospects discovered → contacted → responded → converted
- **Time range selector**: 7d, 30d, 90d, custom

**Data sources**:
- `GET /api/mandala/stats` (existing, needs time range)
- Aggregations from `mandala_conversations`, `mandala_lead_scores`, `mandala_evaluator_log`, `mandala_hunter_prospects`
- New endpoint: `GET /api/mandala/analytics` with time range + metric type params

### 5.3 Cockpit Layout

```
┌──────────────────────────────────────────────────────┐
│ JadiSatu Sidebar  │  Cockpit Sub-Nav  │  Content     │
│                   │                   │              │
│ ...               │  Overview         │  [Selected   │
│ Mandala AI ←──────│  Conversations    │   Section    │
│   Mandala         │  Tasks            │   Content]   │
│ ...               │  Training         │              │
│                   │  Knowledge        │              │
│                   │  Policies         │              │
│                   │  Outreach         │              │
│                   │  Analytics        │              │
└──────────────────────────────────────────────────────┘
```

Implementation: `/mandala` gets a layout.tsx with horizontal tab bar or left sub-nav. The JadiSatu sidebar entry stays as a single "Mandala" item — the cockpit sub-nav handles section switching.

### 5.4 Main Dashboard vs Cockpit

| Content | Main Dashboard (`/`) | Mandala Cockpit (`/mandala/*`) |
|---------|---------------------|-------------------------------|
| Mandala status | Widget: online/offline, conversations today, flags | Full operational view |
| Conversations | None (different domain) | Full conversation management |
| Lead pipeline | None | Full pipeline with filters |
| Hunter prospects | None | Full prospect management |
| Training | None | Conversation review + annotation |
| Knowledge | None | Full CRUD |
| Policies | None | Full configuration |
| Analytics | None | Detailed metrics |
| Tasks (JadiSatu) | Full task management | None (different domain) |
| Projects | Full project management | None |
| Creative | None (in Creative Studio) | None |

**Dashboard widget for Mandala** (new component):
```
┌─────────────────────────────────┐
│ Mandala AI          ● Online    │
│                                 │
│ 12 conversations today          │
│ 3 need attention  [View →]      │
│ 68% avg lead score              │
│ 2 new prospects discovered      │
└─────────────────────────────────┘
```

This widget lives on the main dashboard and links into the cockpit for details.

---

## 6. Data Model Changes

### 6.1 New Tables

#### `mandala_tenants`
Replaces file-based `tenants/*.yml`. Holds per-tenant configuration.

```sql
CREATE TABLE IF NOT EXISTS mandala_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_slug text NOT NULL UNIQUE,          -- e.g., 'irfan-jadisatu'
  name text NOT NULL,                         -- Display name
  type text NOT NULL DEFAULT 'client' CHECK (type IN ('internal', 'client')),
  active boolean NOT NULL DEFAULT false,

  -- Business info
  business_name text,
  business_type text,

  -- Channel config (jsonb for flexibility)
  channels jsonb NOT NULL DEFAULT '[]',
  -- e.g., [{"type":"whatsapp","provider":"fonnte","config":{...},"active":true}]

  -- AI config
  conversation_model text NOT NULL DEFAULT 'gemini-2.5-pro',
  classifier_model text NOT NULL DEFAULT 'gemini-2.0-flash',
  ai_temperature numeric NOT NULL DEFAULT 0.4,
  ai_max_tokens int NOT NULL DEFAULT 1024,

  -- Routing
  owner_numbers text[] NOT NULL DEFAULT '{}',
  admin_numbers text[] NOT NULL DEFAULT '{}',
  default_mode text NOT NULL DEFAULT 'sales-shadow' CHECK (default_mode IN ('ceo-assistant', 'sales-shadow')),

  -- Handoff config
  auto_takeover_delay_seconds int NOT NULL DEFAULT 120,
  typing_indicator_cancel boolean NOT NULL DEFAULT true,
  flag_response_timeout_seconds int NOT NULL DEFAULT 300,
  response_delay_min_seconds int NOT NULL DEFAULT 3,
  response_delay_max_seconds int NOT NULL DEFAULT 15,
  response_delay_long_chance int NOT NULL DEFAULT 15,

  -- Scoring
  hot_threshold int NOT NULL DEFAULT 70,
  warm_threshold int NOT NULL DEFAULT 50,
  cold_threshold int NOT NULL DEFAULT 30,

  -- Cron config (jsonb)
  cron_config jsonb NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: users can only see/edit their own tenants
ALTER TABLE mandala_tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tenants" ON mandala_tenants
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

#### `mandala_knowledge`
DB-backed knowledge base replacing file-based `mandala/knowledge/*.md`.

```sql
CREATE TABLE IF NOT EXISTS mandala_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES mandala_tenants(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('product', 'faq', 'competitor', 'custom')),
  title text NOT NULL,
  content text NOT NULL,                     -- Markdown
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mandala_knowledge ENABLE ROW LEVEL SECURITY;
-- RLS via tenant ownership
CREATE POLICY "Tenant owners manage knowledge" ON mandala_knowledge
  USING (tenant_id IN (SELECT id FROM mandala_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM mandala_tenants WHERE user_id = auth.uid()));
```

#### `mandala_tasks`
Tracks proactive tasks assigned to Mandala.

```sql
CREATE TABLE IF NOT EXISTS mandala_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES mandala_tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('hunter_run', 'followup_campaign', 'reengagement', 'custom')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  params jsonb NOT NULL DEFAULT '{}',        -- Task-specific parameters
  result jsonb,                               -- Task output
  error text,                                 -- Error message if failed
  progress int NOT NULL DEFAULT 0,            -- 0-100
  created_by uuid NOT NULL REFERENCES auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mandala_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant owners manage tasks" ON mandala_tasks
  USING (tenant_id IN (SELECT id FROM mandala_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM mandala_tenants WHERE user_id = auth.uid()));
```

#### `mandala_training_annotations`
Owner feedback on Mandala's conversation performance.

```sql
CREATE TABLE IF NOT EXISTS mandala_training_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES mandala_tenants(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES mandala_messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES mandala_conversations(id) ON DELETE CASCADE,
  rating text CHECK (rating IN ('good', 'bad', 'neutral')),
  suggested_response text,                    -- "I would have said..."
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mandala_training_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant owners manage annotations" ON mandala_training_annotations
  USING (tenant_id IN (SELECT id FROM mandala_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM mandala_tenants WHERE user_id = auth.uid()));
```

#### `mandala_team_members` (Phase 2)
Role assignments for multi-user access.

```sql
CREATE TABLE IF NOT EXISTS mandala_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES mandala_tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL CHECK (role IN ('owner', 'operator', 'admin')),
  invited_by uuid REFERENCES auth.users(id),
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
```

### 6.2 Schema Changes to Existing Tables

The existing 7 `mandala_*` tables reference `tenant_id` as a text field. For multi-tenancy:

1. `mandala_conversations.tenant_id` — Currently text, should become uuid FK to `mandala_tenants.id`
2. Same for all other tables that have `tenant_id`

**Migration strategy**: Add `mandala_tenants` first, create a row for the existing 'mandala' tenant, then migrate `tenant_id` columns. This is backwards-compatible — engine can look up tenant by slug or id.

---

## 7. API Contracts

### 7.1 Existing API Changes

All existing routes under `/api/mandala/*` need:
1. Replace `isMandalaOwner()` with role-based auth (`owner`, `operator`, or `admin` for the tenant)
2. Accept `tenant_id` query param (or derive from authenticated user's active tenant)
3. Return tenant-scoped data only

### 7.2 New API Routes

#### Tenant Management

```
POST   /api/mandala/tenants              — Create tenant (activation)
GET    /api/mandala/tenants              — List user's tenants
GET    /api/mandala/tenants/[id]         — Get tenant config
PATCH  /api/mandala/tenants/[id]         — Update tenant config (policies)
DELETE /api/mandala/tenants/[id]         — Deactivate tenant
```

#### Knowledge Base

```
GET    /api/mandala/knowledge            — List knowledge entries (filter by category)
POST   /api/mandala/knowledge            — Create entry
PATCH  /api/mandala/knowledge/[id]       — Update entry
DELETE /api/mandala/knowledge/[id]       — Delete entry
```

#### Tasks

```
GET    /api/mandala/tasks                — List tasks (filter by status, type)
POST   /api/mandala/tasks                — Create task
GET    /api/mandala/tasks/[id]           — Get task detail with progress
POST   /api/mandala/tasks/[id]/cancel    — Cancel running task
```

#### Training

```
GET    /api/mandala/training/conversations  — List conversations for review
GET    /api/mandala/training/conversations/[id]  — Full thread with evaluator data
POST   /api/mandala/training/annotations   — Save annotation
GET    /api/mandala/training/stats          — Annotation aggregates
```

#### Analytics

```
GET    /api/mandala/analytics              — Metrics with time range
       ?range=7d|30d|90d|custom
       &from=2026-01-01&to=2026-03-27
       &metrics=funnel,temperature,handlers,response_time,evaluator,hunter
```

#### Conversation Detail (enhancement)

```
GET    /api/mandala/conversations/[id]     — Full thread with messages, evaluator logs, memory, score history
```

### 7.3 Engine API Changes

The `mandala-engine` exposes its own API on port 3100. Changes needed:

```
POST   /api/tenants/reload               — Hot-reload tenant config from DB (new)
POST   /api/tenants/reload/[id]          — Reload specific tenant (existing, needs DB source)
GET    /api/knowledge/[tenant_id]        — Get knowledge for context assembly (new, reads from DB)
```

The `ContextAssembler` (`mandala-engine/src/ai/context-assembler.ts`) currently reads from filesystem. It needs an adapter to read from `mandala_knowledge` table for DB-backed tenants while keeping file-based reading for the internal tenant during migration.

---

## 8. Page/Module Boundaries

### 8.1 File Structure (Proposed)

```
nextjs-app/src/app/mandala/
├── layout.tsx                          # Cockpit shell with sub-nav
├── page.tsx                            # Redirects to /mandala/overview
├── overview/page.tsx                   # Overview section
├── conversations/
│   ├── page.tsx                        # Conversation list
│   └── [id]/page.tsx                   # Single conversation thread
├── tasks/page.tsx                      # Task queue
├── training/
│   ├── page.tsx                        # Conversation review list
│   └── [id]/page.tsx                   # Annotate specific conversation
├── knowledge/page.tsx                  # Knowledge base CRUD
├── policies/page.tsx                   # Tenant configuration
├── outreach/page.tsx                   # Hunter prospects + campaigns
├── analytics/page.tsx                  # Metrics dashboard
└── activate/page.tsx                   # Activation wizard (shown when no tenant)

nextjs-app/src/components/mandala/
├── CockpitNav.tsx                      # Sub-navigation tabs/sidebar
├── ConversationThread.tsx              # Message thread component
├── EvaluatorSidebar.tsx                # Evaluator annotations panel
├── LeadScoreChart.tsx                  # Score progression chart
├── ProspectCard.tsx                    # Hunter prospect card
├── KnowledgeEditor.tsx                 # Markdown knowledge editor
├── PolicyForm.tsx                      # Policy configuration form
├── TaskCard.tsx                        # Task status card
├── MandalaWidget.tsx                   # Main dashboard widget
└── ActivationWizard.tsx                # Multi-step activation flow

nextjs-app/src/lib/
├── mandala-auth.ts                     # Updated: role-based auth (replaces owner-only)
└── mandala-client.ts                   # NEW: client-side API helpers for mandala routes
```

### 8.2 Component Responsibility Matrix

| Component | Server/Client | Data Fetching | Writes |
|-----------|--------------|---------------|--------|
| layout.tsx | Server | Verify tenant exists | No |
| overview/page.tsx | Client | Stats, active convos, recent prospects | No |
| conversations/page.tsx | Client | Conversation list with filters | Takeover/release |
| conversations/[id]/page.tsx | Client | Full thread + evaluator + memory | Takeover/release, close |
| tasks/page.tsx | Client | Task list | Create task, cancel task |
| training/page.tsx | Client | Closed conversations | No |
| training/[id]/page.tsx | Client | Thread + evaluator data | Save annotations |
| knowledge/page.tsx | Client | Knowledge entries | CRUD entries |
| policies/page.tsx | Client | Tenant config | Update config |
| outreach/page.tsx | Client | Prospects, leads | Approve/reject, trigger hunter |
| analytics/page.tsx | Client | Aggregated metrics | No |
| activate/page.tsx | Client | None | Create tenant |
| MandalaWidget.tsx | Client | Summary stats | No |

---

## 9. Migration Path

### Phase A — Foundation (No Breaking Changes)

1. **Create `mandala_tenants` table** with migration SQL
2. **Seed existing tenant**: Insert row for 'mandala' tenant from `tenants/mandala.yml` data
3. **Create new tables**: `mandala_knowledge`, `mandala_tasks`, `mandala_training_annotations`
4. **Seed knowledge**: Migrate `mandala/knowledge/*.md` content into `mandala_knowledge` rows
5. **Add `mandala-client.ts`** helper library
6. **Update `mandala-auth.ts`**: Add role-based auth functions alongside existing `isMandalaOwner()`

**Existing system continues working unchanged.**

### Phase B — Cockpit UI

1. **Create cockpit layout** (`/mandala/layout.tsx` with sub-nav)
2. **Refactor existing page** → split into Overview + Conversations + Outreach sections
3. **Build remaining sections**: Tasks, Training, Knowledge, Policies, Analytics
4. **Build activation wizard** for new users
5. **Add MandalaWidget** to main dashboard
6. **Update Sidebar.tsx**: Keep single "Mandala" entry, cockpit handles sub-navigation

**Existing API routes still work. New routes added alongside.**

### Phase C — Multi-Tenancy

1. **Update all `/api/mandala/*` routes** to accept tenant context
2. **Update `mandala-engine` TenantManager** to load from DB (with YAML fallback)
3. **Update `ContextAssembler`** to read knowledge from DB
4. **Migrate `tenant_id` columns** from text to uuid FK
5. **Deprecate `isMandalaOwner()`** in favor of role-based checks
6. **Remove `tenants/mandala.yml`** dependency (config now in DB)

### Phase D — Team & Polish (Phase 2)

1. **Create `mandala_team_members` table**
2. **Build team management UI** in Policies section
3. **Implement invite flow** (email invite → accept → role assignment)
4. **Role-scoped UI**: Operators see subset of cockpit sections

---

## 10. Dependencies and Risks

### 10.1 Backend Dependencies

| Dependency | Required By | Risk | Mitigation |
|------------|-------------|------|------------|
| Supabase schema migration | All new tables | Migration could fail or conflict | Idempotent SQL (IF NOT EXISTS), test on staging first |
| `mandala-engine` DB adapter | Multi-tenancy | Engine currently reads YAML | Add DB adapter with YAML fallback, phased migration |
| `ContextAssembler` refactor | Knowledge from DB | Could break existing prompts | Keep file-based path as fallback, A/B test responses |
| BullMQ / Redis | Task queue | New infrastructure dependency | Already in mandala-engine package.json, needs Redis instance |

### 10.2 Frontend Dependencies

| Dependency | Required By | Risk | Mitigation |
|------------|-------------|------|------------|
| Cockpit layout pattern | All sections | No existing nested layout in codebase | Follow Next.js App Router nested layout docs |
| Markdown editor | Knowledge section | New dependency needed | Use simple textarea with preview, upgrade later |
| Real-time updates | Conversations | 30s polling exists, not real-time | Keep polling initially, add Supabase Realtime later |
| Charts | Analytics | Recharts already in stack | Low risk — reuse existing dependency |

### 10.3 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking existing Mandala runtime during migration | High — stops customer conversations | Medium | Phase A changes nothing in runtime. Phase C has YAML fallback |
| Performance with DB-based knowledge loading | Medium — slower context assembly | Low | Cache knowledge per tenant, invalidate on write |
| Role-based auth complexity | Medium — security holes | Medium | Start with owner-only, add roles incrementally |
| Activation wizard UX complexity | Low — just delays onboarding | Medium | Start with minimal 2-step wizard, expand later |
| Multi-tenant resource isolation | High — data leak between tenants | Low | RLS on all tables, tenant_id in all queries (existing pattern) |

### 10.4 Open Questions

1. **Channel provisioning**: How does a new user connect WhatsApp? Fonnte requires API key — is this self-service or do we provision?
2. **Billing**: Is Mandala a free feature or premium? Affects activation flow.
3. **AI model costs**: Each tenant generates Gemini API calls. Who pays? Rate limiting needed?
4. **Hunter Google Maps API**: Paid API with per-request costs. Per-tenant quotas needed?
5. **Existing `mandala` internal tenant**: Does it stay as a special case forever, or fully migrate to DB?

---

## 11. Relationship: Mandala vs JadiSatu OS

```
┌─────────────────────────────────────────────────────────────────┐
│                        JadiSatu OS                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Workspace    │  │  Creative    │  │  Insights    │          │
│  │  (tasks,      │  │  (content,   │  │  (history,   │          │
│  │  projects,    │  │  narrative,  │  │  context,    │          │
│  │  calendar,    │  │  leads,      │  │  analytics)  │          │
│  │  focus, crm)  │  │  agents)     │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────┬───────┴──────────┬───────┘                  │
│                    │                  │                           │
│              Shared Supabase    Shared Auth                      │
│                    │                  │                           │
│         ┌──────────┴──────────────────┴───────┐                  │
│         │           Mandala Cockpit           │                  │
│         │  (conversations, leads, knowledge,  │                  │
│         │   training, policies, outreach,     │                  │
│         │   analytics, tasks)                 │                  │
│         └──────────────┬──────────────────────┘                  │
│                        │                                         │
│                        ▼                                         │
│              Mandala Engine (runtime)                            │
│              WhatsApp ←→ AI ←→ Supabase                         │
└─────────────────────────────────────────────────────────────────┘
```

**Integration points**:
- Mandala's leads can become CRM contacts (via `/crm`)
- Mandala's conversations can generate tasks (via `/tasks`)
- Mandala's prospect data feeds into Content Studio ideas
- Main dashboard shows Mandala status widget
- Shared auth — same user session, same Supabase client

**Boundaries**:
- Mandala cockpit is self-contained — does not depend on JadiSatu Workspace features
- JadiSatu Workspace does not depend on Mandala — it works without Mandala activated
- Cross-linking is optional — a lead in Mandala can link to a CRM contact, but doesn't have to

---

## 12. Acceptance Checklist

- [x] Product model is explicit (Section 3)
- [x] Mandala is framed as multi-tenant business operator (Section 3.1, 3.2)
- [x] Roles defined: owner, operator, admin, Mandala runtime (Section 3.3)
- [x] User journeys mapped: activate, train, assign task, review, manage outreach (Section 4)
- [x] Cockpit sections clearly defined with content and data sources (Section 5)
- [x] Main dashboard vs cockpit boundary defined (Section 5.4)
- [x] Data model changes specified with SQL (Section 6)
- [x] API contracts defined for all new and changed routes (Section 7)
- [x] Page/module boundaries with file structure (Section 8)
- [x] Migration path from current to proposed (Section 9)
- [x] Dependencies and risks documented (Section 10)
- [x] Relationship to rest of JadiSatu OS defined (Section 11)
- [x] Implementation teams can proceed without reinterpreting the product
