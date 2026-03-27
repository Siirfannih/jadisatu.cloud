-- ============================================================
-- Mandala Training, Policy & Review Pipeline
-- Issue #21 — Training, Policy, and Review Pipeline
-- ============================================================
-- Tables:
--   mandala_knowledge        — DB-backed knowledge entries (products, FAQ, competitors, custom)
--   mandala_policies         — Behavioral policies with candidate→active lifecycle
--   mandala_training_annotations — Conversation message review annotations
-- ============================================================

-- 1. Knowledge Base (replaces filesystem mandala/knowledge/*.md)
CREATE TABLE IF NOT EXISTS mandala_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'mandala',
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('product', 'faq', 'competitor', 'process', 'general', 'custom')),
  active boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,
  tags text[] DEFAULT '{}',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mandala_knowledge_tenant_active
  ON mandala_knowledge (tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_mandala_knowledge_category
  ON mandala_knowledge (tenant_id, category);

-- 2. Policies (behavioral rules with lifecycle: candidate → active → archived)
CREATE TABLE IF NOT EXISTS mandala_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'mandala',
  title text NOT NULL,
  description text,
  -- The actual policy content injected into prompts
  rules_prompt text NOT NULL,
  -- Lifecycle: candidate (pending review) → active (in use) → archived (disabled)
  status text NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'active', 'archived')),
  -- Source: how this policy was created
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'correction', 'briefing', 'auto')),
  -- Optional: link back to the annotation that generated this policy
  source_annotation_id uuid,
  -- Structured policy flags (optional, for common toggles)
  flags jsonb DEFAULT '{}',
  priority int NOT NULL DEFAULT 0,
  created_by uuid,
  promoted_by uuid,
  promoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mandala_policies_tenant_status
  ON mandala_policies (tenant_id, status);

-- 3. Training Annotations (conversation review + corrections)
CREATE TABLE IF NOT EXISTS mandala_training_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'mandala',
  conversation_id uuid NOT NULL,
  message_id uuid,
  -- Rating of Mandala's response
  rating text NOT NULL DEFAULT 'neutral'
    CHECK (rating IN ('good', 'bad', 'neutral')),
  -- What the user would have said instead (correction)
  suggested_response text,
  -- Free-form notes
  notes text,
  -- Action taken: none, knowledge_added, policy_created, correction_applied
  action_taken text NOT NULL DEFAULT 'none'
    CHECK (action_taken IN ('none', 'knowledge_added', 'policy_created', 'correction_applied')),
  -- If a policy was created from this annotation
  resulting_policy_id uuid REFERENCES mandala_policies(id),
  -- If knowledge was added from this annotation
  resulting_knowledge_id uuid REFERENCES mandala_knowledge(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mandala_training_annotations_conversation
  ON mandala_training_annotations (conversation_id);
CREATE INDEX IF NOT EXISTS idx_mandala_training_annotations_tenant
  ON mandala_training_annotations (tenant_id, created_at DESC);

-- RLS policies
ALTER TABLE mandala_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE mandala_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mandala_training_annotations ENABLE ROW LEVEL SECURITY;

-- Service role gets full access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mandala_knowledge_service' AND tablename = 'mandala_knowledge') THEN
    CREATE POLICY mandala_knowledge_service ON mandala_knowledge FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mandala_policies_service' AND tablename = 'mandala_policies') THEN
    CREATE POLICY mandala_policies_service ON mandala_policies FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mandala_training_annotations_service' AND tablename = 'mandala_training_annotations') THEN
    CREATE POLICY mandala_training_annotations_service ON mandala_training_annotations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Authenticated users get read access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mandala_knowledge_read' AND tablename = 'mandala_knowledge') THEN
    CREATE POLICY mandala_knowledge_read ON mandala_knowledge FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mandala_policies_read' AND tablename = 'mandala_policies') THEN
    CREATE POLICY mandala_policies_read ON mandala_policies FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mandala_training_annotations_read' AND tablename = 'mandala_training_annotations') THEN
    CREATE POLICY mandala_training_annotations_read ON mandala_training_annotations FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at
DROP TRIGGER IF EXISTS mandala_knowledge_updated_at ON mandala_knowledge;
CREATE TRIGGER mandala_knowledge_updated_at
  BEFORE UPDATE ON mandala_knowledge
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS mandala_policies_updated_at ON mandala_policies;
CREATE TRIGGER mandala_policies_updated_at
  BEFORE UPDATE ON mandala_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
