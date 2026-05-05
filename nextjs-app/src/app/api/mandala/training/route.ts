import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateTenant } from '@/lib/mandala-auth'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// GET /api/mandala/training — List conversations available for review, or annotations
export async function GET(req: NextRequest) {
  try {
    const authSupabase = await createServerClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const tenantId = await getOrCreateTenant(user)

    const supabase = getServiceSupabase()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'conversations'

    if (type === 'annotations') {
      // List annotations
      const conversationId = searchParams.get('conversation_id')
      let query = supabase
        .from('mandala_training_annotations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (conversationId) query = query.eq('conversation_id', conversationId)

      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ data: data || [] })
    }

    // Default: list conversations with their messages for review
    // Include both active and closed conversations that have mandala messages
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data: conversations, error } = await supabase
      .from('mandala_conversations')
      .select('id, tenant_id, customer_number, customer_name, status, phase, current_handler, lead_score, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // For each conversation, get message count and annotation count
    const enriched = await Promise.all(
      (conversations || []).map(async (conv) => {
        const [msgResult, annResult] = await Promise.all([
          supabase
            .from('mandala_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id),
          supabase
            .from('mandala_training_annotations')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id),
        ])
        return {
          ...conv,
          message_count: msgResult.count || 0,
          annotation_count: annResult.count || 0,
        }
      })
    )

    return NextResponse.json({ data: enriched })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Training GET Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/mandala/training — Submit an annotation, optionally creating a policy or knowledge entry
export async function POST(req: NextRequest) {
  try {
    const authSupabase = await createServerClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await getOrCreateTenant(user)

    const body = await req.json()
    const { action } = body
    const supabase = getServiceSupabase()

    if (action === 'get_messages') {
      // Get messages for a conversation (for review UI)
      const { conversation_id } = body
      if (!conversation_id) {
        return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('mandala_messages')
        .select('*')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: true })

      if (error) throw error
      return NextResponse.json({ data: data || [] })
    }

    if (action === 'annotate') {
      // Submit a training annotation
      const { conversation_id, message_id, rating, suggested_response, notes } = body

      if (!conversation_id || !rating) {
        return NextResponse.json({ error: 'conversation_id and rating required' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('mandala_training_annotations')
        .insert({
          conversation_id,
          message_id: message_id || null,
          rating,
          suggested_response: suggested_response || null,
          notes: notes || null,
          action_taken: 'none',
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ data }, { status: 201 })
    }

    if (action === 'correct_to_policy') {
      // Create a candidate policy from a correction
      const { conversation_id, message_id, suggested_response, notes, policy_title, policy_rules } = body

      if (!conversation_id || !policy_title || !policy_rules) {
        return NextResponse.json(
          { error: 'conversation_id, policy_title, and policy_rules required' },
          { status: 400 }
        )
      }

      // Create the policy as candidate
      const { data: policy, error: policyError } = await supabase
        .from('mandala_policies')
        .insert({
          title: policy_title,
          description: notes || `Generated from conversation review`,
          rules_prompt: policy_rules,
          status: 'candidate',
          source: 'correction',
          created_by: user.id,
        })
        .select()
        .single()

      if (policyError) throw policyError

      // Create the annotation linked to the policy
      const { data: annotation, error: annError } = await supabase
        .from('mandala_training_annotations')
        .insert({
          conversation_id,
          message_id: message_id || null,
          rating: 'bad',
          suggested_response: suggested_response || null,
          notes: notes || null,
          action_taken: 'policy_created',
          resulting_policy_id: policy.id,
          created_by: user.id,
        })
        .select()
        .single()

      if (annError) throw annError

      return NextResponse.json({ annotation, policy }, { status: 201 })
    }

    if (action === 'correct_to_knowledge') {
      // Add knowledge from a correction
      const { conversation_id, message_id, notes, knowledge_title, knowledge_content, knowledge_category } = body

      if (!conversation_id || !knowledge_title || !knowledge_content) {
        return NextResponse.json(
          { error: 'conversation_id, knowledge_title, and knowledge_content required' },
          { status: 400 }
        )
      }

      // Create the knowledge entry
      const { data: knowledge, error: knowledgeError } = await supabase
        .from('mandala_knowledge')
        .insert({
          title: knowledge_title,
          content: knowledge_content,
          category: knowledge_category || 'custom',
          active: true,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single()

      if (knowledgeError) throw knowledgeError

      // Create the annotation linked to the knowledge
      const { data: annotation, error: annError } = await supabase
        .from('mandala_training_annotations')
        .insert({
          conversation_id,
          message_id: message_id || null,
          rating: 'bad',
          suggested_response: null,
          notes: notes || null,
          action_taken: 'knowledge_added',
          resulting_knowledge_id: knowledge.id,
          created_by: user.id,
        })
        .select()
        .single()

      if (annError) throw annError

      return NextResponse.json({ annotation, knowledge }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Training POST Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
