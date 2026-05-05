import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // ── REDESIGN REDIRECTS ──────────────────────────────────
  const redirects: Record<string, string> = {
    '/calendar': '/',
    '/focus': '/',
    '/tasks': '/',
    '/kanban': '/',
    '/projects': '/',
    '/domains/work': '/',
    '/domains/learn': '/',
    '/domains/business': '/',
    '/creative': '/content',
    '/content-studio': '/content',
    '/narrative-engine': '/content',
    '/monk-mode': '/',
    '/agents': '/mandala',
    '/ai-agent': '/mandala',
    '/notes': '/business-profile',
    '/ideas': '/business-profile',
    // '/crm' is now a real page — no redirect needed
    '/context': '/business-profile',
  }

  if (redirects[pathname]) {
    return NextResponse.redirect(new URL(redirects[pathname], request.url))
  }

  if (pathname.startsWith('/domains/')) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  // ────────────────────────────────────────────────────────

  // Allow API routes to handle their own auth (they use getUser() directly)
  if (pathname.startsWith('/api/')) {
    return response
  }

  // Allow access to login and auth callback routes
  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) {
    if (session && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // Protect all other routes - require authentication
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
