import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    // Auth guard
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      message: 'Use POST to run migration',
      sql: `CREATE TABLE IF NOT EXISTS public.leads (
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
CREATE INDEX IF NOT EXISTS idx_leads_pain_score ON public.leads(pain_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_category ON public.leads(category);
CREATE INDEX IF NOT EXISTS idx_leads_scraped_at ON public.leads(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);`
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
