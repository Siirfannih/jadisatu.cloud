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
 * GET /api/mandala/whatsapp?tenant=mandala
 * Read WhatsApp session status from Supabase (fast, no engine proxy needed).
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

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant') || 'mandala'

    const supabase = getServiceSupabase()
    const { data } = await supabase
      .from('mandala_wa_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (!data) {
      return NextResponse.json({
        tenant_id: tenantId,
        status: 'disconnected',
      })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala WhatsApp API Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/mandala/whatsapp
 * Body: { action: 'connect' | 'disconnect', tenant?: string }
 * Proxies to mandala-engine /api/wa/connect or /api/wa/disconnect.
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
    const { action, tenant } = body
    const tenantId = tenant || 'mandala'

    if (!action || !['connect', 'disconnect'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "connect" or "disconnect".' }, { status: 400 })
    }

    const engineRes = await fetch(`${ENGINE_URL}/api/wa/${action}/${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await engineRes.json()
    return NextResponse.json(result, { status: engineRes.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala WhatsApp API Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
