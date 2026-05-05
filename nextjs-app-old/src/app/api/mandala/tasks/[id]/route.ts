import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { isMandalaOwner } from '@/lib/mandala-auth'

const ENGINE_URL = process.env.MANDALA_ENGINE_URL || 'http://localhost:3100'

/**
 * GET /api/mandala/tasks/[id]
 * Get task details including drafts — proxies to engine.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authSupabase = await createServerClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isMandalaOwner(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') // 'drafts' | 'log' | null (full detail)

    const path = view === 'drafts'
      ? `/api/tasks/${id}/drafts`
      : view === 'log'
        ? `/api/tasks/${id}/log`
        : `/api/tasks/${id}`

    const res = await fetch(`${ENGINE_URL}${path}`)
    const text = await res.text()

    let data
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Engine returned invalid response' }, { status: 502 })
    }

    return NextResponse.json(data, { status: res.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
