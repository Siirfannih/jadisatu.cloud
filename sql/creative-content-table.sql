-- Creative Content Table for Creative Hub
-- This table stores content items in the pipeline: idea -> scripting -> ready -> published

CREATE TABLE IF NOT EXISTS public.creative_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  hook_text TEXT DEFAULT '',
  value_text TEXT DEFAULT '',
  cta_text TEXT DEFAULT '',
  full_script TEXT DEFAULT '',
  status TEXT DEFAULT 'idea' CHECK (status IN ('idea', 'scripting', 'ready', 'published')),
  platform TEXT[] DEFAULT '{}',
  published_url TEXT,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.creative_content ENABLE ROW LEVEL SECURITY;

-- Create policies for user-specific access
CREATE POLICY "Users can view their own creative content" ON public.creative_content
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own creative content" ON public.creative_content
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own creative content" ON public.creative_content
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own creative content" ON public.creative_content
  FOR DELETE USING (auth.uid() = user_id);

-- Create index on user_id for performance
CREATE INDEX IF NOT EXISTS idx_creative_content_user_id ON public.creative_content(user_id);
CREATE INDEX IF NOT EXISTS idx_creative_content_status ON public.creative_content(status);
CREATE INDEX IF NOT EXISTS idx_creative_content_created_at ON public.creative_content(created_at DESC);