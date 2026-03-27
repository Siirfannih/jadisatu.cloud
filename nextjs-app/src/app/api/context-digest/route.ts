import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * Context digest untuk agent (Mandala, Antigravity).
 * Response kecil agar hemat token — agent cek version; jika sama tidak perlu fetch konteks lengkap.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Auth guard
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [tasksRes, memoryRes] = await Promise.all([
      supabase.from('tasks').select('id,status,title').eq('user_id', user.id).in('status', ['in-progress', 'todo']).limit(10),
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
