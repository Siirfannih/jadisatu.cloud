-- Contents table for Creative Hub content pipeline
-- Separate from ideas table which uses 'active'/'archived' statuses
-- Contents table uses pipeline statuses: 'idea', 'draft', 'script', 'ready', 'published'

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

-- Note: The ideas table keeps its original constraint:
-- status IN ('active', 'archived')
-- Do NOT mix content pipeline statuses into the ideas table.
