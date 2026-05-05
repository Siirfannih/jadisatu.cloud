import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateTenant } from '@/lib/mandala-auth'

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
    const tenantId = await getOrCreateTenant(user)

    const supabase = getServiceSupabase()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const decision = searchParams.get('decision')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('mandala_hunter_prospects')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (decision) query = query.eq('decision', decision)

    const { data, error } = await query
    if (error) throw error

    // Normalize DB column names to match frontend Prospect interface
    const normalized = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      business_name: row.business_name,
      address: row.address,
      phone: row.phone,
      website: row.website,
      rating: row.google_rating ?? row.rating ?? 0,
      review_count: row.review_count ?? 0,
      status: row.status,
      decision: row.priority ?? row.decision ?? null,
      pain_type: row.pain_classification ?? row.pain_type ?? null,
      pain_score: row.pain_score ?? 0,
      maps_url: row.google_maps_url ?? row.maps_url ?? null,
      created_at: row.created_at,
    }))

    return NextResponse.json({ success: true, data: normalized, count: normalized.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Hunter API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
