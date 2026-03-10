import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

function getExternalOrigin(request: NextRequest): string {
  // Behind nginx proxy, request.url is http://localhost:3000
  // Use forwarded headers to reconstruct the real external origin
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'jadisatu.cloud'
  // Strip port from host if present (e.g., "jadisatu.cloud:443" -> "jadisatu.cloud")
  const cleanHost = host.split(':')[0]
  return `${proto}://${cleanHost}`
}

export async function GET(request: NextRequest) {
  const origin = getExternalOrigin(request)
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  console.log('[AUTH CALLBACK] Triggered:', {
    code: code ? 'present' : 'missing',
    error,
    error_description,
    origin,
    rawUrl: request.url,
    host: request.headers.get('host'),
    xForwardedProto: request.headers.get('x-forwarded-proto'),
    xForwardedHost: request.headers.get('x-forwarded-host'),
  })

  try {
    if (error) {
      console.error('[AUTH CALLBACK] OAuth provider error:', error, error_description)
      return NextResponse.redirect(
        `${origin}/light/login?error=${encodeURIComponent(error_description || error)}`
      )
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
              try {
                cookieStore.set({ name, value, ...options })
              } catch {
                // cookies().set() can throw in certain contexts
              }
            },
            remove(name: string, options: CookieOptions) {
              try {
                cookieStore.set({ name, value: '', ...options })
              } catch {
                // cookies().set() can throw in certain contexts
              }
            },
          },
        }
      )

      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('[AUTH CALLBACK] Exchange error:', exchangeError.message, exchangeError.code)
        if (exchangeError.code === 'flow_state_not_found') {
          return NextResponse.redirect(`${origin}/light/login?message=Please+try+signing+in+again`)
        }
        return NextResponse.redirect(
          `${origin}/light/login?error=${encodeURIComponent(exchangeError.message)}`
        )
      }

      console.log('[AUTH CALLBACK] Session exchange successful:', {
        userId: data?.user?.id,
        email: data?.user?.email,
      })

      console.log('[AUTH CALLBACK] Redirecting to:', `${origin}/light`)
      return NextResponse.redirect(`${origin}/light`)
    }

    console.warn('[AUTH CALLBACK] Called without code or error')
    return NextResponse.redirect(`${origin}/light/login`)
  } catch (err: any) {
    console.error('[AUTH CALLBACK] Unhandled exception:', err?.message, err?.stack)
    return NextResponse.redirect(
      `${origin}/light/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`
    )
  }
}
