import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isMandalaOwner } from '@/lib/mandala-auth'

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
    if (!isMandalaOwner(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = getServiceSupabase()

    // Conversations stats
    const { count: totalConversations } = await supabase
      .from('mandala_conversations')
      .select('*', { count: 'exact', head: true })

    const { count: activeConversations } = await supabase
      .from('mandala_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Phase breakdown
    const { data: phaseData } = await supabase
      .from('mandala_conversations')
      .select('phase')
      .eq('status', 'active')

    const phases: Record<string, number> = {}
    phaseData?.forEach((row: any) => {
      const p = row.phase || 'kenalan'
      phases[p] = (phases[p] || 0) + 1
    })

    // Leads by temperature
    const { data: leadData } = await supabase
      .from('mandala_lead_scores')
      .select('temperature, score')

    const temperatures: Record<string, number> = {}
    let totalScore = 0
    let scoreCount = 0
    leadData?.forEach((row: any) => {
      const t = row.temperature || 'cold'
      temperatures[t] = (temperatures[t] || 0) + 1
      totalScore += row.score || 0
      scoreCount++
    })

    // Conversion: conversations that reached closing phase
    const { count: closingCount } = await supabase
      .from('mandala_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('phase', 'closing')

    const conversionRate = totalConversations
      ? Math.round(((closingCount || 0) / totalConversations) * 100)
      : 0

    // Hunter prospects stats
    const { count: totalProspects } = await supabase
      .from('mandala_hunter_prospects')
      .select('*', { count: 'exact', head: true })

    const { count: contactedProspects } = await supabase
      .from('mandala_hunter_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'contacted')

    const { count: contactNowProspects } = await supabase
      .from('mandala_hunter_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('decision', 'contact_now')

    // Handler breakdown
    const { data: handlerData } = await supabase
      .from('mandala_conversations')
      .select('current_handler')
      .eq('status', 'active')

    const handlers: Record<string, number> = {}
    handlerData?.forEach((row: any) => {
      const h = row.current_handler || 'mandala'
      handlers[h] = (handlers[h] || 0) + 1
    })

    return NextResponse.json({
      conversations: {
        total: totalConversations || 0,
        active: activeConversations || 0,
        by_phase: phases,
        by_handler: handlers,
        conversion_rate: conversionRate,
      },
      leads: {
        total: scoreCount,
        avg_score: scoreCount ? Math.round(totalScore / scoreCount) : 0,
        by_temperature: temperatures,
      },
      hunter: {
        total_prospects: totalProspects || 0,
        contacted: contactedProspects || 0,
        contact_now: contactNowProspects || 0,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Mandala Stats API Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
