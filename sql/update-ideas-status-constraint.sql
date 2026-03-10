-- Update ideas table status constraint to support Creative Hub statuses
-- The Creative Hub uses statuses: 'idea', 'draft', 'script', 'ready', 'published'
-- In addition to the existing 'active', 'archived'

-- First, drop the existing check constraint if it exists
ALTER TABLE public.ideas DROP CONSTRAINT IF EXISTS ideas_status_check;

-- Add new check constraint with expanded status values
ALTER TABLE public.ideas ADD CONSTRAINT ideas_status_check 
  CHECK (status IN ('active', 'archived', 'idea', 'draft', 'script', 'ready', 'published'));

-- Update the comment
COMMENT ON COLUMN public.ideas.status IS 'Status: active, archived, idea, draft, script, ready, published';