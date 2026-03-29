-- Fix activities schema mismatch (Issue #13, task ceo-chat-1774690137859)
--
-- Problem: The API route queries table 'activities' but the actual table is 'activity_log'.
-- The 'activity_log' table (created in phase-10-unify-database.sql) already has the 'title' column.
--
-- Solution: Create a view 'activities' that aliases 'activity_log' so both names work.
-- This is backwards-compatible — existing code using 'activity_log' continues to work,
-- and the Light Mode API using 'activities' will now also work.

-- Ensure activity_log exists with all required columns (idempotent)
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

-- Add title column if it doesn't exist (safety net for older deployments)
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS details jsonb;

-- Ensure RLS is enabled
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Ensure RLS policies exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_log_select_own') THEN
    CREATE POLICY "activity_log_select_own" ON activity_log FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_log_insert_own') THEN
    CREATE POLICY "activity_log_insert_own" ON activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Ensure index exists
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id, created_at DESC);
