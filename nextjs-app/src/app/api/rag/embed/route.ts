import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { embedText, composeContentText } from '@/lib/rag/gemini'

/**
 * POST /api/rag/embed
 * Embed a single content item and store its vector in Supabase.
 * Called after content is created or updated.
 *
 * Body: { content_id: string }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { content_id } = await req.json()
    if (!content_id) {
      return NextResponse.json({ error: 'content_id required' }, { status: 400 })
    }

    // Fetch the content
    const { data: content, error: fetchError } = await supabase
      .from('contents')
      .select('id, title, script, caption, hook_text, value_text, cta_text, platform')
      .eq('id', content_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Compose text and embed
    const text = composeContentText(content)
    if (!text.trim()) {
      return NextResponse.json({ error: 'Content has no text to embed' }, { status: 400 })
    }

    const embedding = await embedText(text)

    // Store embedding
    const { error: updateError } = await supabase
      .from('contents')
      .update({
        embedding: JSON.stringify(embedding),
        embedded_at: new Date().toISOString(),
      })
      .eq('id', content_id)

    if (updateError) {
      console.error('Failed to store embedding:', updateError)
      return NextResponse.json({ error: 'Failed to store embedding' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      content_id,
      dimensions: embedding.length,
      text_length: text.length,
    })
  } catch (e) {
    console.error('RAG embed error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
