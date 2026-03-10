-- Fix ideas table status constraint
-- The ideas table should ONLY use 'active' and 'archived' statuses.
-- Content pipeline statuses ('idea', 'draft', 'script', 'ready', 'published')
-- belong in the separate "contents" table.

-- Drop any expanded constraint that incorrectly included Creative Hub statuses
ALTER TABLE public.ideas DROP CONSTRAINT IF EXISTS ideas_status_check;

-- Restore the correct constraint: only 'active' and 'archived'
ALTER TABLE public.ideas ADD CONSTRAINT ideas_status_check
  CHECK (status IN ('active', 'archived'));

-- Update the comment to reflect the correct values
COMMENT ON COLUMN public.ideas.status IS 'Status: active, archived';
