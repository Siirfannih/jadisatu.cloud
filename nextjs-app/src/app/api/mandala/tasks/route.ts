import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isMandalaOwner } from '@/lib/mandala-auth'

const ENGINE_URL = process.env.MANDALA_ENGINE_URL || 'http://localhost:3100'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/**
 * GET /api/mandala/tasks?status=pending&limit=50
 * List tasks from mandala_tasks table (direct Supabase read for speed).
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
 * Create or update a task — proxies to mandala-engine TaskExecutor.
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

    const body = await request.json()

    // ── Action on existing task → proxy to engine ──
    if (body.id && body.action) {
      if (body.action === 'cancel') {
        return proxyToEngine(`/api/tasks/${body.id}/cancel`, 'POST')
      }
      if (body.action === 'approve') {
        return proxyToEngine(`/api/tasks/${body.id}/approve`, 'POST')
      }
      if (body.action === 'retry') {
        return proxyToEngine(`/api/tasks/${body.id}/retry`, 'POST')
      }
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // ── Create new task → proxy to engine (triggers TaskExecutor) ──
    const { type, objective, target_number, target_name, context, approval_mode } = body

    if (!type || !objective || !target_number) {
      return NextResponse.json(
        { error: 'Required: type, objective, target_number' },
        { status: 400 }
      )
    }

    // Map cockpit form data to engine's expected format
    const enginePayload = {
      tenant_id: 'mandala',
      type,
      objective,
      target: {
        customer_number: target_number,
        customer_name: target_name || undefined,
        channel: 'whatsapp',
      },
      context: context || '',
      approval_mode: approval_mode || 'draft_only',
      created_by: user.email || 'cockpit',
    }

    const engineRes = await fetch(`${ENGINE_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enginePayload),
    })

    const text = await engineRes.text()
    let result
    try {
      result = JSON.parse(text)
    } catch {
      console.error('[tasks-api] Engine returned non-JSON:', text.slice(0, 200))
      return NextResponse.json({ error: 'Engine returned invalid response' }, { status: 502 })
    }

    if (!engineRes.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Engine error' },
        { status: engineRes.status }
      )
    }

    return NextResponse.json({ success: true, data: result.task, message: result.message })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Tasks API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

async function proxyToEngine(path: string, method: string): Promise<NextResponse> {
  try {
    const res = await fetch(`${ENGINE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
    })
    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Engine returned invalid response' }, { status: 502 })
    }
    return NextResponse.json({ success: res.ok, ...data }, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Engine unreachable' }, { status: 502 })
  }
}
