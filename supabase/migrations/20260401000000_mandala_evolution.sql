-- ============================================================
-- Mandala Evolution Migration
-- Phase 1: Dynamic Tenants
-- Phase 2: Task Subtasks
-- Phase 3: Episodic Memory
-- ============================================================

-- Ensure update_updated_at_column function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- PHASE 1: DYNAMIC TENANT CONFIGURATION
-- Allows tenants to be created via API instead of YAML files
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_tenants (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  type            text NOT NULL DEFAULT 'client'
                    CHECK (type IN ('internal', 'client')),
  active          boolean NOT NULL DEFAULT true,
  owner_name      text,
  owner_whatsapp  text,
  owner_timezone  text DEFAULT 'Asia/Makassar',
  ai_config       jsonb NOT NULL DEFAULT '{
    "conversation_model": "gemini-2.5-pro",
    "classifier_model": "gemini-2.0-flash",
    "temperature": 0.4,
    "max_tokens": 8192
  }'::jsonb,
  channel_config  jsonb NOT NULL DEFAULT '[]'::jsonb,
  routing_config  jsonb NOT NULL DEFAULT '{
    "owner_numbers": [],
    "admin_numbers": [],
    "default_mode": "sales-shadow"
  }'::jsonb,
  handoff_config  jsonb NOT NULL DEFAULT '{
    "auto_takeover_delay_seconds": 120,
    "typing_indicator_cancel": true,
    "flag_response_timeout_seconds": 300,
    "response_delay": {
      "min_seconds": 3,
      "max_seconds": 15,
      "long_delay_chance": 0.15
    }
  }'::jsonb,
  knowledge_paths text[] DEFAULT '{}',
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mt_active ON mandala_tenants(active);

ALTER TABLE mandala_tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_mt" ON mandala_tenants
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_mt" ON mandala_tenants
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS update_mt_updated_at ON mandala_tenants;
CREATE TRIGGER update_mt_updated_at BEFORE UPDATE ON mandala_tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PHASE 2: TASK DECOMPOSITION & PLANNING
-- Adds plan + subtasks columns to mandala_tasks
-- Creates dedicated mandala_subtasks table
-- ============================================================

-- Add plan and subtasks columns to existing mandala_tasks table
ALTER TABLE mandala_tasks ADD COLUMN IF NOT EXISTS plan jsonb;
ALTER TABLE mandala_tasks ADD COLUMN IF NOT EXISTS subtasks jsonb;

-- Update the status check constraint to include new statuses
-- (Drop + recreate since ALTER CONSTRAINT doesn't work in PG)
DO $$ BEGIN
  ALTER TABLE mandala_tasks DROP CONSTRAINT IF EXISTS mandala_tasks_status_check;
  ALTER TABLE mandala_tasks ADD CONSTRAINT mandala_tasks_status_check
    CHECK (status IN (
      'pending', 'analyzing', 'needs_clarification', 'planning',
      'awaiting_plan_approval', 'in_progress', 'awaiting_review',
      'approved', 'executed', 'failed', 'cancelled'
    ));
EXCEPTION WHEN OTHERS THEN
  -- Constraint may not exist or have a different name — non-fatal
  NULL;
END $$;
CREATE TABLE IF NOT EXISTS mandala_subtasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         text NOT NULL,
  tenant_id       text NOT NULL,
  order_num       int NOT NULL,
  objective       text NOT NULL,
  action          text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  result          text,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  executed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mst_task ON mandala_subtasks(task_id, order_num);
CREATE INDEX IF NOT EXISTS idx_mst_tenant ON mandala_subtasks(tenant_id);

ALTER TABLE mandala_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_mst" ON mandala_subtasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_mst" ON mandala_subtasks
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- PHASE 3: EPISODIC MEMORY
-- Stores extracted facts/events from conversations for Pinecone
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_episodes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL,
  customer_number text NOT NULL,
  conversation_id uuid REFERENCES mandala_conversations(id) ON DELETE SET NULL,
  episode_type    text NOT NULL
                    CHECK (episode_type IN (
                      'promise', 'preference', 'complaint', 'resolution',
                      'booking', 'feedback', 'request', 'fact'
                    )),
  content         text NOT NULL,
  extracted_data  jsonb DEFAULT '{}',
  embedding_id    text,
  happened_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_me_tenant_customer ON mandala_episodes(tenant_id, customer_number);
CREATE INDEX IF NOT EXISTS idx_me_type ON mandala_episodes(tenant_id, episode_type);
CREATE INDEX IF NOT EXISTS idx_me_conversation ON mandala_episodes(conversation_id);

ALTER TABLE mandala_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_me" ON mandala_episodes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_me" ON mandala_episodes
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- Done
-- ============================================================
SELECT 'Mandala Evolution migration complete — 3 tables created (tenants, subtasks, episodes)' AS result;
