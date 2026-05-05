'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

/**
 * Auth Session Bridge
 *
 * Syncs auth session between Dark mode (localStorage-based) and Light mode (cookie-based).
 * When user navigates from Dark mode → Light mode, this page:
 * 1. Checks if there's a valid Supabase session in localStorage
 * 2. Refreshes the session (which causes @supabase/ssr to set cookies)
 * 3. Redirects to the Light mode dashboard
 */
export default function AuthBridge() {
  const [status, setStatus] = useState('Syncing your session...')

  useEffect(() => {
    syncSession()
  }, [])

  async function syncSession() {
    try {
      const supabase = createClient()

      // Try to get current session - this will check both localStorage and cookies
      const { data: { session }, error } = await supabase.auth.getSession()

      if (session) {
        // Session found - refresh it to ensure cookies are set
        await supabase.auth.refreshSession()
        setStatus('Session synced! Redirecting...')
        window.location.href = '/'
        return
      }

      // No session from getSession, try to recover from localStorage
      // Supabase stores tokens with key pattern: sb-<ref>-auth-token
      const storageKeys = Object.keys(localStorage)
      const authKey = storageKeys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))

      if (authKey) {
        try {
          const stored = JSON.parse(localStorage.getItem(authKey) || '{}')
          if (stored.access_token && stored.refresh_token) {
            const { error: setError } = await supabase.auth.setSession({
              access_token: stored.access_token,
              refresh_token: stored.refresh_token,
            })

            if (!setError) {
              setStatus('Session restored! Redirecting...')
              window.location.href = '/'
              return
            }
          }
        } catch {
          // Invalid stored data, fall through to login
        }
      }

      // No valid session found - redirect to login
      setStatus('No session found. Redirecting to login...')
      setTimeout(() => {
        window.location.href = '/login'
      }, 1000)
    } catch {
      setStatus('Error syncing session. Redirecting to login...')
      setTimeout(() => {
        window.location.href = '/login'
      }, 1500)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">{status}</p>
      </div>
    </div>
  )
}
