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

/**
 * GET /api/mandala/tasks?status=pending&limit=50
 * List tasks from mandala_tasks table.
 */
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
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('mandala_tasks')
      .select('*')
      .eq('tenant_id', 'mandala')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)
    if (type) query = query.eq('type', type)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Tasks API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * POST /api/mandala/tasks
 * Create or update a task.
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json()

    // Update existing task
    if (body.id && body.action) {
      const updates: Record<string, unknown> = {}

      if (body.action === 'cancel') {
        updates.status = 'cancelled'
      } else if (body.action === 'approve') {
        updates.status = 'approved'
      } else if (body.action === 'execute') {
        updates.status = 'executed'
        updates.executed_at = new Date().toISOString()
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }

      const { error } = await supabase
        .from('mandala_tasks')
        .update(updates)
        .eq('id', body.id)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // Create new task
    const { type, objective, target_number, target_name, context, approval_mode } = body

    if (!type || !objective || !target_number) {
      return NextResponse.json(
        { error: 'Required: type, objective, target_number' },
        { status: 400 }
      )
    }

    const validTypes = ['outreach', 'follow_up', 'rescue', 'inbound_response', 'qualification']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Use: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const row = {
      tenant_id: 'mandala',
      type,
      objective,
      target: {
        customer_number: target_number,
        customer_name: target_name || null,
        channel: 'whatsapp',
      },
      context: context || '',
      approval_mode: approval_mode || 'draft_only',
      status: 'pending',
      created_by: user.email || 'cockpit',
    }

    const { data, error } = await supabase
      .from('mandala_tasks')
      .insert(row)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Tasks API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
