-- Template Folder System — user_template_folders table
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

CREATE TABLE IF NOT EXISTS user_template_folders (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL,
  name        text NOT NULL,
  shared_brand jsonb NOT NULL DEFAULT '{}',
  styles      jsonb NOT NULL DEFAULT '[]',
  source      text DEFAULT 'smart-extractor',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_folders_user ON user_template_folders(user_id);

-- Enable RLS
ALTER TABLE user_template_folders ENABLE ROW LEVEL SECURITY;

-- RLS Policy: users can only access their own folders
CREATE POLICY "Users can view own template folders" ON user_template_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own template folders" ON user_template_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own template folders" ON user_template_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own template folders" ON user_template_folders
  FOR DELETE USING (auth.uid() = user_id);

-- Allow service role full access (for backend operations)
CREATE POLICY "Service role full access" ON user_template_folders
  FOR ALL USING (auth.role() = 'service_role');
