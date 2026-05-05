import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { embedText, composeContentText } from '@/lib/rag/gemini'

/**
 * Fire-and-forget: embed content after save.
 * Runs async without blocking the response.
 */
async function autoEmbed(contentId: string, content: Record<string, unknown>) {
  try {
    if (!process.env.GEMINI_API_KEY) return // skip if no key
    const text = composeContentText(content as Parameters<typeof composeContentText>[0])
    if (!text.trim()) return

    const embedding = await embedText(text)
    const supabase = await createClient()
    await supabase
      .from('contents')
      .update({ embedding: JSON.stringify(embedding), embedded_at: new Date().toISOString() })
      .eq('id', contentId)
  } catch (e) {
    console.warn('[RAG] Auto-embed failed:', e instanceof Error ? e.message : e)
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = request.nextUrl.searchParams.get('status')

  let query = supabase
    .from('contents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const { data, error } = await supabase
    .from('contents')
    .insert({
      title: body.title || 'Untitled',
      script: body.script || '',
      caption: body.caption || '',
      platform: body.platform || 'instagram',
      status: body.status || 'idea',
      publish_date: body.publish_date || null,
      thumbnail: body.thumbnail || '',
      image_assets: body.image_assets || [],
      video_link: body.video_link || '',
      carousel_assets: body.carousel_assets || [],
      external_publish_id: body.external_publish_id || '',
      project_id: body.project_id || null,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-embed in background (fire-and-forget)
  if (data?.id) autoEmbed(data.id, data)

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.id) {
    return NextResponse.json({ error: 'Missing content id' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  const allowedFields = [
    'title', 'script', 'caption', 'platform', 'status',
    'publish_date', 'thumbnail', 'image_assets', 'video_link',
    'carousel_assets', 'external_publish_id', 'project_id',
  ]

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  const { data, error } = await supabase
    .from('contents')
    .update(updateData)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-embed in background on content text changes
  const textFields = ['title', 'script', 'caption', 'hook_text', 'value_text', 'cta_text']
  if (data?.id && textFields.some(f => body[f] !== undefined)) {
    autoEmbed(data.id, data)
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing content id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('contents')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
