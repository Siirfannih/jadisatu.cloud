import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '10'

    const { data, error } = await supabase
      .from('activities')
      .select('id, action, entity_type, entity_id, title, domain, details, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    if (error) throw error

    const items = (data || []).map((row: { id: string; action: string; entity_type?: string; title?: string; domain?: string; details?: Record<string, unknown>; created_at: string }) => {
      const action = String(row.action || 'Activity')
      const type =
        action.includes('task') ? (action.includes('complete') ? 'complete' : 'edit')
        : action.includes('commit') ? 'commit'
        : action.includes('comment') ? 'comment'
        : (row.entity_type || 'edit')
      const subject = row.title ? `"${row.title}"` : ''
      const description =
        (row.details && typeof row.details === 'object' && 'description' in row.details)
          ? String((row.details as { description?: string }).description)
          : subject || (row.domain ? row.domain : '')
      return {
        id: row.id,
        type,
        action,
        description,
        created_at: row.created_at,
      }
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}
