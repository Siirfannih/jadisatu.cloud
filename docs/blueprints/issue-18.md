# Issue #18 — Tenancy & Backend Architecture: Multi-Tenant Mandala

> **Status**: Draft
> **Author**: Jadisatu Worker Agent (Architecture)
> **Date**: 2026-03-27
> **Depends on**: Issue #17 (Product & IA Blueprint), Mandala Engine (running), Supabase schema (deployed)

---

## 1. Executive Summary

Mandala currently operates as a single-tenant system hardcoded to its internal instance. The tenant identity (`mandala`) is baked into YAML config files, database defaults, and runtime singletons. This blueprint defines the data model, API boundaries, migration strategy, and isolation guarantees required to turn Mandala into a **per-tenant product feature** — where any JadiSatu user can activate their own Mandala instance with its own identity, knowledge, policies, channels, and conversation state.

### Design Principles

1. **Extend, don't replace** — The existing `mandala-engine/` runtime, state machine, evaluator pipeline, and hunter system remain intact. Multi-tenancy is layered on top.
2. **Database as source of truth** — Tenant config moves from filesystem YAML to Supabase tables. The engine reads from DB at runtime.
3. **Strict isolation** — Tenant A's conversations, memory, knowledge, and analytics are never visible to Tenant B. Enforced at DB (RLS), API, and runtime levels.
4. **Internal tenant preserved** — The existing `mandala` tenant becomes `tenant_id = 'mandala'` in the new schema, with `type = 'internal'`. Zero data migration needed for existing rows.

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| Tenant entity model (8 domain tables) | UI implementation (see Issue #17) |
| Schema proposal + migration SQL | Billing / subscription system |
| API contract between Next.js and mandala-engine | WhatsApp Business API provisioning |
| Runtime boundary definition | Horizontal scaling of mandala-engine |
| Auth and ownership model | Rate limiting / abuse prevention |
| Migration from current single-tenant setup | Tenant onboarding wizard UI |

---

## 2. Current State Analysis

### 2.1 Tenant Configuration — Filesystem-Based

**Source of truth**: `tenants/mandala.yml` (73 lines)
**Loader**: `mandala-engine/src/tenants/manager.ts` — `TenantManager` class

The current system loads tenant config from YAML files on disk at startup:

```
TenantManager.loadAll()
  → reads tenants/*.yml
  → filters active configs
  → stores in Map<string, TenantConfig>
```

**Key limitation**: Adding a new tenant requires deploying a new YAML file to the server and restarting the engine. There is no runtime tenant creation, no UI for config, and no DB persistence.

**Type definition** (`mandala-engine/src/types/shared.ts:11-29`):
```typescript
interface TenantConfig {
  id: string;
  name: string;
  type: TenantType;       // 'internal' | 'client'
  active: boolean;
  owner?: { name, whatsapp, timezone, github? };
  channels: ChannelConfig[];
  ai: AIConfig;
  routing: RoutingConfig;
  handoff: HandoffConfig;
  scoring?: ScoringConfig;
  knowledge: string[];     // file paths on disk
  cron?: Record<string, string>;
}
```

### 2.2 Database Schema — Already Tenant-Aware (Partially)

All 7 existing Mandala tables (`sql/mandala-schema.sql`) already have a `tenant_id` column:

| Table | tenant_id | Default | Notes |
|-------|-----------|---------|-------|
| `mandala_conversations` | `text NOT NULL` | `'mandala'` | Indexed on `(tenant_id, status)` |
| `mandala_messages` | `text NOT NULL` | `'mandala'` | Indexed on `(tenant_id, created_at)` |
| `mandala_lead_scores` | — | — | No tenant_id (linked via conversation FK) |
| `mandala_handoff_events` | — | — | No tenant_id (linked via conversation FK) |
| `mandala_customer_memory` | — | — | No tenant_id (linked via conversation FK) |
| `mandala_evaluator_log` | — | — | No tenant_id (linked via conversation FK) |
| `mandala_hunter_prospects` | — | — | No tenant_id (queries use it in `api.ts:125` but column doesn't exist in schema) |

**Key finding**: `mandala_hunter_prospects` is queried with `.eq('tenant_id', tenant)` in `mandala-engine/src/routes/api.ts:125` but the column is **not defined** in the schema. This is a latent bug — the query silently returns empty results or is ignored by Supabase.

### 2.3 Knowledge & Identity — Filesystem-Based

**Location**: `mandala/` directory (identity, rules, modes, skills, knowledge)
**Loader**: `mandala-engine/src/ai/context-assembler.ts` — reads markdown files from disk, caches in memory.

```
ContextAssembler.assemble()
  → loadFile('core/identity.md')      // WHO the agent is
  → loadFile('core/rules.md')         // 42 behavioral rules
  → loadFile('modes/sales-shadow.md') // Mode-specific instructions
  → loadSkills(mode, conversation)    // Phase-appropriate skills
  → loadKnowledge(tenant.knowledge)   // Product knowledge, FAQ, competitors
```

**Key limitation**: Knowledge paths are hardcoded strings in YAML. Each tenant would need its own directory tree on the filesystem. This doesn't scale.

### 2.4 Auth & Ownership — Single-Owner Model

**File**: `nextjs-app/src/lib/mandala-auth.ts` (9 lines)

```typescript
export function isMandalaOwner(user: User): boolean {
  if (!OWNER_EMAIL) return true;
  return user.email === OWNER_EMAIL;
}
```

All 5 Mandala API routes in Next.js (`/api/mandala/stats`, `/conversations`, `/leads`, `/hunter`, `/hunter/run`) gate on this single owner check. There is no concept of tenant membership, roles, or delegated access.

### 2.5 Runtime — Singletons Everywhere

The engine uses singleton pattern extensively (`mandala-engine/src/channels/router.ts:37`, `ai/context-assembler.ts:16`, etc.). This works for single-tenant because there's one shared state. For multi-tenant, these singletons need to be **tenant-aware** but can remain singletons — they just dispatch based on `tenant_id`.

The critical path for a message is:

```
Webhook → MessageRouter.handleIncoming()
  → TenantManager.getByChannel(channel, sender)  // Resolves tenant
  → processMessage(tenantId, msg)
    → ConversationStore.getByCustomer(tenantId, customerNumber)
    → ShadowEvaluator.evaluate(...)
    → MemoryUpdater.updateMemory(...)
    → ContextAssembler.assemble(conversation, mode, tenant, memory)
    → AIEngine.generate(context, tenant.ai)
    → WhatsAppAdapter.send(customerNumber, content)
```

The `tenantId` already flows through the entire pipeline. Multi-tenancy is structurally possible without rewriting the runtime.

### 2.6 RLS Policies — Service Role Bypass

All Mandala tables use the same RLS pattern:
```sql
-- Service role: full access (mandala-engine uses this)
CREATE POLICY "service_full_access_mc" ON table FOR ALL TO service_role USING (true);
-- Authenticated: read-only (Next.js dashboard uses this)
CREATE POLICY "authenticated_read_mc" ON table FOR SELECT TO authenticated USING (true);
```

**Problem**: Authenticated users can read ALL tenants' data. The `authenticated_read` policy has `USING (true)` — no tenant filtering. This must change for multi-tenancy.

---

## 3. Proposed Architecture

### 3.1 Tenancy Model Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                     │
│                                                             │
│  ┌──────────┐  ┌──────────────────┐  ┌───────────────────┐ │
│  │ tenants  │──│ tenant_members   │──│ auth.users        │ │
│  └────┬─────┘  └──────────────────┘  └───────────────────┘ │
│       │                                                     │
│  ┌────┴─────────────────────────────────────────────┐       │
│  │              TENANT-SCOPED DATA                   │       │
│  │                                                   │       │
│  │  tenant_identity    tenant_knowledge              │       │
│  │  tenant_policies    tenant_channels               │       │
│  │  tenant_tasks       tenant_memory                 │       │
│  │  tenant_analytics                                 │       │
│  │                                                   │       │
│  │  mandala_conversations  mandala_messages           │       │
│  │  mandala_lead_scores    mandala_handoff_events     │       │
│  │  mandala_customer_memory  mandala_evaluator_log    │       │
│  │  mandala_hunter_prospects                          │       │
│  └───────────────────────────────────────────────────┘       │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────┴────┐  ┌──────┴──────┐  ┌───┴───────────┐
   │ Next.js │  │ mandala-    │  │  Webhooks     │
   │ App     │  │ engine      │  │  (WhatsApp/   │
   │ (:3000) │  │ (:3100)     │  │   Telegram)   │
   └─────────┘  └─────────────┘  └───────────────┘
```

### 3.2 Entity Relationship Diagram

```
tenants (1)
  ├──< tenant_members (N)      → auth.users
  ├──── tenant_identity (1)    // WHO the agent is
  ├──< tenant_knowledge (N)    // Product docs, FAQ, etc.
  ├──── tenant_policies (1)    // Rules, behavioral config
  ├──< tenant_channels (N)     // WhatsApp, Telegram connections
  ├──< tenant_tasks (N)        // Scheduled/queued work
  ├──── tenant_memory (1)      // Aggregated tenant-level memory
  ├──── tenant_analytics (1)   // Rollup stats
  │
  └──< mandala_conversations (N)
        ├──< mandala_messages (N)
        ├──── mandala_lead_scores (1)
        ├──< mandala_handoff_events (N)
        ├──── mandala_customer_memory (1)
        └──< mandala_evaluator_log (N)
```

---

## 4. Data Models

### 4.1 `tenants` — Core Tenant Record

Replaces `tenants/mandala.yml` as the source of truth for tenant configuration.

```sql
CREATE TABLE IF NOT EXISTS tenants (
  id              text PRIMARY KEY,                -- e.g. 'mandala', 'tenant_abc123'
  name            text NOT NULL,                   -- Display name
  type            text NOT NULL DEFAULT 'client'
                    CHECK (type IN ('internal', 'client')),
  active          boolean NOT NULL DEFAULT false,
  owner_user_id   uuid NOT NULL REFERENCES auth.users(id),

  -- Owner details (denormalized for engine access without auth lookup)
  owner_name      text,
  owner_whatsapp  text,
  owner_timezone  text DEFAULT 'Asia/Jakarta',

  -- AI configuration (maps to current TenantConfig.ai)
  ai_conversation_model   text NOT NULL DEFAULT 'gemini-2.5-pro',
  ai_classifier_model     text NOT NULL DEFAULT 'gemini-2.0-flash',
  ai_temperature          numeric(2,1) NOT NULL DEFAULT 0.4,
  ai_max_tokens           int NOT NULL DEFAULT 1024,

  -- Handoff configuration (maps to current TenantConfig.handoff)
  handoff_auto_takeover_seconds   int NOT NULL DEFAULT 120,
  handoff_typing_cancel           boolean NOT NULL DEFAULT true,
  handoff_flag_timeout_seconds    int NOT NULL DEFAULT 300,
  handoff_delay_min_seconds       int NOT NULL DEFAULT 3,
  handoff_delay_max_seconds       int NOT NULL DEFAULT 15,
  handoff_long_delay_chance       numeric(3,2) NOT NULL DEFAULT 0.15,

  -- Scoring thresholds (maps to current TenantConfig.scoring)
  score_hot_threshold     int NOT NULL DEFAULT 70,
  score_warm_threshold    int NOT NULL DEFAULT 50,
  score_cold_threshold    int NOT NULL DEFAULT 30,

  -- Routing
  default_mode    text NOT NULL DEFAULT 'sales-shadow'
                    CHECK (default_mode IN ('ceo-assistant', 'sales-shadow')),

  -- Metadata
  settings        jsonb NOT NULL DEFAULT '{}',     -- Extensible config
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(active) WHERE active = true;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Engine (service_role) gets full access
CREATE POLICY "service_full_tenants" ON tenants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can only see tenants they are members of
CREATE POLICY "member_read_tenants" ON tenants
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
    )
  );
```

**Migration note**: The existing `mandala` tenant gets a row with `id = 'mandala'`, `type = 'internal'`, preserving all existing foreign key relationships.

### 4.2 `tenant_members` — Membership & Roles

Maps JadiSatu users to tenants with role-based access.

```sql
CREATE TABLE IF NOT EXISTS tenant_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('owner', 'operator', 'viewer')),

  -- Routing: which numbers does this member use?
  phone_numbers   text[] DEFAULT '{}',

  -- Permissions
  can_takeover    boolean NOT NULL DEFAULT false,   -- Can take over from Mandala
  can_configure   boolean NOT NULL DEFAULT false,   -- Can edit tenant settings
  can_train       boolean NOT NULL DEFAULT false,   -- Can edit knowledge/identity

  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tm_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tm_tenant ON tenant_members(tenant_id);

ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_tm" ON tenant_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can see their own memberships
CREATE POLICY "own_memberships" ON tenant_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Owners can manage members
CREATE POLICY "owner_manage_tm" ON tenant_members
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
```

**Role definitions**:

| Role | Description | Permissions |
|------|-------------|-------------|
| `owner` | Tenant creator. Full control. | All: configure, train, takeover, view analytics, manage members |
| `operator` | Trusted team member. Can intervene in conversations. | Takeover, view conversations, view analytics |
| `viewer` | Read-only dashboard access. | View stats, conversations (no actions) |

### 4.3 `tenant_identity` — Agent Persona

Replaces `mandala/core/identity.md` and `mandala/modes/*.md` with per-tenant DB records.

```sql
CREATE TABLE IF NOT EXISTS tenant_identity (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Core identity (replaces mandala/core/identity.md)
  agent_name      text NOT NULL DEFAULT 'Mandala',
  persona         text NOT NULL DEFAULT '',         -- Free-form identity prompt
  language        text NOT NULL DEFAULT 'id',       -- Primary language code
  tone            text NOT NULL DEFAULT 'casual',   -- casual, formal, friendly

  -- Mode-specific instructions (replaces mandala/modes/*.md)
  sales_shadow_prompt     text NOT NULL DEFAULT '',  -- Sales mode behavior
  ceo_assistant_prompt    text NOT NULL DEFAULT '',  -- CEO mode behavior

  -- Anti-detection settings
  hide_ai_identity        boolean NOT NULL DEFAULT true,
  style_matching_enabled  boolean NOT NULL DEFAULT true,

  -- Version tracking for prompt engineering iteration
  version         int NOT NULL DEFAULT 1,

  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE tenant_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_ti" ON tenant_identity
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "member_read_ti" ON tenant_identity
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "trainer_write_ti" ON tenant_identity
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND (role = 'owner' OR can_train = true)
    )
  );
```

### 4.4 `tenant_knowledge` — Knowledge Base Documents

Replaces `mandala/knowledge/*.md` file-based knowledge with per-tenant DB records.

```sql
CREATE TABLE IF NOT EXISTS tenant_knowledge (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  title           text NOT NULL,                    -- e.g. "Product Catalog"
  category        text NOT NULL DEFAULT 'general'
                    CHECK (category IN ('product', 'faq', 'competitor', 'process', 'general')),
  content         text NOT NULL,                    -- Markdown content

  -- For context assembly: controls when this doc gets injected
  active          boolean NOT NULL DEFAULT true,
  priority        int NOT NULL DEFAULT 0,           -- Higher = loaded first
  max_tokens      int,                              -- Token budget for this doc

  -- Metadata
  source_url      text,                             -- Where this info came from
  last_verified   timestamptz,                      -- When was this fact-checked

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tk_tenant ON tenant_knowledge(tenant_id, active, priority DESC);

ALTER TABLE tenant_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_tk" ON tenant_knowledge
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "member_read_tk" ON tenant_knowledge
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "trainer_manage_tk" ON tenant_knowledge
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND (role = 'owner' OR can_train = true)
    )
  );
```

### 4.5 `tenant_policies` — Behavioral Rules & Constraints

Replaces `mandala/core/rules.md` (42 hardcoded rules) with per-tenant configurable policies.

```sql
CREATE TABLE IF NOT EXISTS tenant_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Core behavioral rules (free-form markdown, injected into system prompt)
  rules_prompt    text NOT NULL DEFAULT '',

  -- Structured policy flags
  allow_price_discussion    boolean NOT NULL DEFAULT true,
  allow_discount_offers     boolean NOT NULL DEFAULT false,
  max_discount_percent      int DEFAULT 0,
  allow_competitor_mention   boolean NOT NULL DEFAULT false,
  allow_meeting_scheduling   boolean NOT NULL DEFAULT true,

  -- Escalation policy
  flag_owner_on_objection   boolean NOT NULL DEFAULT true,
  flag_owner_on_price       boolean NOT NULL DEFAULT false,
  auto_close_after_days     int DEFAULT 7,          -- Auto-close inactive convos

  -- Response constraints
  max_response_length       int DEFAULT 500,        -- Characters
  min_response_delay_sec    int DEFAULT 3,
  max_messages_per_reply    int DEFAULT 3,           -- Split into max N messages

  -- Blocked topics / keywords
  blocked_topics            text[] DEFAULT '{}',
  required_disclaimers      text[] DEFAULT '{}',

  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE tenant_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_tp" ON tenant_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "member_read_tp" ON tenant_policies
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "owner_manage_tp" ON tenant_policies
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND (role = 'owner' OR can_configure = true)
    )
  );
```

### 4.6 `tenant_channels` — Communication Channels

Replaces the `channels` array in `tenants/mandala.yml`.

```sql
CREATE TABLE IF NOT EXISTS tenant_channels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  type            text NOT NULL
                    CHECK (type IN ('whatsapp', 'whatsapp_business', 'telegram', 'instagram')),
  role            text NOT NULL DEFAULT 'primary'
                    CHECK (role IN ('primary', 'secondary')),
  active          boolean NOT NULL DEFAULT false,

  -- Channel-specific config (encrypted at rest via Supabase Vault)
  number          text,                             -- Phone number for WhatsApp
  provider        text,                             -- 'fonnte', 'meta_cloud_api'
  credentials     jsonb NOT NULL DEFAULT '{}',      -- API keys (encrypted)

  -- Webhook config
  webhook_url     text,                             -- Where provider sends events
  webhook_secret  text,                             -- Verification token

  -- Status
  verified        boolean NOT NULL DEFAULT false,
  last_health_check timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, type, number)
);

CREATE INDEX IF NOT EXISTS idx_tc_tenant ON tenant_channels(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_tc_number ON tenant_channels(number) WHERE active = true;

ALTER TABLE tenant_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_tc" ON tenant_channels
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "member_read_tc" ON tenant_channels
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "owner_manage_tc" ON tenant_channels
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND (role = 'owner' OR can_configure = true)
    )
  );
```

### 4.7 `tenant_tasks` — Scheduled & Queued Work

Replaces the `cron` config in YAML and provides a general task queue for tenant-scoped work.

```sql
CREATE TABLE IF NOT EXISTS tenant_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  type            text NOT NULL
                    CHECK (type IN ('cron', 'one_shot', 'hunter_campaign', 'broadcast', 'report')),
  name            text NOT NULL,                    -- e.g. 'morning_briefing'

  -- Schedule (for cron tasks)
  cron_expression text,                             -- e.g. '0 7 * * *'
  timezone        text DEFAULT 'Asia/Jakarta',

  -- Execution
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  payload         jsonb NOT NULL DEFAULT '{}',      -- Task-specific parameters
  result          jsonb,                            -- Execution result
  error           text,

  -- Tracking
  last_run_at     timestamptz,
  next_run_at     timestamptz,
  run_count       int NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tt_tenant ON tenant_tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tt_next_run ON tenant_tasks(next_run_at) WHERE status = 'pending';

ALTER TABLE tenant_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_tt" ON tenant_tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "member_read_tt" ON tenant_tasks
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );
```

### 4.8 `tenant_memory` — Aggregated Tenant-Level State

Stores tenant-level operational memory (not per-customer — that stays in `mandala_customer_memory`).

```sql
CREATE TABLE IF NOT EXISTS tenant_memory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Current operational state
  current_focus   text,                             -- What the tenant is focused on
  active_campaigns text[] DEFAULT '{}',             -- Running hunter campaigns

  -- Aggregated learnings
  common_objections       jsonb DEFAULT '[]',       -- Learned from evaluator logs
  effective_responses     jsonb DEFAULT '[]',       -- High-scoring response patterns
  customer_segments       jsonb DEFAULT '{}',       -- Discovered segments

  -- Owner preferences (learned over time)
  owner_communication_style jsonb DEFAULT '{}',     -- Learned from owner messages
  preferred_escalation_topics text[] DEFAULT '{}',

  -- Stats snapshot (updated periodically)
  total_conversations     int DEFAULT 0,
  total_conversions       int DEFAULT 0,
  avg_lead_score          numeric(5,2) DEFAULT 0,

  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE tenant_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_tmem" ON tenant_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "member_read_tmem" ON tenant_memory
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );
```

### 4.9 `tenant_analytics` — Performance Metrics

Pre-computed analytics rollups per tenant per period.

```sql
CREATE TABLE IF NOT EXISTS tenant_analytics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  period          text NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  period_start    date NOT NULL,

  -- Conversation metrics
  conversations_started   int NOT NULL DEFAULT 0,
  conversations_closed    int NOT NULL DEFAULT 0,
  messages_sent           int NOT NULL DEFAULT 0,
  messages_received       int NOT NULL DEFAULT 0,

  -- Pipeline metrics
  leads_qualified         int NOT NULL DEFAULT 0,
  leads_converted         int NOT NULL DEFAULT 0,
  avg_lead_score          numeric(5,2) DEFAULT 0,
  avg_time_to_close_hours numeric(8,2),

  -- Handoff metrics
  mandala_takeovers       int NOT NULL DEFAULT 0,
  owner_takeovers         int NOT NULL DEFAULT 0,
  flags_raised            int NOT NULL DEFAULT 0,
  avg_response_time_sec   numeric(8,2),

  -- Hunter metrics
  prospects_discovered    int NOT NULL DEFAULT 0,
  prospects_contacted     int NOT NULL DEFAULT 0,
  prospects_responded     int NOT NULL DEFAULT 0,

  -- Phase distribution (snapshot at period end)
  phase_distribution      jsonb DEFAULT '{}',       -- { kenalan: 5, gali_masalah: 3, ... }
  temperature_distribution jsonb DEFAULT '{}',      -- { hot: 2, warm: 5, ... }

  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period, period_start)
);

CREATE INDEX IF NOT EXISTS idx_ta_tenant_period ON tenant_analytics(tenant_id, period, period_start DESC);

ALTER TABLE tenant_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_ta" ON tenant_analytics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "member_read_ta" ON tenant_analytics
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );
```

---

## 5. Existing Table Modifications

### 5.1 Add `tenant_id` to Tables Missing It

`mandala_hunter_prospects` is already queried by `tenant_id` (`mandala-engine/src/routes/api.ts:125`) but the column doesn't exist. Fix this and add the column to other tables that need direct tenant filtering.

```sql
-- Fix: Add tenant_id to hunter_prospects (already queried but missing)
ALTER TABLE mandala_hunter_prospects
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'mandala';

CREATE INDEX IF NOT EXISTS idx_mhp_tenant ON mandala_hunter_prospects(tenant_id, status);

-- Add tenant_id to tables that currently only link via conversation FK
-- This denormalization enables efficient RLS without joins
ALTER TABLE mandala_lead_scores
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'mandala';

ALTER TABLE mandala_handoff_events
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'mandala';

ALTER TABLE mandala_customer_memory
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'mandala';

ALTER TABLE mandala_evaluator_log
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'mandala';
```

### 5.2 Update RLS Policies

Replace the permissive `USING (true)` authenticated read policies with tenant-scoped policies:

```sql
-- Template for all mandala_* tables:
-- Drop old permissive policy
DROP POLICY IF EXISTS "authenticated_read_mc" ON mandala_conversations;

-- New: tenant-scoped read
CREATE POLICY "member_read_mc" ON mandala_conversations
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

-- Repeat for: mandala_messages, mandala_lead_scores, mandala_handoff_events,
--             mandala_customer_memory, mandala_evaluator_log, mandala_hunter_prospects
```

---

## 6. API Contract

### 6.1 Boundary: Next.js App ↔ mandala-engine

```
┌─────────────────────┐          ┌──────────────────────┐
│   Next.js App       │          │   mandala-engine     │
│   (port 3000)       │          │   (port 3100)        │
│                     │          │                      │
│  /api/mandala/*     │─── HTTP ─│  /api/*              │
│  (auth + tenant     │          │  (service-role,      │
│   resolution)       │          │   tenant-aware)      │
│                     │          │                      │
│  Supabase Client    │          │  /webhook/*          │
│  (anon key + RLS)   │          │  (WhatsApp/Telegram  │
│                     │          │   → tenant routing)  │
└─────────────────────┘          └──────────────────────┘
```

**Principle**: Next.js handles auth + tenant resolution. mandala-engine handles runtime logic. Neither duplicates the other's job.

### 6.2 Next.js API Routes (Tenant-Aware)

All routes require authenticated user + tenant membership. The current `isMandalaOwner()` check is replaced with tenant-aware middleware.

#### Auth Middleware Pattern

```typescript
// nextjs-app/src/lib/mandala-auth.ts (proposed replacement)

interface TenantContext {
  tenantId: string;
  userId: string;
  role: 'owner' | 'operator' | 'viewer';
  permissions: {
    canTakeover: boolean;
    canConfigure: boolean;
    canTrain: boolean;
  };
}

async function resolveTenantContext(request: Request): Promise<TenantContext | null> {
  const user = await getUser();  // from @/lib/supabase-server
  if (!user) return null;

  const tenantId = request.headers.get('x-tenant-id')
    || new URL(request.url).searchParams.get('tenant')
    || await getDefaultTenantForUser(user.id);

  if (!tenantId) return null;

  const membership = await getMembership(tenantId, user.id);
  if (!membership) return null;

  return {
    tenantId,
    userId: user.id,
    role: membership.role,
    permissions: {
      canTakeover: membership.can_takeover,
      canConfigure: membership.can_configure,
      canTrain: membership.can_train,
    },
  };
}
```

#### Route Contracts

**`GET /api/mandala/tenants`** — List user's tenants
```
Response: { tenants: [{ id, name, type, active, role }] }
Auth: authenticated user
```

**`POST /api/mandala/tenants`** — Create new tenant (activate Mandala)
```
Body: { name, owner_whatsapp?, timezone? }
Response: { tenant: { id, name, ... }, membership: { role: 'owner' } }
Auth: authenticated user
Side effect: Creates tenant + tenant_identity + tenant_policies + tenant_members(owner)
```

**`GET /api/mandala/stats?tenant=<id>`** — Tenant dashboard stats
```
Response: { stats: { total, active, by_phase, by_handler, conversion_rate, lead_temps } }
Auth: member of tenant (any role)
```

**`GET /api/mandala/conversations?tenant=<id>&status=&phase=&handler=`** — List conversations
```
Response: { conversations: [{ id, customer_number, customer_name, status, handler, phase, score, temperature, last_message_at }] }
Auth: member of tenant (any role)
```

**`POST /api/mandala/conversations/<id>/takeover`** — Owner/operator takes over
```
Response: { status: 'taken_over' }
Auth: member with can_takeover permission
Side effect: Proxies to mandala-engine POST /api/takeover/:id
```

**`POST /api/mandala/conversations/<id>/release`** — Release back to Mandala
```
Response: { status: 'mandala_handling' }
Auth: member with can_takeover permission
Side effect: Proxies to mandala-engine POST /api/let-mandala/:id
```

**`GET /api/mandala/identity?tenant=<id>`** — Get agent identity config
```
Response: { identity: { agent_name, persona, language, tone, sales_shadow_prompt, ceo_assistant_prompt, ... } }
Auth: member with can_train or owner role
```

**`PUT /api/mandala/identity?tenant=<id>`** — Update agent identity
```
Body: { agent_name?, persona?, sales_shadow_prompt?, ... }
Auth: member with can_train or owner role
```

**`GET /api/mandala/knowledge?tenant=<id>`** — List knowledge documents
```
Response: { documents: [{ id, title, category, active, priority, updated_at }] }
Auth: member with can_train or owner role
```

**`POST /api/mandala/knowledge?tenant=<id>`** — Add knowledge document
```
Body: { title, category, content, priority? }
Auth: member with can_train or owner role
```

**`PUT /api/mandala/knowledge/<id>`** — Update knowledge document
```
Body: { title?, content?, active?, priority? }
Auth: member with can_train or owner role
```

**`DELETE /api/mandala/knowledge/<id>`** — Remove knowledge document
```
Auth: member with can_train or owner role
```

**`GET /api/mandala/policies?tenant=<id>`** — Get policies
```
Response: { policies: { rules_prompt, allow_price_discussion, ... } }
Auth: owner or can_configure
```

**`PUT /api/mandala/policies?tenant=<id>`** — Update policies
```
Body: { rules_prompt?, allow_price_discussion?, ... }
Auth: owner or can_configure
```

**`GET /api/mandala/channels?tenant=<id>`** — List channels
```
Response: { channels: [{ id, type, role, active, verified, number }] }
Auth: owner or can_configure
```

**`POST /api/mandala/channels?tenant=<id>`** — Add channel
```
Body: { type, number?, provider?, credentials }
Auth: owner only
```

**`GET /api/mandala/analytics?tenant=<id>&period=weekly&from=&to=`** — Analytics
```
Response: { analytics: [{ period_start, conversations_started, leads_qualified, ... }] }
Auth: member (any role)
```

**`GET /api/mandala/hunter?tenant=<id>&status=&decision=`** — List hunter prospects
```
Response: { prospects: [...] }
Auth: member (any role)
```

**`POST /api/mandala/hunter/run?tenant=<id>`** — Trigger hunter campaign
```
Body: { query, batch_size?, auto_contact? }
Auth: owner or operator
Side effect: Proxies to mandala-engine POST /api/hunter/run with tenant
```

### 6.3 mandala-engine Internal API

The engine's existing routes (`mandala-engine/src/routes/api.ts`) already accept `tenant` as a query parameter. These routes are **internal only** — called by Next.js API routes, never exposed to users directly.

**Changes needed**:

1. **Tenant config loading**: `TenantManager` adds a `loadFromDB()` method that reads from `tenants` table instead of YAML files. Falls back to YAML for the `mandala` internal tenant during migration.

2. **Knowledge loading**: `ContextAssembler.loadKnowledge()` reads from `tenant_knowledge` table instead of filesystem. Falls back to `mandala/knowledge/*.md` for internal tenant.

3. **Policy injection**: `ContextAssembler.assemble()` reads `tenant_policies.rules_prompt` and injects it alongside (or replacing) `core/rules.md`.

4. **Identity loading**: `ContextAssembler.loadFile('core/identity.md')` replaced with a method that reads from `tenant_identity` table.

### 6.4 Webhook Tenant Resolution

Current flow (`mandala-engine/src/channels/router.ts:44-55`):

```typescript
// Current: resolves tenant by channel type + sender number
const tenant = this.tenantManager.getByChannel(msg.channel, msg.sender);
```

**Multi-tenant change**: Webhook URLs become tenant-specific:

```
POST /webhook/whatsapp/:tenantId    →  route to specific tenant
POST /webhook/telegram/:tenantId    →  route to specific tenant
```

The `tenant_channels` table maps incoming webhooks to tenants. When a new channel is provisioned, the webhook URL includes the tenant ID, so the engine knows which tenant config to load without ambiguity.

---

## 7. Runtime Boundary Notes

### 7.1 What Changes in mandala-engine

| Component | Current | Multi-Tenant Change |
|-----------|---------|-------------------|
| `TenantManager` (`tenants/manager.ts`) | Reads YAML from disk | Adds `loadFromDB()` using Supabase. YAML remains as fallback for `mandala` tenant. Cache with TTL. |
| `ContextAssembler` (`ai/context-assembler.ts`) | Reads `.md` files from `mandala/` dir | Reads from `tenant_identity`, `tenant_knowledge`, `tenant_policies` tables. File-based cache replaced with DB-backed cache per tenant. |
| `MessageRouter` (`channels/router.ts`) | `getByChannel()` returns first match | Looks up `tenant_channels` table by incoming number. Tenant-specific webhook endpoints. |
| `ConversationStore` (`memory/conversation-store.ts`) | Already filters by `tenant_id` | No change needed. Already tenant-aware. |
| `HandoffTimer` (`queue/handoff-timer.ts`) | Global singleton timer | No change. Timer keys already include conversation ID, which is tenant-scoped. |
| `HunterPipeline` (`hunter/index.ts`) | Accepts `tenant` param | Minor: ensure `tenant_id` is written to `mandala_hunter_prospects` rows. |
| `HunterScheduler` (`hunter/scheduler.ts`) | Runs for all tenants | Iterates `tenant_tasks` where `type = 'cron'` and `status = 'pending'`. Per-tenant scheduling. |

### 7.2 What Does NOT Change

- **AIEngine** (`ai/engine.ts`) — Stateless. Takes assembled context + AI config. No tenant awareness needed.
- **ShadowEvaluator** (`evaluator/shadow-evaluator.ts`) — Stateless classifier. No tenant coupling.
- **ResistanceDetector** (`evaluator/resistance-detector.ts`) — Pure function, no state.
- **MemoryUpdater** (`evaluator/memory-updater.ts`) — Already operates on `conversation_id` which is tenant-scoped.
- **PhaseController** (`state-machine/phase-controller.ts`) — Stateless phase transition logic.
- **LeadScorer** (`tools/lead-scorer.ts`) — Operates on conversation-scoped data.
- **WhatsAppAdapter** (`channels/whatsapp.ts`) — Needs channel credentials per tenant (reads from `tenant_channels`).
- **Supabase client** (`memory/supabase-client.ts`) — Singleton, service role. No change.

### 7.3 Tenant Config Resolution at Runtime

```
Incoming Message
  ↓
Webhook handler extracts tenant_id from URL path
  ↓
TenantManager.get(tenantId)
  ├── Check in-memory cache (Map<string, TenantConfig>)
  ├── If miss → query `tenants` table + join identity/policies/channels
  ├── Cache result with 5-minute TTL
  └── Return TenantConfig (same interface as today)
  ↓
ContextAssembler.assemble(conversation, mode, tenant)
  ├── Load identity from tenant_identity table (cached)
  ├── Load policies from tenant_policies table (cached)
  ├── Load knowledge from tenant_knowledge table (cached)
  └── Build prompt (same buildPrompt() logic)
```

The `TenantConfig` interface (`types/shared.ts:11-29`) is **preserved as-is**. The `TenantManager` translates DB rows into the same `TenantConfig` shape, so no downstream code changes are needed.

---

## 8. Migration Strategy

### Phase 1: Schema Migration (Non-Breaking)

1. Run `sql/phase-18-tenancy-schema.sql` — creates all 8 new tables
2. Add `tenant_id` column to existing tables missing it
3. Insert seed row: `tenants` with `id = 'mandala'`, `type = 'internal'`
4. Insert `tenant_members` row linking owner's `auth.users.id` to `mandala` tenant with `role = 'owner'`
5. Migrate `mandala/core/identity.md` content → `tenant_identity` row
6. Migrate `mandala/core/rules.md` content → `tenant_policies.rules_prompt`
7. Migrate `mandala/knowledge/*.md` → `tenant_knowledge` rows
8. Migrate channel config from YAML → `tenant_channels` rows
9. Migrate cron config from YAML → `tenant_tasks` rows

**All existing data remains untouched**. New tables are additive. `mandala_*` tables get new `tenant_id` columns with `DEFAULT 'mandala'` — existing rows automatically get the right value.

### Phase 2: Engine Dual-Mode (Read from DB, Fall Back to YAML)

1. Add `TenantManager.loadFromDB()` alongside existing `loadAll()`
2. `ContextAssembler` tries DB first, falls back to filesystem
3. Deploy and verify internal `mandala` tenant works identically
4. Monitor for regressions over 1-2 weeks

### Phase 3: Cut Over

1. Remove YAML fallback
2. Update RLS policies to tenant-scoped versions
3. Update Next.js API routes to use `resolveTenantContext()`
4. Remove `isMandalaOwner()` — replaced by tenant membership checks
5. Enable tenant creation API

### Phase 4: Multi-Tenant Activation

1. Build tenant onboarding flow (Issue #17 UI work)
2. Enable `POST /api/mandala/tenants` for self-service activation
3. Build knowledge CRUD UI
4. Build channel provisioning flow

---

## 9. Tenant Isolation Guarantees

### 9.1 Database Level

| Guarantee | Mechanism |
|-----------|-----------|
| Tenant A cannot read Tenant B's data | RLS policies on all tables: `tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())` |
| Engine has cross-tenant access | Service role bypasses RLS (required for webhook processing where user context doesn't exist) |
| Cascade deletes on tenant removal | `ON DELETE CASCADE` from `tenants.id` to all dependent tables |

### 9.2 API Level

| Guarantee | Mechanism |
|-----------|-----------|
| Authenticated access only | `getUser()` check on all Next.js API routes |
| Tenant membership required | `resolveTenantContext()` middleware verifies membership |
| Role-based permissions | `can_takeover`, `can_configure`, `can_train` flags on `tenant_members` |
| No tenant ID spoofing | Tenant ID resolved server-side from membership, not trusted from client |

### 9.3 Runtime Level

| Guarantee | Mechanism |
|-----------|-----------|
| Webhook routes are tenant-specific | `/webhook/whatsapp/:tenantId` — no cross-tenant message routing |
| Context assembly is tenant-scoped | Identity, knowledge, policies loaded per tenant from DB |
| Conversation store is tenant-filtered | All queries include `WHERE tenant_id = ?` (already implemented) |
| Hunter prospects are tenant-scoped | `tenant_id` column added, all queries filtered |

### 9.4 Data Ownership Matrix

| Data | Owner | Source of Truth | Access Pattern |
|------|-------|-----------------|----------------|
| Tenant config | Tenant owner | `tenants` table | Owner writes, engine reads |
| Agent identity | Tenant owner/trainer | `tenant_identity` table | Trainer writes, engine reads at context assembly |
| Knowledge base | Tenant owner/trainer | `tenant_knowledge` table | Trainer CRUD, engine reads at context assembly |
| Behavioral policies | Tenant owner/configurer | `tenant_policies` table | Configurer writes, engine reads at context assembly |
| Channel credentials | Tenant owner | `tenant_channels` table | Owner writes, engine reads for send/receive |
| Conversations | System-generated, tenant-scoped | `mandala_conversations` | Engine writes, dashboard reads |
| Messages | System-generated, per-conversation | `mandala_messages` | Engine writes, dashboard reads |
| Customer memory | Engine-generated, per-conversation | `mandala_customer_memory` | Engine writes/reads |
| Lead scores | Engine-generated, per-conversation | `mandala_lead_scores` | Engine writes, dashboard reads |
| Evaluator logs | Engine-generated, per-message | `mandala_evaluator_log` | Engine writes, analytics reads |
| Handoff events | Engine-generated, per-conversation | `mandala_handoff_events` | Engine writes, audit reads |
| Hunter prospects | Engine-generated, tenant-scoped | `mandala_hunter_prospects` | Engine writes, dashboard reads |
| Analytics rollups | System-generated, periodic | `tenant_analytics` | Cron job writes, dashboard reads |
| Task scheduling | Tenant owner | `tenant_tasks` | Owner configures, scheduler reads |

---

## 10. Dependencies & Risks

### Dependencies

| Dependency | Required For | Status |
|------------|-------------|--------|
| Issue #17 UI Blueprint | Cockpit UI implementation | In progress (same batch) |
| Supabase Vault | Encrypting channel credentials | Available on hosted Supabase |
| WhatsApp Business API | Multi-tenant channel provisioning | External dependency, TBD |
| Supabase RLS performance | Tenant-scoped queries with subselect | Test with realistic data volumes |

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **RLS subselect performance** — `tenant_id IN (SELECT ... FROM tenant_members)` on every query | Medium | Add materialized view or cache user→tenant mapping. Benchmark with 100+ tenants. |
| **Context assembly latency** — DB reads instead of filesystem cache | Low | Implement in-memory cache with 5-min TTL in `TenantManager`. Existing `ContextAssembler.cache` pattern already works. |
| **Webhook routing ambiguity** — Same phone number across tenants | Medium | `tenant_channels` UNIQUE constraint on `(tenant_id, type, number)`. Webhook URLs include tenant ID for unambiguous routing. |
| **Credential security** — Channel API keys in DB | High | Use Supabase Vault for encryption. Never expose credentials through API responses. Service role only reads raw credentials. |
| **Migration data loss** — Seed script for internal tenant | Low | Migration is additive-only. Existing rows get `DEFAULT 'mandala'` values. Rollback = drop new tables + columns. |
| **Engine singleton assumptions** — Some singletons may hold tenant-specific state | Medium | Audit all `getInstance()` singletons. `ContextAssembler.cache` needs to be keyed by tenant. `ConversationStore` is already tenant-aware. |

### Open Questions

1. **Tenant billing**: How is Mandala usage metered? Per conversation? Per message? Per month flat? (Deferred — not in scope for this issue.)
2. **Tenant limits**: Max concurrent conversations? Max knowledge documents? Max hunter campaigns? (Define in `tenants.settings` jsonb as extensible config.)
3. **Shared knowledge**: Should there be a "platform knowledge" layer that all tenants inherit? (e.g., general sales techniques, compliance rules.) Consider a `system` pseudo-tenant.
4. **Tenant deletion**: Soft delete (set `active = false`) or hard delete (cascade)? Recommend soft delete with 30-day retention, then hard delete via admin action.

---

## 11. Implementation Order

For the implementing agent, the recommended order is:

1. **SQL migration file** — `sql/phase-18-tenancy-schema.sql` with all 8 new tables + existing table alterations
2. **Seed script** — Populate `tenants`, `tenant_members`, `tenant_identity`, `tenant_policies`, `tenant_knowledge`, `tenant_channels`, `tenant_tasks` for the existing `mandala` internal tenant
3. **Updated RLS policies** — Replace permissive `authenticated_read` with tenant-scoped policies
4. **`mandala-auth.ts` rewrite** — Replace `isMandalaOwner()` with `resolveTenantContext()`
5. **`TenantManager.loadFromDB()`** — DB-backed tenant loading with YAML fallback
6. **`ContextAssembler` DB integration** — Read identity/knowledge/policies from DB
7. **Next.js API route updates** — Add tenant resolution to all `/api/mandala/*` routes
8. **New API routes** — Tenant CRUD, knowledge CRUD, identity CRUD, policy CRUD, channel management
9. **Webhook tenant routing** — Update webhook handlers to use `/webhook/:channel/:tenantId` pattern
10. **Analytics cron job** — Periodic rollup into `tenant_analytics`

Each step is independently deployable and testable. Steps 1-3 are pure SQL. Steps 4-6 are engine changes. Steps 7-10 are API changes.
