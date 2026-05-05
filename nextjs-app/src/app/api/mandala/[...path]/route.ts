import { createClient as createServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

const MANDALA_ENGINE_URL = process.env.MANDALA_ENGINE_URL || 'https://jadisatu.cloud'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Auth guard — prevent unauthenticated proxy access
  const authSupabase = await createServerClient()
  const { data: { user }, error: authError } = await authSupabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { path } = await params
  const apiPath = `/api/${path.join('/')}`
  const search = request.nextUrl.searchParams.toString()
  const url = `${MANDALA_ENGINE_URL}${apiPath}${search ? `?${search}` : ''}`

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 30 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Mandala Engine unavailable' },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Failed to connect to Mandala Engine' },
      { status: 503 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Auth guard
  const authSupabase2 = await createServerClient()
  const { data: { user: user2 }, error: authError2 } = await authSupabase2.auth.getUser()
  if (authError2 || !user2) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { path } = await params
  const apiPath = `/api/${path.join('/')}`
  const url = `${MANDALA_ENGINE_URL}${apiPath}`

  try {
    let body: string | undefined
    try {
      body = JSON.stringify(await request.json())
    } catch {
      // No body
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Mandala Engine unavailable' },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Failed to connect to Mandala Engine' },
      { status: 503 }
    )
  }
}
