import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { isMandalaOwner } from '@/lib/mandala-auth'

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

    // Proxy to mandala-engine hunter run endpoint
    const engineUrl = process.env.MANDALA_ENGINE_URL || 'http://localhost:3100'
    const res = await fetch(`${engineUrl}/api/hunter/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: body.query,
        tenant: 'mandala',
        batch_size: body.batch_size || 20,
        auto_contact: false,
      }),
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Hunter Run API Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
