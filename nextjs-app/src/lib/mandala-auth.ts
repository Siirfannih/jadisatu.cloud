import type { User } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/**
 * Get user's tenant_id from mandala_tenants table.
 * Returns null if user has no tenant.
 */
export async function getUserTenantId(user: User): Promise<string | null> {
  const supabase = getServiceSupabase()
  const { data } = await supabase
    .from('mandala_tenants')
    .select('id')
    .eq('user_id', user.id)
    .single()
  return data?.id || null
}

/**
 * Get or auto-create tenant for user.
 * New users get tenant_id = 't_{first 8 chars of user.id}'.
 * Type = 'client' for new users (vs 'internal' for admin).
 */
export async function getOrCreateTenant(user: User): Promise<string> {
  const existing = await getUserTenantId(user)
  if (existing) return existing

  const tenantId = `t_${user.id.slice(0, 8)}`
  const supabase = getServiceSupabase()
  const { error } = await supabase.from('mandala_tenants').insert({
    id: tenantId,
    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    type: 'client',
    active: true,
    owner_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
    user_id: user.id,
  })

  if (error) {
    console.error('[mandala-auth] Failed to create tenant:', error.message)
    // Might be race condition — try reading again
    const retry = await getUserTenantId(user)
    if (retry) return retry
    throw new Error('Failed to create Mandala tenant')
  }

  return tenantId
}

/**
 * Legacy: check if user is admin/owner.
 * Used for admin-only operations (e.g. system config).
 */
export function isMandalaOwner(user: User): boolean {
  const OWNER_EMAILS = (process.env.MANDALA_OWNER_EMAIL || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)
  if (OWNER_EMAILS.length === 0) return true
  return OWNER_EMAILS.includes(user.email || '')
}
