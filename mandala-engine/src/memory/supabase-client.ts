import { createClient, SupabaseClient } from '@supabase/supabase-js';

let instance: SupabaseClient | null = null;

/**
 * Singleton Supabase client using service role key.
 * Service role bypasses RLS — needed for server-side operations.
 */
export function getSupabase(): SupabaseClient {
  if (!instance) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error(
        '[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables'
      );
    }

    instance = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    console.log('[supabase] Client initialized');
  }

  return instance;
}
