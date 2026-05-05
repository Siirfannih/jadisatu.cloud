import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { embedTexts, composeContentText } from '@/lib/rag/gemini'

/**
 * POST /api/rag/batch-embed
 * Embed all contents that haven't been embedded yet (or re-embed all).
 * Useful for initial indexing and periodic re-indexing.
 *
 * Body: { force?: boolean } — if force=true, re-embed everything
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const force = body.force === true

    // Fetch contents that need embedding
    let query = supabase
      .from('contents')
      .select('id, title, script, caption, hook_text, value_text, cta_text, platform')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!force) {
      query = query.is('embedded_at', null)
    }

    const { data: contents, error: fetchError } = await query
    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch contents' }, { status: 500 })
    }

    if (!contents || contents.length === 0) {
      return NextResponse.json({ success: true, embedded: 0, message: 'No contents to embed' })
    }

    // Compose texts for all contents
    const textsWithIds = contents
      .map(c => ({
        id: c.id,
        text: composeContentText(c),
      }))
      .filter(t => t.text.trim().length > 0)

    if (textsWithIds.length === 0) {
      return NextResponse.json({ success: true, embedded: 0, message: 'No text content to embed' })
    }

    // Batch embed (process in chunks of 20 to avoid rate limits)
    const BATCH_SIZE = 20
    let totalEmbedded = 0
    const errors: string[] = []

    for (let i = 0; i < textsWithIds.length; i += BATCH_SIZE) {
      const batch = textsWithIds.slice(i, i + BATCH_SIZE)
      try {
        const embeddings = await embedTexts(batch.map(b => b.text))

        // Update each content with its embedding
        for (let j = 0; j < batch.length; j++) {
          const { error: updateError } = await supabase
            .from('contents')
            .update({
              embedding: JSON.stringify(embeddings[j]),
              embedded_at: new Date().toISOString(),
            })
            .eq('id', batch[j].id)

          if (updateError) {
            errors.push(`Failed to update ${batch[j].id}: ${updateError.message}`)
          } else {
            totalEmbedded++
          }
        }
      } catch (batchError) {
        errors.push(`Batch ${i / BATCH_SIZE + 1} failed: ${batchError instanceof Error ? batchError.message : 'unknown'}`)
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < textsWithIds.length) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    return NextResponse.json({
      success: true,
      total: contents.length,
      embedded: totalEmbedded,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (e) {
    console.error('RAG batch-embed error:', e)
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
