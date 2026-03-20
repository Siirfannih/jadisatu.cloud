import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function GET(request: NextRequest) {
  try {
    const authSupabase = await createServerClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const phase = searchParams.get('phase')
    const handler = searchParams.get('handler')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('mandala_conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (phase) query = query.eq('phase', phase)
    if (handler) query = query.eq('current_handler', handler)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data, count: data?.length || 0 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Conversations API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createServerClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const body = await request.json()
    const { id, action } = body

    if (!id || !action) {
      return NextResponse.json({ success: false, error: 'Missing id or action' }, { status: 400 })
    }

    if (action === 'takeover') {
      const { error } = await supabase
        .from('mandala_conversations')
        .update({ current_handler: 'owner', owner_active: true })
        .eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Owner took over conversation' })
    }

    if (action === 'release') {
      const { error } = await supabase
        .from('mandala_conversations')
        .update({ current_handler: 'mandala', owner_active: false })
        .eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Released to Mandala' })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Conversations API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
