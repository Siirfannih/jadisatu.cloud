import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase environment variables are not configured')
      }
      _supabase = createClient(supabaseUrl, supabaseAnonKey)
    }
    return (_supabase as any)[prop]
  },
})
