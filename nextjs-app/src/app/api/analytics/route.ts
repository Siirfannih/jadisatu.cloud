import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getOrCreateTenant } from '@/lib/mandala-auth'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function GET() {
  try {
    const authSupabase = await createServerClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = await getOrCreateTenant(user)
    const supabase = getServiceSupabase()

    // Parallel queries — scoped by tenant
    const [
      conversationsRes,
      hunterRes,
      contentsRes,
      tasksRes,
      messagesCountRes,
      leadsRes,
    ] = await Promise.all([
      supabase.from('mandala_conversations').select('id, status, phase, current_handler, lead_score, created_at').eq('tenant_id', tenantId),
      supabase.from('mandala_hunter_prospects').select('id, status, priority, pain_score, created_at').eq('tenant_id', tenantId),
      supabase.from('contents').select('id, status, created_at').eq('user_id', user.id),
      supabase.from('tasks').select('id, status, created_at').eq('user_id', user.id),
      supabase.from('mandala_messages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('leads').select('id, pain_score, category, status, created_at'),
    ])

    const conversations = conversationsRes.data || []
    const hunters = hunterRes.data || []
    const contents = contentsRes.data || []
    const tasks = tasksRes.data || []
    const totalMessages = messagesCountRes.count || 0
    const leads = leadsRes.data || []

    // Funnel: Hunter Prospects → Conversations → Phases → Closing
    const totalProspects = hunters.length
    const conversationsCount = conversations.length
    const inNegotiation = conversations.filter((c: any) => c.phase === 'tawarkan_solusi').length
    const inClosing = conversations.filter((c: any) => c.phase === 'closing').length
    const conversionRate = conversationsCount > 0
      ? Math.round((inClosing / conversationsCount) * 100 * 10) / 10
      : 0

    // Conversation stats by phase
    const byPhase: Record<string, number> = {}
    conversations.forEach((c: any) => {
      byPhase[c.phase] = (byPhase[c.phase] || 0) + 1
    })

    // Lead score distribution
    const avgScore = conversations.length > 0
      ? Math.round(conversations.reduce((sum: number, c: any) => sum + (c.lead_score || 0), 0) / conversations.length)
      : 0

    const highScoreLeads = conversations.filter((c: any) => (c.lead_score || 0) >= 70).length
    const warmLeads = conversations.filter((c: any) => (c.lead_score || 0) >= 50 && (c.lead_score || 0) < 70).length
    const coldLeads = conversations.filter((c: any) => (c.lead_score || 0) < 50).length

    // Hunter prospects by decision
    const contactNow = hunters.filter((h: any) => h.priority === 'contact_now').length
    const highPriority = hunters.filter((h: any) => h.priority === 'high_priority' || h.priority === 'high').length

    // Content stats
    const publishedContent = contents.filter((c: any) => c.status === 'published').length
    const draftContent = contents.filter((c: any) => c.status === 'draft' || c.status === 'script').length
    const ideaContent = contents.filter((c: any) => c.status === 'idea').length

    // Tasks stats
    const completedTasks = tasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length
    const activeTasks = tasks.filter((t: any) => t.status === 'in_progress' || t.status === 'active').length

    // Lead categories (from Reddit scraping)
    const categories: Record<string, number> = {}
    leads.forEach((l: any) => {
      if (l.category) categories[l.category] = (categories[l.category] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          total_prospects: totalProspects,
          total_conversations: conversationsCount,
          total_messages: totalMessages,
          conversion_rate: conversionRate,
          avg_lead_score: avgScore,
        },
        funnel: [
          { stage: 'Prospek (Hunter)', count: totalProspects, pct: 100 },
          { stage: 'Percakapan', count: conversationsCount, pct: totalProspects > 0 ? Math.round((conversationsCount / totalProspects) * 100) : 0 },
          { stage: 'Gali Masalah', count: byPhase['gali_masalah'] || 0, pct: totalProspects > 0 ? Math.round(((byPhase['gali_masalah'] || 0) / totalProspects) * 100) : 0 },
          { stage: 'Tawarkan Solusi', count: inNegotiation, pct: totalProspects > 0 ? Math.round((inNegotiation / totalProspects) * 100) : 0 },
          { stage: 'Closing', count: inClosing, pct: totalProspects > 0 ? Math.round((inClosing / totalProspects) * 100) : 0 },
        ],
        conversations_by_phase: byPhase,
        leads_temperature: {
          hot: highScoreLeads,
          warm: warmLeads,
          cold: coldLeads,
        },
        hunter: {
          total: totalProspects,
          contact_now: contactNow,
          high_priority: highPriority,
          categories: Object.entries(categories)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count })),
        },
        content: {
          total: contents.length,
          published: publishedContent,
          draft: draftContent,
          ideas: ideaContent,
        },
        tasks: {
          total: tasks.length,
          completed: completedTasks,
          active: activeTasks,
        },
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Analytics API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
