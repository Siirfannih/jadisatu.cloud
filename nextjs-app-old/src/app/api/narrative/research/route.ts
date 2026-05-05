import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { topic } = await request.json()

  if (!topic || typeof topic !== 'string') {
    return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
  }

  // TODO: Replace with actual Gemini API call when GEMINI_API_KEY is available
  // The Narrative Engine workflow uses:
  // 1. Gemini 2.0 Flash for triage (filtering noise, extracting signals)
  // 2. Gemini 2.5 Pro for content synthesis
  //
  // Example Gemini integration:
  // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  // const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  // const result = await model.generateContent(`Research and analyze: ${topic}`)

  // Simulated research output
  const research_summary = `Research Summary for "${topic}":\n\n` +
    `Based on analysis of current trends and data sources, here are the key findings:\n\n` +
    `1. Market Sentiment: The topic "${topic}" is generating significant discussion across social media platforms, ` +
    `with a mix of bullish and cautious perspectives.\n\n` +
    `2. Key Data Points:\n` +
    `   - Growing interest from mainstream audiences (search volume up ~35%)\n` +
    `   - Several thought leaders have published analysis pieces this week\n` +
    `   - Community engagement metrics show increasing participation\n\n` +
    `3. Signal Assessment: MODERATE-HIGH relevance. This topic has strong potential for ` +
    `content creation due to active community interest and information gaps in the market.`

  const content_angles = [
    {
      angle: `Beginner's Guide to ${topic}`,
      description: 'Educational content targeting newcomers who are curious but lack context',
      platform: 'youtube',
      format: 'Long-form video (8-12 min)',
    },
    {
      angle: `${topic}: What Nobody Is Talking About`,
      description: 'Contrarian take highlighting overlooked aspects that differentiate your perspective',
      platform: 'twitter',
      format: 'Thread (8-10 tweets)',
    },
    {
      angle: `My ${topic} Strategy Breakdown`,
      description: 'Personal experience-based content showing practical application',
      platform: 'instagram',
      format: 'Carousel (6-8 slides)',
    },
    {
      angle: `${topic} in 60 Seconds`,
      description: 'Quick explainer format optimized for short attention spans',
      platform: 'tiktok',
      format: 'Short-form video (45-60s)',
    },
  ]

  return NextResponse.json({
    research_summary,
    content_angles,
    topic,
    researched_at: new Date().toISOString(),
  })
}
