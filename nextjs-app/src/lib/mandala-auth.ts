import type { User } from '@supabase/supabase-js'

const OWNER_EMAILS = (process.env.MANDALA_OWNER_EMAIL || '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean)

export function isMandalaOwner(user: User): boolean {
  if (OWNER_EMAILS.length === 0) return true // If not configured, allow all authenticated users
  return OWNER_EMAILS.includes(user.email || '')
}
