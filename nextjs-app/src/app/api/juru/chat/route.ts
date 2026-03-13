import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { juruChat } from '@/lib/juru/agent'
import type { WorkspaceContext } from '@/lib/juru/personality'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * POST /api/juru/chat
 * Conversational AI endpoint for Juru Copilot.
 * Routes to OpenRouter (simple) or Gemini (complex) transparently.
 *
 * Body: {
 *   message: string           — current user message
 *   history?: ChatMessage[]   — conversation history (last 10 max)
 * }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Need at least one AI provider
    if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
    }

    const body = await req.json()
    const { message, history = [] } = body as {
      message: string
      history?: ChatMessage[]
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message required' }, { status: 400 })
    }

    // Fetch workspace context in parallel
    const [tasksRes, projectsRes, contentsRes, briefingRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('title, status, priority, domain, due_date')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('projects')
        .select('title, status, progress')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('contents')
        .select('title, status, platform')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('morning_briefings')
        .select('energy_level, focus_domain, priority_task')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    const tasks = tasksRes.data || []
    const projects = projectsRes.data || []
    const contents = contentsRes.data || []
    const briefing = briefingRes.data?.[0] || null

    const pendingTasks = tasks.filter(
      (t: { status: string }) => t.status === 'todo' || t.status === 'in_progress'
    )
    const completedToday = tasks.filter(
      (t: { status: string }) => t.status === 'done'
    ).length

    const workspaceContext: WorkspaceContext = {
      pendingTasks: pendingTasks.slice(0, 5),
      projects,
      contents,
      briefing: briefing ? {
        energy_level: briefing.energy_level,
        focus_domain: briefing.focus_domain,
        priority_task: briefing.priority_task,
      } : null,
      completedToday,
    }

    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kreator'

    const result = await juruChat(message, history, workspaceContext, userName)

    return NextResponse.json({
      reply: result.reply,
      tier: result.tier,
      provider: result.provider,
      context: {
        tasks_pending: pendingTasks.length,
        projects_active: projects.length,
        contents_count: contents.length,
      },
    })
  } catch (e) {
    console.error('Juru chat error:', e)
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
