-- ============================================================
-- MANDALA TASKS TABLE
-- File: sql/mandala-tasks.sql
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS mandala_tasks (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               text NOT NULL DEFAULT 'mandala',
  type                    text NOT NULL
                            CHECK (type IN ('outreach','follow_up','rescue','inbound_response','qualification')),
  objective               text NOT NULL,
  target                  jsonb NOT NULL DEFAULT '{}',
  context                 text DEFAULT '',
  constraints             jsonb DEFAULT '{}',
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','in_progress','awaiting_review','approved','executed','failed','cancelled')),
  approval_mode           text NOT NULL DEFAULT 'draft_only'
                            CHECK (approval_mode IN ('draft_only','semi_auto','fully_auto')),
  drafts                  jsonb DEFAULT '[]',
  log                     jsonb DEFAULT '[]',
  result_conversation_id  uuid,
  created_by              text NOT NULL DEFAULT 'cockpit',
  executed_at             timestamptz,
  error                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mt_tenant_status ON mandala_tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_mt_created ON mandala_tasks(created_at DESC);

ALTER TABLE mandala_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_mt" ON mandala_tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_mandala_tasks
  BEFORE UPDATE ON mandala_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
