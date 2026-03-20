-- ============================================================
-- MANDALA SCHEMA MIGRATION
-- File: sql/mandala-schema.sql
-- Run in Supabase SQL Editor
-- ============================================================

-- Ensure update_updated_at_column function exists (may already exist from other migrations)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- 1. MANDALA CONVERSATIONS
-- Replaces the in-memory ConversationStore Map
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL DEFAULT 'mandala',
  customer_number text NOT NULL,
  customer_name   text,
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','waiting','closed')),
  current_handler text NOT NULL DEFAULT 'unassigned'
                    CHECK (current_handler IN ('owner','admin','mandala','unassigned')),
  mode            text NOT NULL DEFAULT 'sales-shadow'
                    CHECK (mode IN ('ceo-assistant','sales-shadow')),
  lead_score      int NOT NULL DEFAULT 0,
  phase           text NOT NULL DEFAULT 'kenalan'
                    CHECK (phase IN ('kenalan','gali_masalah','tawarkan_solusi','closing','rescue')),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_owner_reply_at timestamptz,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_tenant_status ON mandala_conversations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_mc_customer ON mandala_conversations(tenant_id, customer_number, status);
CREATE INDEX IF NOT EXISTS idx_mc_last_message ON mandala_conversations(last_message_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mc_active_customer
  ON mandala_conversations(tenant_id, customer_number)
  WHERE status = 'active';

ALTER TABLE mandala_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_mc" ON mandala_conversations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_mc" ON mandala_conversations
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS update_mc_updated_at ON mandala_conversations;
CREATE TRIGGER update_mc_updated_at BEFORE UPDATE ON mandala_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. MANDALA MESSAGES
-- Chat history, FK to conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES mandala_conversations(id) ON DELETE CASCADE,
  tenant_id       text NOT NULL DEFAULT 'mandala',
  direction       text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  sender          text NOT NULL CHECK (sender IN ('customer','owner','admin','mandala')),
  sender_number   text NOT NULL,
  content         text NOT NULL,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_conv_id ON mandala_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mm_tenant ON mandala_messages(tenant_id, created_at DESC);

ALTER TABLE mandala_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_mm" ON mandala_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_mm" ON mandala_messages
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 3. MANDALA LEAD SCORES
-- Scoring + signals per conversation
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_lead_scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES mandala_conversations(id) ON DELETE CASCADE,
  score           int NOT NULL DEFAULT 0,
  temperature     text NOT NULL DEFAULT 'cold'
                    CHECK (temperature IN ('hot','warm','lukewarm','cold','not_fit')),
  phase           text NOT NULL DEFAULT 'kenalan'
                    CHECK (phase IN ('kenalan','gali_masalah','tawarkan_solusi','closing','rescue')),
  signals         jsonb NOT NULL DEFAULT '[]',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id)
);

ALTER TABLE mandala_lead_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_mls" ON mandala_lead_scores
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_mls" ON mandala_lead_scores
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 4. MANDALA HANDOFF EVENTS
-- Audit trail for owner <-> mandala transitions
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_handoff_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES mandala_conversations(id) ON DELETE CASCADE,
  direction       text NOT NULL CHECK (direction IN ('owner_to_mandala','mandala_to_owner','mandala_flag_owner')),
  reason          text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mhe_conv ON mandala_handoff_events(conversation_id, created_at DESC);

ALTER TABLE mandala_handoff_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_mhe" ON mandala_handoff_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_mhe" ON mandala_handoff_events
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 5. MANDALA CUSTOMER MEMORY
-- Dynamic state per customer for context injection
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_customer_memory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES mandala_conversations(id) ON DELETE CASCADE,
  customer_number text NOT NULL,
  business_name   text,
  business_type   text,
  business_channel text,
  chat_volume     text,
  team_size       text,
  pain_points     text[] DEFAULT '{}',
  communication_style jsonb DEFAULT '{}',
  negotiation_position jsonb DEFAULT '{}',
  objections_raised text[] DEFAULT '{}',
  interests       text[] DEFAULT '{}',
  markdown_snapshot text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_mcm_customer ON mandala_customer_memory(customer_number);

ALTER TABLE mandala_customer_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_mcm" ON mandala_customer_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_mcm" ON mandala_customer_memory
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS update_mcm_updated_at ON mandala_customer_memory;
CREATE TRIGGER update_mcm_updated_at BEFORE UPDATE ON mandala_customer_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. MANDALA EVALUATOR LOG
-- Shadow evaluator output per incoming message
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_evaluator_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES mandala_conversations(id) ON DELETE CASCADE,
  message_id      uuid NOT NULL REFERENCES mandala_messages(id) ON DELETE CASCADE,
  intent          text NOT NULL,
  buying_signal   int NOT NULL DEFAULT 0,
  is_target_market boolean NOT NULL DEFAULT true,
  objection       text,
  recommended_action text NOT NULL DEFAULT 'continue',
  score_delta     int NOT NULL DEFAULT 0,
  resistance_detected boolean NOT NULL DEFAULT false,
  resistance_type text,
  raw_output      jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mel_conv ON mandala_evaluator_log(conversation_id, created_at DESC);

ALTER TABLE mandala_evaluator_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_mel" ON mandala_evaluator_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_mel" ON mandala_evaluator_log
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 7. MANDALA HUNTER PROSPECTS
-- Google Maps sourced business intelligence
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_hunter_prospects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name   text NOT NULL,
  business_type   text,
  address         text,
  phone           text,
  whatsapp_number text,
  website         text,
  google_maps_url text,
  google_rating   numeric(2,1),
  review_count    int DEFAULT 0,
  place_id        text UNIQUE,
  -- Intelligence fields
  has_online_presence boolean DEFAULT false,
  has_whatsapp    boolean DEFAULT false,
  estimated_chat_volume text,
  pain_classification text,
  pain_details    jsonb DEFAULT '{}',
  pain_score      int DEFAULT 0,
  -- Cold outreach tracking
  cold_message_sent boolean DEFAULT false,
  cold_message_sent_at timestamptz,
  cold_message_content text,
  cold_message_response text,
  -- Pipeline
  status          text NOT NULL DEFAULT 'discovered'
                    CHECK (status IN ('discovered','enriched','qualified','contacted','responded','converted','rejected','skipped')),
  priority        text DEFAULT 'medium'
                    CHECK (priority IN ('contact_now','high','medium','low','skip')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mhp_status ON mandala_hunter_prospects(status);
CREATE INDEX IF NOT EXISTS idx_mhp_pain ON mandala_hunter_prospects(pain_score DESC);
CREATE INDEX IF NOT EXISTS idx_mhp_place ON mandala_hunter_prospects(place_id);
CREATE INDEX IF NOT EXISTS idx_mhp_priority ON mandala_hunter_prospects(priority, pain_score DESC);

ALTER TABLE mandala_hunter_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_full_access_mhp" ON mandala_hunter_prospects
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_mhp" ON mandala_hunter_prospects
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS update_mhp_updated_at ON mandala_hunter_prospects;
CREATE TRIGGER update_mhp_updated_at BEFORE UPDATE ON mandala_hunter_prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Done
-- ============================================================
SELECT 'Mandala schema migration complete — 7 tables created' AS result;
