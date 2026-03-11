-- Unify creative_content and contents tables
-- Make 'contents' the single source of truth for both Dark and Light mode
-- Safe to run multiple times (idempotent)

-- ============================================
-- 1. Add Dark-mode specific columns to contents table
-- ============================================
DO $$ BEGIN
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS hook_text text DEFAULT '';
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS value_text text DEFAULT '';
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS cta_text text DEFAULT '';
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS published_url text;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS external_publish_id text DEFAULT '';
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS canva_template_url text;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS canva_design_id text;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS carousel_slide_count int;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS approval_rate numeric;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS export_timestamp timestamptz;
  ALTER TABLE contents ADD COLUMN IF NOT EXISTS brand_config jsonb;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================
-- 2. Relax status constraint to support both mode's statuses
-- ============================================
-- Drop old constraint if exists and recreate with expanded values
DO $$ BEGIN
  ALTER TABLE contents DROP CONSTRAINT IF EXISTS contents_status_check;
  ALTER TABLE contents ADD CONSTRAINT contents_status_check
    CHECK (status IN ('idea', 'draft', 'scripting', 'script', 'ready', 'published'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================
-- 3. Migrate data from creative_content to contents (if creative_content exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'creative_content') THEN
    INSERT INTO contents (
      id, user_id, title, script, caption, platform, status,
      publish_date, hook_text, value_text, cta_text, published_url,
      created_at, updated_at
    )
    SELECT
      cc.id,
      cc.user_id,
      cc.title,
      cc.full_script,
      COALESCE(cc.hook_text, '') || E'\n' || COALESCE(cc.value_text, '') || E'\n' || COALESCE(cc.cta_text, ''),
      CASE WHEN cc.platform IS NOT NULL AND array_length(cc.platform, 1) > 0
           THEN cc.platform[1]
           ELSE 'instagram'
      END,
      CASE
        WHEN cc.status = 'scripting' THEN 'script'
        ELSE COALESCE(cc.status, 'idea')
      END,
      cc.scheduled_date,
      cc.hook_text,
      cc.value_text,
      cc.cta_text,
      cc.published_url,
      cc.created_at,
      COALESCE(cc.updated_at, cc.created_at)
    FROM creative_content cc
    WHERE NOT EXISTS (
      SELECT 1 FROM contents c WHERE c.id = cc.id
    );

    RAISE NOTICE 'Migrated data from creative_content to contents';
  END IF;
END $$;

-- ============================================
-- 4. Add performance indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_contents_user_status ON contents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contents_user_created ON contents(user_id, created_at DESC);

SELECT 'Creative tables unified successfully' AS result;
