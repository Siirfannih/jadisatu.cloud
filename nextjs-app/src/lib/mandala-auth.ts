import type { User } from '@supabase/supabase-js'

const OWNER_EMAIL = process.env.MANDALA_OWNER_EMAIL || ''

export function isMandalaOwner(user: User): boolean {
  if (!OWNER_EMAIL) return true // If not configured, allow all authenticated users
  return user.email === OWNER_EMAIL
}
