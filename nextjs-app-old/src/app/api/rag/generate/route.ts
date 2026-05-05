import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { embedText, generateWithContext } from '@/lib/rag/gemini'

/**
 * POST /api/rag/generate
 * RAG-powered content generation.
 * 1. Embed the user's prompt
 * 2. Retrieve similar past content (vector search)
 * 3. Generate new content with context
 *
 * Body: {
 *   prompt: string        — what to generate
 *   type?: 'script' | 'caption' | 'idea' | 'carousel'
 *   platform?: string     — target platform
 *   match_count?: number  — how many docs to retrieve (default 5)
 *   threshold?: number    — similarity threshold (default 0.3)
 * }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      prompt,
      type = 'script',
      platform,
      match_count = 5,
      threshold = 0.3,
    } = body

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 })
    }

    // Step 1: Embed user prompt
    const queryEmbedding = await embedText(prompt)

    // Step 2: Retrieve similar content using pgvector RPC
    const { data: matches, error: matchError } = await supabase.rpc('match_contents', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: threshold,
      match_count: match_count,
      filter_user_id: user.id,
    })

    if (matchError) {
      console.error('Vector search error:', matchError)
      // Fall through — generate without context if search fails
    }

    const retrievedDocs = (matches || []).map((m: {
      title: string | null
      script: string | null
      caption: string | null
      platform: string | null
      hook_text: string | null
      similarity: number
    }) => ({
      title: m.title,
      script: m.script,
      caption: m.caption,
      platform: m.platform,
      hook_text: m.hook_text,
      similarity: m.similarity,
    }))

    // Fetch user profile for personalization
    const { data: profileData } = await supabase
      .from('context_profile')
      .select('key, value')
      .in('key', ['name', 'display_name', 'brand_name'])

    const profile: Record<string, string> = {}
    profileData?.forEach((p: { key: string; value: string }) => {
      profile[p.key] = p.value
    })

    // Step 3: Generate with RAG context
    const generated = await generateWithContext(prompt, retrievedDocs, {
      type: type as 'script' | 'caption' | 'idea' | 'carousel',
      platform,
      brandName: profile.brand_name || 'JadiSatu',
      userName: profile.display_name || profile.name || user.email?.split('@')[0],
    })

    return NextResponse.json({
      success: true,
      generated,
      context: {
        retrieved_count: retrievedDocs.length,
        top_match_similarity: retrievedDocs[0]?.similarity || 0,
        sources: retrievedDocs.map((d: { title: string | null; similarity: number }) => ({
          title: d.title,
          similarity: Math.round(d.similarity * 100),
        })),
      },
    })
  } catch (e) {
    console.error('RAG generate error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
