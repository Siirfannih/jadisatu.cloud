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
    const phase = searchParams.get('phase')
    const temperature = searchParams.get('temperature')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('mandala_lead_scores')
      .select(`
        *,
        mandala_conversations!inner(
          id, customer_name, customer_number, phase, status, current_handler, updated_at
        )
      `)
      .order('score', { ascending: false })
      .limit(limit)

    if (temperature) query = query.eq('temperature', temperature)

    const { data, error } = await query
    if (error) throw error

    // Filter by phase if needed (from joined conversation)
    let filtered = data || []
    if (phase) {
      filtered = filtered.filter((d: any) => d.mandala_conversations?.phase === phase)
    }

    return NextResponse.json({ success: true, data: filtered, count: filtered.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Leads API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
