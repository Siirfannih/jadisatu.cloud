import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateTenant } from '@/lib/mandala-auth'

const MANDALA_ENGINE = process.env.MANDALA_ENGINE_URL || 'https://jadisatu.cloud'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/**
 * GET /api/mandala/tasks?status=pending&limit=50
 * Returns tasks joined with their engine execution states.
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
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Fetch tasks from mandala_tasks
    let query = supabase
      .from('mandala_tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)
    if (type) query = query.eq('type', type)

    const { data: tasks, error } = await query
    if (error) throw error

    // Fetch engine states for tasks that have engine_task_id
    const engineIds = (tasks || [])
      .map((t: any) => t.engine_task_id)
      .filter(Boolean)

    let engineStates: Record<string, any> = {}
    if (engineIds.length > 0) {
      const { data: states } = await supabase
        .from('mandala_task_states')
        .select('id, status, clarification, reasoning, report, escalation, updated_at')
        .in('id', engineIds)

      if (states) {
        for (const s of states) {
          engineStates[s.id] = s
        }
      }
    }

    // Merge task data with engine state
    const merged = (tasks || []).map((task: any) => {
      const engineState = task.engine_task_id ? engineStates[task.engine_task_id] : null
      return {
        ...task,
        engine_status: engineState?.status || null,
        clarification: task.clarification || engineState?.clarification || null,
        reasoning: engineState?.reasoning || null,
        report: engineState?.report || null,
        escalation: engineState?.escalation || null,
      }
    })

    return NextResponse.json({ success: true, data: merged })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Tasks API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * POST /api/mandala/tasks
 * Create task + auto-execute, update task, or respond to clarification.
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

    // === ACTION: Respond to clarification ===
    if (body.id && body.action === 'respond_clarification') {
      const { engine_task_id, response: userResponse, field } = body
      if (!engine_task_id || !userResponse) {
        return NextResponse.json({ error: 'Missing engine_task_id or response' }, { status: 400 })
      }

      try {
        // Try old executor system first: POST /api/task/:id/resume (mandala_task_states)
        // Then fallback to new task system: POST /api/tasks/:id/clarify (mandala_tasks)
        let res = await fetch(`${MANDALA_ENGINE}/api/task/${engine_task_id}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response: userResponse }),
        })

        // If old system returns 404, try new system
        if (!res.ok) {
          const answerField = field || 'user_response'
          res = await fetch(`${MANDALA_ENGINE}/api/tasks/${engine_task_id}/clarify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: { [answerField]: userResponse } }),
          })
        }

        if (res.ok) {
          const result = await res.json()
          // Map engine status to dashboard status
          let dashStatus = 'in_progress'
          if (result.status === 'planning') dashStatus = 'in_progress'
          else if (result.status === 'still_needs_clarification') dashStatus = 'needs_clarification'
          else if (result.status === 'sent') dashStatus = 'executed'
          else if (result.status === 'drafting') dashStatus = 'in_progress'
          else if (result.status === 'executing') dashStatus = 'in_progress'

          const updates: Record<string, unknown> = { status: dashStatus }
          if (dashStatus !== 'needs_clarification') {
            updates.clarification = null
          }

          await supabase
            .from('mandala_tasks')
            .update(updates)
            .eq('id', body.id)
            .eq('tenant_id', tenantId)

          return NextResponse.json({ success: true, engine_result: result })
        } else {
          const errBody = await res.json().catch(() => ({}))
          return NextResponse.json({
            error: errBody.error || 'Engine clarification failed',
          }, { status: 502 })
        }
      } catch {
        return NextResponse.json({ error: 'Engine unreachable' }, { status: 503 })
      }
    }

    // === ACTION: Update existing task (cancel, approve, execute) ===
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
        .eq('tenant_id', tenantId)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // === CREATE new task + auto-execute ===
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
      tenant_id: tenantId,
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

    // Auto-execute: trigger mandala-engine
    try {
      const execRes = await fetch(`${MANDALA_ENGINE}/api/task/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: type,
          target_number,
          objective,
          context: context || '',
          contact_name: target_name || '',
          tenant: tenantId,
        }),
      })

      if (execRes.ok) {
        const execResult = await execRes.json()

        // Map engine status to dashboard status
        let dashStatus = 'in_progress'
        if (execResult.status === 'needs_clarification') dashStatus = 'needs_clarification'
        else if (execResult.status === 'sent') dashStatus = 'executed'
        else if (execResult.status === 'failed') dashStatus = 'failed'
        else if (execResult.status === 'escalated') dashStatus = 'escalated'

        await supabase
          .from('mandala_tasks')
          .update({
            status: dashStatus,
            engine_task_id: execResult.task_id || null,
            clarification: execResult.clarification || null,
          })
          .eq('id', data.id)

        return NextResponse.json({
          success: true,
          data: { ...data, status: dashStatus, engine_task_id: execResult.task_id },
          execution: execResult,
        })
      } else {
        console.error('Engine task execute failed:', execRes.status)
        return NextResponse.json({ success: true, data, engine_error: 'Engine unavailable' })
      }
    } catch (engineErr) {
      console.error('Engine unreachable:', engineErr)
      return NextResponse.json({ success: true, data, engine_error: 'Engine unreachable' })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Tasks API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
