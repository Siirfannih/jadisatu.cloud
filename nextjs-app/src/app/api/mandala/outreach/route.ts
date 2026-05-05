import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateTenant } from '@/lib/mandala-auth'
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
    const tenantId = await getOrCreateTenant(user)

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
    const tenantId = await getOrCreateTenant(user)

    const supabase = getServiceSupabase()
    const body = await request.json()
    const ENGINE_URL = process.env.MANDALA_ENGINE_URL || 'http://localhost:3100'

    // === ACTION: Generate draft cold message ===
    if (body.action === 'generate_draft') {
      const { prospect_id, business_name, phone, address, rating, review_count, website, pain_type, pain_score } = body
      if (!prospect_id || !business_name) {
        return NextResponse.json({ error: 'prospect_id and business_name required' }, { status: 400 })
      }

      try {
        // Use engine to generate personalized cold message
        const res = await fetch(`${ENGINE_URL}/api/outreach/generate-draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            prospect: { business_name, phone, address, rating, review_count, website, pain_type, pain_score },
          }),
        })

        if (res.ok) {
          const data = await res.json()
          return NextResponse.json({ success: true, draft: data.draft || data.message })
        }

        // Fallback: generate a simple template
        const draft = `Halo! Saya menemukan ${business_name} di Google Maps${rating ? ` dengan rating ${rating}⭐` : ''}. ` +
          `${pain_type ? `Sepertinya ada potensi untuk meningkatkan ${pain_type.replace(/_/g, ' ')} bisnis Anda. ` : ''}` +
          `Apakah Anda tertarik untuk ngobrol 15 menit tentang bagaimana kami bisa membantu? 😊`
        return NextResponse.json({ success: true, draft })
      } catch {
        // Fallback template
        const draft = `Halo! Saya menemukan ${business_name} dan sangat tertarik. Apakah ada waktu untuk ngobrol singkat tentang potensi kolaborasi? 😊`
        return NextResponse.json({ success: true, draft })
      }
    }

    // === ACTION: Approve draft and send via WhatsApp ===
    if (body.action === 'approve_and_send') {
      const { prospect_id, message } = body
      if (!prospect_id || !message) {
        return NextResponse.json({ error: 'prospect_id and message required' }, { status: 400 })
      }

      // Get prospect phone
      const { data: prospect } = await supabase
        .from('mandala_hunter_prospects')
        .select('phone, business_name, whatsapp_number')
        .eq('id', prospect_id)
        .single()

      if (!prospect?.phone) {
        return NextResponse.json({ error: 'Prospect tidak punya nomor telepon' }, { status: 400 })
      }

      // Normalize phone number
      let targetNumber = (prospect.whatsapp_number || prospect.phone).replace(/[\s\-\+\(\)]/g, '')
      if (targetNumber.startsWith('0')) targetNumber = '62' + targetNumber.slice(1)

      // Send via WA
      try {
        const waRes = await fetch(`${ENGINE_URL}/api/wa/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant: tenantId, to: targetNumber, message }),
        })

        if (!waRes.ok) {
          return NextResponse.json({ error: 'Gagal mengirim pesan WhatsApp' }, { status: 502 })
        }

        // Update prospect status to contacted
        await supabase.from('mandala_hunter_prospects').update({
          status: 'contacted',
          cold_message_sent: true,
          cold_message_sent_at: new Date().toISOString(),
          cold_message_content: message,
        }).eq('id', prospect_id)

        // Insert into outreach queue for tracking
        await supabase.from('mandala_outreach_queue').insert({
          source_type: 'hunter_prospect',
          source_id: prospect_id,
          target_name: prospect.business_name,
          target_contact: targetNumber,
          command: 'outreach_hunter',
          status: 'completed',
          assigned_to: 'mandala',
          result_summary: 'Pesan cold outreach terkirim',
          created_by: user.email || 'owner',
          completed_at: new Date().toISOString(),
        })

        // Create notification
        await supabase.from('mandala_notifications').insert({
          tenant_id: tenantId,
          type: 'system',
          title: `Outreach terkirim ke ${prospect.business_name}`,
          body: `Pesan cold message berhasil dikirim ke ${targetNumber}`,
        })

        return NextResponse.json({ success: true, message: 'Pesan terkirim' })
      } catch {
        return NextResponse.json({ error: 'Engine tidak tersedia' }, { status: 503 })
      }
    }

    // === ACTION: Reject prospect ===
    if (body.action === 'reject') {
      const { prospect_id } = body
      if (!prospect_id) {
        return NextResponse.json({ error: 'prospect_id required' }, { status: 400 })
      }

      const { error } = await supabase
        .from('mandala_hunter_prospects')
        .update({ status: 'rejected', decision: 'skip' })
        .eq('id', prospect_id)

      if (error) throw error
      return NextResponse.json({ success: true, message: 'Prospect ditolak' })
    }

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
