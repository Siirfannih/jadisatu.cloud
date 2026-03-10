import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // Build redirect URL using request.nextUrl (handles proxy correctly)
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.searchParams.delete('code')
  redirectUrl.searchParams.delete('error')
  redirectUrl.searchParams.delete('error_description')

  console.log('[AUTH CALLBACK] Triggered:', {
    code: code ? 'present' : 'missing',
    error,
    error_description,
    origin: request.nextUrl.origin,
  })

  if (error) {
    console.error('[AUTH CALLBACK] OAuth provider error:', error, error_description)
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('error', error_description || error)
    return NextResponse.redirect(redirectUrl)
  }

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[AUTH CALLBACK] Exchange error:', exchangeError.message, exchangeError.code)
      redirectUrl.pathname = '/login'
      if (exchangeError.code === 'flow_state_not_found') {
        redirectUrl.searchParams.set('message', 'Please try signing in again')
      } else {
        redirectUrl.searchParams.set('error', exchangeError.message)
      }
      return NextResponse.redirect(redirectUrl)
    }

    console.log('[AUTH CALLBACK] Session exchange successful:', {
      userId: data?.user?.id,
      email: data?.user?.email,
    })

    redirectUrl.pathname = '/'
    return NextResponse.redirect(redirectUrl)
  }

  console.warn('[AUTH CALLBACK] Called without code or error')
  redirectUrl.pathname = '/login'
  return NextResponse.redirect(redirectUrl)
}
