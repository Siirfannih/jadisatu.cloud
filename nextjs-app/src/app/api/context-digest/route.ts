import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Context digest untuk agent (OpenClaw, Antigravity).
 * Response kecil agar hemat token — agent cek version; jika sama tidak perlu fetch konteks lengkap.
 * Lihat ARCHITECTURE.md untuk alur sync.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.json(
      { error: 'Supabase not configured', version: 'no-db' },
      { status: 503 }
    )
  }

  const supabase = createClient(url, key)

  try {
    const [tasksRes, memoryRes] = await Promise.all([
      supabase.from('tasks').select('id,status,title').in('status', ['in-progress', 'todo']).limit(10),
      supabase.from('shared_memory').select('key,value,updated_at').order('key'),
    ])

    const tasks = tasksRes.data ?? []
    const memory = memoryRes.data ?? []
    const inProgress = tasks.filter((t: { status: string }) => t.status === 'in-progress')
    const focus = memory.find((m: { key: string }) => m.key === 'current_focus')?.value ?? ''
    const lastMemoryUpdate = memory.length
      ? Math.max(...memory.map((m: { updated_at?: string }) => new Date(m.updated_at || 0).getTime()))
      : 0

    const digest = {
      version: `digest-${lastMemoryUpdate}-${inProgress.length}`,
      updated_at: new Date().toISOString(),
      focus: focus ? [focus] : [],
      tasks_in_progress: inProgress.length,
      context_updated: true,
    }

    return NextResponse.json(digest, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to build digest', version: 'error' },
      { status: 500 }
    )
  }
}
