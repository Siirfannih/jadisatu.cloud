import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isMandalaOwner } from '@/lib/mandala-auth'
import type { CreateOutreachRequest, UpdateOutreachRequest } from '@/lib/mandala-outreach'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/**
 * GET /api/mandala/outreach
 * List outreach queue items with optional filters.
 *
 * Query params: status, priority, source_type, assigned_to, limit, offset
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
    const priority = searchParams.get('priority')
    const sourceType = searchParams.get('source_type')
    const assignedTo = searchParams.get('assigned_to')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const stats = searchParams.get('stats')

    // Stats mode: return aggregated counts
    if (stats === 'true') {
      const { data: allItems } = await supabase
        .from('mandala_outreach_queue')
        .select('status, priority, source_type, command')

      const byStatus: Record<string, number> = {}
      const byPriority: Record<string, number> = {}
      const bySource: Record<string, number> = {}
      const byCommand: Record<string, number> = {}
      let total = 0

      allItems?.forEach((item: { status: string; priority: string; source_type: string; command: string }) => {
        total++
        byStatus[item.status] = (byStatus[item.status] || 0) + 1
        byPriority[item.priority] = (byPriority[item.priority] || 0) + 1
        bySource[item.source_type] = (bySource[item.source_type] || 0) + 1
        byCommand[item.command] = (byCommand[item.command] || 0) + 1
      })

      return NextResponse.json({
        total,
        actionable: (byStatus['queued'] || 0) + (byStatus['assigned'] || 0),
        by_status: byStatus,
        by_priority: byPriority,
        by_source: bySource,
        by_command: byCommand,
      })
    }

    // List mode
    let query = supabase
      .from('mandala_outreach_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)
    if (sourceType) query = query.eq('source_type', sourceType)
    if (assignedTo) query = query.eq('assigned_to', assignedTo)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data, count: data?.length || 0 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Outreach API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * POST /api/mandala/outreach
 * Create a new outreach command or update an existing one.
 *
 * Body with `id` field = update (PATCH semantics).
 * Body without `id` = create new outreach item.
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

    // Update existing item
    if (body.id && (body.status || body.assigned_to || body.result_summary)) {
      const update = body as UpdateOutreachRequest
      const patch: Record<string, unknown> = {}
      if (update.status) patch.status = update.status
      if (update.assigned_to) patch.assigned_to = update.assigned_to
      if (update.result_summary) patch.result_summary = update.result_summary
      if (update.status === 'completed') patch.completed_at = new Date().toISOString()

      const { error } = await supabase
        .from('mandala_outreach_queue')
        .update(patch)
        .eq('id', update.id)

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Outreach item updated' })
    }

    // Create new item
    const create = body as CreateOutreachRequest
    if (!create.source_type || !create.source_id || !create.target_name || !create.command) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: source_type, source_id, target_name, command' },
        { status: 400 }
      )
    }

    // Build source snapshot from the source entity
    let sourceSnapshot: Record<string, unknown> = {}
    if (create.source_type === 'lead') {
      const { data: leadData } = await supabase
        .from('leads')
        .select('*')
        .eq('id', create.source_id)
        .single()
      if (leadData) sourceSnapshot = leadData as Record<string, unknown>
    } else if (create.source_type === 'hunter_prospect') {
      const { data: prospectData } = await supabase
        .from('mandala_hunter_prospects')
        .select('*')
        .eq('id', create.source_id)
        .single()
      if (prospectData) sourceSnapshot = prospectData as Record<string, unknown>
    }

    const { data, error } = await supabase
      .from('mandala_outreach_queue')
      .insert({
        source_type: create.source_type,
        source_id: create.source_id,
        source_snapshot: sourceSnapshot,
        target_name: create.target_name,
        target_contact: create.target_contact || null,
        target_platform: create.target_platform || null,
        target_category: create.target_category || null,
        command: create.command,
        command_context: create.command_context || {},
        priority: create.priority || 'medium',
        assigned_to: create.assigned_to || 'mandala',
        scheduled_for: create.scheduled_for || null,
        created_by: user.email || 'owner',
        status: 'queued',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data, message: 'Outreach command created' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Outreach API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
