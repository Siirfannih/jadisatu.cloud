-- ================================================================
-- JadiSatu Dashboard OS - Authentication Migration
-- Phase 1: Database Schema Update for Multi-User Support
-- ================================================================
-- This migration adds user_id columns and implements Row Level Security
-- to isolate data per authenticated user.
-- ================================================================

-- Step 1: Add user_id columns to all tables
-- ================================================================

-- Tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Ideas table
ALTER TABLE public.ideas 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Domains table
ALTER TABLE public.domains 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Schedule blocks table
ALTER TABLE public.schedule_blocks 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Morning briefings table
ALTER TABLE public.morning_briefings 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Step 2: Drop existing permissive RLS policies
-- ================================================================

-- Tasks policies
DROP POLICY IF EXISTS "Enable all access for anon" ON public.tasks;

-- Projects policies
DROP POLICY IF EXISTS "Enable all access for anon" ON public.projects;

-- Ideas policies
DROP POLICY IF EXISTS "Enable all access for anon" ON public.ideas;

-- Domains policies
DROP POLICY IF EXISTS "Enable all access for anon" ON public.domains;

-- Schedule blocks policies
DROP POLICY IF EXISTS "Enable all access for anon" ON public.schedule_blocks;

-- Morning briefings policies
DROP POLICY IF EXISTS "Enable all access for anon" ON public.morning_briefings;

-- Step 3: Create user-specific RLS policies
-- ================================================================

-- TASKS TABLE POLICIES
CREATE POLICY "Users can view own tasks" 
ON public.tasks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" 
ON public.tasks FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" 
ON public.tasks FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" 
ON public.tasks FOR DELETE 
USING (auth.uid() = user_id);

-- PROJECTS TABLE POLICIES
CREATE POLICY "Users can view own projects" 
ON public.projects FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" 
ON public.projects FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" 
ON public.projects FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" 
ON public.projects FOR DELETE 
USING (auth.uid() = user_id);

-- IDEAS TABLE POLICIES
CREATE POLICY "Users can view own ideas" 
ON public.ideas FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ideas" 
ON public.ideas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ideas" 
ON public.ideas FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ideas" 
ON public.ideas FOR DELETE 
USING (auth.uid() = user_id);

-- DOMAINS TABLE POLICIES
CREATE POLICY "Users can view own domains" 
ON public.domains FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own domains" 
ON public.domains FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own domains" 
ON public.domains FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own domains" 
ON public.domains FOR DELETE 
USING (auth.uid() = user_id);

-- SCHEDULE BLOCKS TABLE POLICIES
CREATE POLICY "Users can view own schedule blocks" 
ON public.schedule_blocks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedule blocks" 
ON public.schedule_blocks FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule blocks" 
ON public.schedule_blocks FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedule blocks" 
ON public.schedule_blocks FOR DELETE 
USING (auth.uid() = user_id);

-- MORNING BRIEFINGS TABLE POLICIES
CREATE POLICY "Users can view own morning briefings" 
ON public.morning_briefings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own morning briefings" 
ON public.morning_briefings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own morning briefings" 
ON public.morning_briefings FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own morning briefings" 
ON public.morning_briefings FOR DELETE 
USING (auth.uid() = user_id);

-- Step 4: Create indexes for better query performance
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_ideas_user_id ON public.ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON public.domains(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_user_id ON public.schedule_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_morning_briefings_user_id ON public.morning_briefings(user_id);

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Next Steps:
-- 1. Existing data will have NULL user_id (won't be visible to any user)
-- 2. New data created by authenticated users will automatically get their user_id
-- 3. To migrate existing data to a specific user, run:
--    UPDATE public.tasks SET user_id = '<user-uuid>' WHERE user_id IS NULL;
--    UPDATE public.projects SET user_id = '<user-uuid>' WHERE user_id IS NULL;
--    (repeat for other tables)
-- ================================================================
