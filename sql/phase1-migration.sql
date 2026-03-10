-- Phase 1 Migration: Fix ideas constraint + Create contents table
-- Run this in Supabase SQL Editor
--
-- This migration:
-- 1. Fixes the ideas table status constraint (reverts to 'active'/'archived' only)
-- 2. Creates the contents table for Creative Hub content pipeline

-- ============================================
-- Step 1: Fix ideas table status constraint
-- ============================================

-- Drop any expanded constraint that incorrectly included Creative Hub statuses
ALTER TABLE public.ideas DROP CONSTRAINT IF EXISTS ideas_status_check;

-- Restore the correct constraint: only 'active' and 'archived'
ALTER TABLE public.ideas ADD CONSTRAINT ideas_status_check
  CHECK (status IN ('active', 'archived'));

COMMENT ON COLUMN public.ideas.status IS 'Status: active, archived';

-- ============================================
-- Step 2: Create contents table
-- ============================================

CREATE TABLE IF NOT EXISTS public.contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  script TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  platform TEXT DEFAULT 'instagram',
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea', 'draft', 'script', 'ready', 'published')),
  publish_date TIMESTAMP WITH TIME ZONE,
  thumbnail TEXT DEFAULT '',
  image_assets TEXT[] DEFAULT '{}',
  video_link TEXT DEFAULT '',
  carousel_assets JSONB DEFAULT '[]',
  external_publish_id TEXT DEFAULT '',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;

-- User-specific CRUD policies
CREATE POLICY "Users can view their own contents" ON public.contents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contents" ON public.contents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contents" ON public.contents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contents" ON public.contents
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contents_user_id ON public.contents(user_id);
CREATE INDEX IF NOT EXISTS idx_contents_status ON public.contents(status);
CREATE INDEX IF NOT EXISTS idx_contents_created_at ON public.contents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contents_project_id ON public.contents(project_id);
