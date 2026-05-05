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
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20')

    let query = supabase
      .from('mandala_notifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) query = query.eq('read', false)

    const { data, error } = await query
    if (error) throw error

    // Count unread
    const { count } = await supabase
      .from('mandala_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('read', false)

    return NextResponse.json({ data: data || [], unread_count: count || 0 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createServerClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = await getOrCreateTenant(user)
    const supabase = getServiceSupabase()
    const body = await request.json()

    if (body.all) {
      // Mark all as read
      await supabase
        .from('mandala_notifications')
        .update({ read: true })
        .eq('tenant_id', tenantId)
        .eq('read', false)
      return NextResponse.json({ success: true })
    }

    if (body.id) {
      // Mark single as read
      await supabase
        .from('mandala_notifications')
        .update({ read: true })
        .eq('id', body.id)
        .eq('tenant_id', tenantId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Missing id or all flag' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
