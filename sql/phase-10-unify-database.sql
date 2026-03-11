-- Phase 10: Database Unification Migration
-- Idempotent — safe to run multiple times
-- Run in Supabase SQL Editor

-- ============================================
-- 1. CONTENTS TABLE (Creative Hub canonical)
-- ============================================
CREATE TABLE IF NOT EXISTS contents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL DEFAULT '',
  script        text,
  caption       text,
  platform      text,
  status        text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','draft','script','ready','published')),
  publish_date  timestamptz,
  thumbnail     text,
  image_assets  text[],
  video_link    text,
  carousel_assets jsonb,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Add missing columns if table already exists
DO $$ BEGIN
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS script text;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS caption text;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS platform text;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS publish_date timestamptz;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS thumbnail text;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS image_assets text[];
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS video_link text;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS carousel_assets jsonb;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contents_user_id ON contents(user_id);
CREATE INDEX IF NOT EXISTS idx_contents_user_status ON contents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contents_created_at ON contents(user_id, created_at DESC);

-- RLS
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contents_select_own" ON contents;
DROP POLICY IF EXISTS "contents_insert_own" ON contents;
DROP POLICY IF EXISTS "contents_update_own" ON contents;
DROP POLICY IF EXISTS "contents_delete_own" ON contents;
CREATE POLICY "contents_select_own" ON contents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contents_insert_own" ON contents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contents_update_own" ON contents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "contents_delete_own" ON contents FOR DELETE USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_contents_updated_at ON contents;
CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. MORNING BRIEFINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS morning_briefings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date NOT NULL DEFAULT CURRENT_DATE,
  energy_level    text,
  focus_domain    text,
  priority_task   text,
  blockers        text,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_morning_briefings_user_date ON morning_briefings(user_id, date DESC);

ALTER TABLE morning_briefings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "morning_briefings_select_own" ON morning_briefings;
DROP POLICY IF EXISTS "morning_briefings_insert_own" ON morning_briefings;
DROP POLICY IF EXISTS "morning_briefings_update_own" ON morning_briefings;
DROP POLICY IF EXISTS "morning_briefings_delete_own" ON morning_briefings;
CREATE POLICY "morning_briefings_select_own" ON morning_briefings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "morning_briefings_insert_own" ON morning_briefings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "morning_briefings_update_own" ON morning_briefings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "morning_briefings_delete_own" ON morning_briefings FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. DAILY BRIEFING LOG (used by MorningBriefingService)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_briefing_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  briefing_date   date NOT NULL DEFAULT CURRENT_DATE,
  clarity_level   int DEFAULT 3,
  priority_task   text,
  blockers        text[] DEFAULT '{}',
  ai_summary      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefing_log_user_date ON daily_briefing_log(user_id, briefing_date DESC);

ALTER TABLE daily_briefing_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_briefing_log_select_own" ON daily_briefing_log;
DROP POLICY IF EXISTS "daily_briefing_log_insert_own" ON daily_briefing_log;
DROP POLICY IF EXISTS "daily_briefing_log_update_own" ON daily_briefing_log;
CREATE POLICY "daily_briefing_log_select_own" ON daily_briefing_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_briefing_log_insert_own" ON daily_briefing_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_briefing_log_update_own" ON daily_briefing_log FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 4. ACTIVITY LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text NOT NULL,
  entity_type text,
  entity_id   uuid,
  title       text,
  domain      text,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id, created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_log_select_own" ON activity_log;
DROP POLICY IF EXISTS "activity_log_insert_own" ON activity_log;
CREATE POLICY "activity_log_select_own" ON activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "activity_log_insert_own" ON activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. AGENTS TABLE — ensure correct schema
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text UNIQUE NOT NULL,
  status        text DEFAULT 'idle',
  last_active   timestamptz DEFAULT now(),
  current_task  text,
  location      text,
  cpu_usage     int DEFAULT 0,
  memory_usage  int DEFAULT 0,
  meta          jsonb DEFAULT '{}'
);

-- No RLS on agents — shared system table

-- Done
SELECT 'Phase 10 migration complete' AS result;
