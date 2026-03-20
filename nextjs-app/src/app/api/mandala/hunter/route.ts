import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isMandalaOwner } from '@/lib/mandala-auth'

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
    if (!isMandalaOwner(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = getServiceSupabase()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const decision = searchParams.get('decision')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('mandala_hunter_prospects')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (decision) query = query.eq('decision', decision)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data, count: data?.length || 0 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Hunter API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
