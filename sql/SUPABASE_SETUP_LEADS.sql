-- ========================================
-- HUNTER AGENT LEADS TABLE SETUP
-- Run this in Supabase Dashboard SQL Editor
-- ========================================

-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  platform TEXT,
  subreddit TEXT,
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  upvotes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  author TEXT,
  created_at TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  pain_score INTEGER DEFAULT 0,
  category TEXT,
  opportunity_level TEXT,
  jadisatu_solution TEXT,
  target_market TEXT,
  estimated_value INTEGER DEFAULT 0,
  urgency TEXT,
  status TEXT DEFAULT 'new',
  matching_keywords TEXT[],
  keywords_extracted TEXT[],
  analyzed_at TIMESTAMPTZ
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_pain_score ON public.leads(pain_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_category ON public.leads(category);
CREATE INDEX IF NOT EXISTS idx_leads_scraped_at ON public.leads(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Service role can do everything"
  ON public.leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy for authenticated reads
CREATE POLICY "Authenticated users can read leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant permissions
GRANT ALL ON public.leads TO service_role;
GRANT SELECT ON public.leads TO authenticated;

COMMENT ON TABLE public.leads IS 'Pain points and leads discovered by Hunter Agent from Reddit and LinkedIn';
