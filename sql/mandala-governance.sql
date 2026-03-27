-- ============================================================
-- MANDALA GOVERNANCE SCHEMA
-- File: sql/mandala-governance.sql
-- Issue #23: Safety, Governance, Permissions, and Observability
-- Run in Supabase SQL Editor (idempotent)
-- ============================================================

-- ============================================================
-- 1. MANDALA GOVERNANCE CONFIG
-- Per-tenant governance settings: autonomy level, approval modes,
-- escalation rules, safe defaults
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_governance_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL UNIQUE,

  -- Autonomy levels: 'supervised' (all actions need approval),
  -- 'semi_autonomous' (high-risk need approval), 'autonomous' (auto with logging)
  autonomy_level  text NOT NULL DEFAULT 'supervised'
                    CHECK (autonomy_level IN ('supervised', 'semi_autonomous', 'autonomous')),

  -- Which action categories require explicit approval
  -- When autonomy_level = 'supervised', all require approval
  -- When 'semi_autonomous', only actions listed here require approval
  approval_required_actions text[] NOT NULL DEFAULT '{send_cold_message,hunter_run,close_conversation,phase_advance_closing}',

  -- Escalation rules
  escalation_timeout_seconds  int NOT NULL DEFAULT 300, -- Auto-escalate if no approval in 5min
  escalation_action           text NOT NULL DEFAULT 'pause'
                                CHECK (escalation_action IN ('pause', 'flag_owner', 'auto_approve', 'reject')),

  -- Rate limits (safety guardrails)
  max_messages_per_hour       int NOT NULL DEFAULT 30,
  max_conversations_per_day   int NOT NULL DEFAULT 50,
  max_hunter_contacts_per_day int NOT NULL DEFAULT 10,

  -- Content safety
  blocked_keywords            text[] NOT NULL DEFAULT '{}',
  require_review_for_new_contacts boolean NOT NULL DEFAULT true,

  -- Takeover/release behavior
  auto_release_after_seconds  int NOT NULL DEFAULT 120,  -- Auto-release to Mandala after owner silence
  owner_can_override_pause    boolean NOT NULL DEFAULT true,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mandala_governance_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_full_access_mgc" ON mandala_governance_config
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "authenticated_read_mgc" ON mandala_governance_config
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS update_mgc_updated_at ON mandala_governance_config;
CREATE TRIGGER update_mgc_updated_at BEFORE UPDATE ON mandala_governance_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default config for existing 'mandala' tenant if not exists
INSERT INTO mandala_governance_config (tenant_id, autonomy_level)
  VALUES ('mandala', 'supervised')
  ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================
-- 2. MANDALA ROLES
-- Role-based access control per tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL,
  user_id         uuid NOT NULL,
  role            text NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('owner', 'operator', 'viewer')),
  -- owner: full control, can change governance config, approve/reject
  -- operator: can approve/reject actions, takeover conversations, view all
  -- viewer: read-only access to dashboard and logs
  granted_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mr_tenant ON mandala_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mr_user ON mandala_roles(user_id);

ALTER TABLE mandala_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_full_access_mr" ON mandala_roles
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "authenticated_read_mr" ON mandala_roles
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. MANDALA ACTION LOG
-- Comprehensive audit trail for ALL Mandala decisions and actions
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_action_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL DEFAULT 'mandala',

  -- What happened
  action_type     text NOT NULL
                    CHECK (action_type IN (
                      'message_sent',        -- Mandala sent a message to customer
                      'message_held',        -- Message blocked pending approval
                      'phase_advanced',      -- Conversation phase changed
                      'score_updated',       -- Lead score changed
                      'handoff_triggered',   -- Handler changed (owner<->mandala)
                      'hunter_run',          -- Hunter pipeline executed
                      'hunter_contact',      -- Cold message sent to prospect
                      'conversation_created',-- New conversation started
                      'conversation_closed', -- Conversation closed
                      'flag_raised',         -- Owner flagged for attention
                      'approval_requested',  -- Action queued for approval
                      'approval_resolved',   -- Approval granted/rejected
                      'escalation_triggered',-- Timeout escalation fired
                      'config_changed',      -- Governance config modified
                      'role_changed',        -- User role modified
                      'takeover',            -- Owner took over from Mandala
                      'release'              -- Owner released back to Mandala
                    )),

  -- Context
  conversation_id uuid,  -- nullable (not all actions are conversation-scoped)
  actor           text NOT NULL DEFAULT 'mandala'
                    CHECK (actor IN ('mandala', 'owner', 'operator', 'system')),
  actor_id        text, -- user_id or 'mandala-engine'

  -- What was decided and why
  summary         text NOT NULL,          -- Human-readable action summary
  decision_reason text,                   -- Why Mandala chose this action
  target          text,                   -- Contact number or entity targeted
  details         jsonb NOT NULL DEFAULT '{}', -- Full action payload

  -- Intervention tracking
  requires_review boolean NOT NULL DEFAULT false,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  review_outcome  text CHECK (review_outcome IN ('approved', 'rejected', 'noted', NULL)),

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mal_tenant_time ON mandala_action_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mal_conv ON mandala_action_log(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mal_type ON mandala_action_log(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mal_review ON mandala_action_log(requires_review, reviewed_at)
  WHERE requires_review = true;

ALTER TABLE mandala_action_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_full_access_mal" ON mandala_action_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "authenticated_read_mal" ON mandala_action_log
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4. MANDALA APPROVAL QUEUE
-- Pending actions waiting for human approval
-- State machine: pending -> approved | rejected | auto_approved | expired
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_approval_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL DEFAULT 'mandala',

  -- What needs approval
  action_type     text NOT NULL,
  conversation_id uuid,
  target          text,           -- Contact number or entity
  summary         text NOT NULL,  -- Human-readable description
  decision_reason text,           -- Why Mandala wants to do this
  payload         jsonb NOT NULL DEFAULT '{}', -- Full action data to execute if approved

  -- State machine
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved', 'expired')),
  priority        text NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('critical', 'high', 'normal', 'low')),

  -- Resolution
  resolved_by     uuid,           -- User who approved/rejected
  resolved_at     timestamptz,
  resolution_note text,

  -- Expiry
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),

  -- Linked action log entry
  action_log_id   uuid,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maq_tenant_status ON mandala_approval_queue(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maq_pending ON mandala_approval_queue(status, expires_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_maq_conv ON mandala_approval_queue(conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE mandala_approval_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_full_access_maq" ON mandala_approval_queue
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "authenticated_read_maq" ON mandala_approval_queue
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Done
-- ============================================================
SELECT 'Mandala governance schema complete — 4 tables created (governance_config, roles, action_log, approval_queue)' AS result;
