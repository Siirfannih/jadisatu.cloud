import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { topic, angle, platform, research_summary } = await request.json()

  if (!topic) {
    return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
  }

  // TODO: Replace with actual Gemini 2.5 Pro API call when GEMINI_API_KEY is available
  // The Narrative Engine workflow uses Gemini 2.5 Pro for content synthesis:
  //
  // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  // const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })
  // const result = await model.generateContent(
  //   `Based on this research: ${research_summary}\n\n` +
  //   `Generate a ${platform} content script about "${topic}" with angle: "${angle}"`
  // )

  const selectedAngle = angle || `Deep Dive into ${topic}`
  const selectedPlatform = platform || 'instagram'

  const draft_script = generateMockScript(topic, selectedAngle, selectedPlatform)

  return NextResponse.json({
    draft_script,
    topic,
    angle: selectedAngle,
    platform: selectedPlatform,
    generated_at: new Date().toISOString(),
  })
}

function generateMockScript(topic: string, angle: string, platform: string): string {
  const scripts: Record<string, string> = {
    youtube: `[INTRO - Hook]\n"Most people are completely wrong about ${topic}. Here's what they're missing..."\n\n` +
      `[SECTION 1 - Context]\n"Let me break down what's actually happening with ${topic}..."\n` +
      `- Set the scene with current data\n- Reference 2-3 key statistics\n- Establish credibility\n\n` +
      `[SECTION 2 - Main Insight]\n"The real story behind ${angle}..."\n` +
      `- Present your unique perspective\n- Use examples and analogies\n- Show data that supports your view\n\n` +
      `[SECTION 3 - Practical Application]\n"Here's how you can use this..."\n` +
      `- Step-by-step breakdown\n- Real examples\n- Common mistakes to avoid\n\n` +
      `[OUTRO - CTA]\n"If this helped you understand ${topic}, hit subscribe. Drop a comment with your take."`,

    instagram: `[SLIDE 1 - Hook]\n"${angle}" (bold text, eye-catching visual)\n\n` +
      `[SLIDE 2 - Problem]\nMost creators struggle with ${topic} because they focus on the wrong things.\n\n` +
      `[SLIDE 3 - Insight 1]\nKey finding: [Data point about ${topic}]\n\n` +
      `[SLIDE 4 - Insight 2]\nWhat the data actually shows...\n\n` +
      `[SLIDE 5 - Insight 3]\nThe pattern most people miss...\n\n` +
      `[SLIDE 6 - Action Step]\nHere's what to do next:\n1. [Step 1]\n2. [Step 2]\n3. [Step 3]\n\n` +
      `[SLIDE 7 - CTA]\nSave this for later. Follow for more on ${topic}.`,

    twitter: `THREAD: ${angle}\n\n` +
      `1/ Let's talk about ${topic}. There's a lot of noise out there, but here's what actually matters...\n\n` +
      `2/ First, the context: [Key background info]\n\n` +
      `3/ Most takes you see are surface-level. Here's what they're missing...\n\n` +
      `4/ The data tells a different story: [Specific data point]\n\n` +
      `5/ Why this matters for you: [Practical implication]\n\n` +
      `6/ Here's the move: [Actionable advice]\n\n` +
      `7/ TL;DR:\n- [Key point 1]\n- [Key point 2]\n- [Key point 3]\n\n` +
      `8/ If you found this useful, RT the first tweet. Follow for more on ${topic}.`,

    tiktok: `[0-3s HOOK]\n"Stop scrolling if you care about ${topic}"\n\n` +
      `[3-15s PROBLEM]\n"Everyone is talking about this wrong..."\n\n` +
      `[15-40s MAIN CONTENT]\n"Here's what's actually happening with ${angle}..."\n` +
      `- Point 1 (with visual)\n- Point 2 (with visual)\n- Point 3 (with visual)\n\n` +
      `[40-55s VALUE]\n"The one thing you need to know..."\n\n` +
      `[55-60s CTA]\n"Follow for more. Link in bio."`,

    linkedin: `${angle}\n\n` +
      `I've been deep in the data on ${topic}, and here's what I found:\n\n` +
      `The conventional wisdom says one thing.\nThe data says another.\n\n` +
      `Here are 3 key insights:\n\n` +
      `1. [Insight with supporting evidence]\n\n` +
      `2. [Counter-intuitive finding]\n\n` +
      `3. [Actionable takeaway]\n\n` +
      `The bottom line:\n[One sentence summary]\n\n` +
      `What's your take? I'd love to hear your perspective in the comments.\n\n` +
      `#${topic.replace(/\s+/g, '')} #ContentStrategy #CreatorEconomy`,
  }

  return scripts[platform] || scripts.instagram
}
