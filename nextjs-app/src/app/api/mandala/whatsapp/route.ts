import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateTenant } from '@/lib/mandala-auth'

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
    console.log('[wa-api] GET called')
    const authSupabase = await createServerClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      console.log('[wa-api] Auth failed:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[wa-api] User:', user.email)
    const tenantId = await getOrCreateTenant(user)

    // Try Supabase first, fall back to engine API if table doesn't exist
    try {
      const supabase = getServiceSupabase()
      const { data, error: dbError } = await supabase
        .from('mandala_wa_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .single()

      console.log('[wa-api] Supabase result - error:', dbError?.message, 'data:', data ? 'found' : 'null', 'status:', data?.status)
      if (!dbError && data) {
        return NextResponse.json(data)
      }
    } catch (e) {
      console.log('[wa-api] Supabase catch:', e instanceof Error ? e.message : e)
    }

    // Fallback: query engine directly for in-memory state
    console.log('[wa-api] Falling back to engine')
    const engineRes = await fetch(`${ENGINE_URL}/api/wa/status/${tenantId}`)
    const engineText = await engineRes.text()
    console.log('[wa-api] Engine response:', engineText.slice(0, 200))

    let engineData
    try {
      engineData = JSON.parse(engineText)
    } catch {
      console.error('[wa-api] Engine returned non-JSON:', engineText.slice(0, 200))
      return NextResponse.json({ status: 'disconnected', error_message: 'Engine unavailable' })
    }

    // Normalize camelCase engine response to snake_case for frontend
    return NextResponse.json({
      tenant_id: engineData.tenantId || tenantId,
      status: engineData.status || 'disconnected',
      qr_code: engineData.qrCode || null,
      phone_number: engineData.phoneNumber || null,
      connected_at: engineData.connectedAt || null,
      disconnected_at: engineData.disconnectedAt || null,
      last_qr_at: engineData.lastQrAt || null,
      error_message: engineData.errorMessage || null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[wa-api] Unhandled error:', error)
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
    const tenantId = await getOrCreateTenant(user)
    const body = await request.json()
    const { action } = body

    if (!action || !['connect', 'disconnect'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "connect" or "disconnect".' }, { status: 400 })
    }

    const engineRes = await fetch(`${ENGINE_URL}/api/wa/${action}/${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const text = await engineRes.text()
    let result
    try {
      result = JSON.parse(text)
    } catch {
      console.error('Engine returned non-JSON:', text.slice(0, 200))
      return NextResponse.json({ error: 'Engine returned invalid response' }, { status: 502 })
    }
    return NextResponse.json(result, { status: engineRes.status })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala WhatsApp API Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
