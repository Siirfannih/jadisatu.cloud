-- Carousel Edit Feedback Table
-- Stores structured user edit actions on AI-generated carousel templates
-- Used for future learning and improvement of the Smart Extractor pipeline

CREATE TABLE IF NOT EXISTS public.carousel_edit_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  template_id TEXT,
  template_family TEXT,
  original_visual_mode TEXT,
  final_visual_mode TEXT,
  original_font_preset TEXT,
  final_font_preset TEXT,
  changes JSONB DEFAULT '[]'::jsonb,
  change_count INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_carousel_edit_feedback_user_id
  ON public.carousel_edit_feedback(user_id);

-- Index for template family analysis
CREATE INDEX IF NOT EXISTS idx_carousel_edit_feedback_family
  ON public.carousel_edit_feedback(template_family);

-- Enable RLS
ALTER TABLE public.carousel_edit_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: users can only read/write their own feedback
CREATE POLICY "Users manage own carousel feedback"
  ON public.carousel_edit_feedback
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fallback policy for anon access (match existing pattern)
CREATE POLICY "Enable all access for anon"
  ON public.carousel_edit_feedback
  FOR ALL
  USING (true)
  WITH CHECK (true);
