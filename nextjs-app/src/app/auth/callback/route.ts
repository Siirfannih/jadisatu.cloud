import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

function getSiteUrl(request: Request) {
  // Behind nginx proxy, request.url is http://localhost:3000
  // Use X-Forwarded headers set by nginx to get the real external URL
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('host') || 'jadisatu.cloud'
  return `${proto}://${host}`
}

export async function GET(request: Request) {
  const SITE_URL = getSiteUrl(request)
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const error_description = requestUrl.searchParams.get("error_description")

  console.log("[AUTH CALLBACK] Triggered:", { 
    code: code ? "present" : "missing",
    error,
    error_description,
    siteUrl: SITE_URL,
    fullUrl: request.url
  })

  try {
    if (error) {
      console.error("[AUTH CALLBACK] OAuth provider error:", error, error_description)
      return NextResponse.redirect(
        SITE_URL + "/login?error=" + encodeURIComponent(error_description || error)
      )
    }

    if (code) {
      console.log("[AUTH CALLBACK] Exchange code for session...")
      const supabase = await createClient()
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error("[AUTH CALLBACK] Exchange error:", exchangeError.message, exchangeError.status, exchangeError.code)
        
        if (exchangeError.code === "flow_state_not_found") {
          console.warn("[AUTH CALLBACK] Flow state not found - redirecting to login to retry")
          return NextResponse.redirect(SITE_URL + "/login?message=Please try signing in again")
        }
        
        return NextResponse.redirect(
          SITE_URL + "/login?error=" + encodeURIComponent(exchangeError.message)
        )
      }

      console.log("[AUTH CALLBACK] Session exchange successful:", {
        userId: data?.user?.id,
        email: data?.user?.email
      })
      
      console.log("[AUTH CALLBACK] Redirecting to:", SITE_URL + "/")
      return NextResponse.redirect(SITE_URL + "/")
    }

    console.warn("[AUTH CALLBACK] Called without code or error")
    return NextResponse.redirect(SITE_URL + "/login")
    
  } catch (error: any) {
    console.error("[AUTH CALLBACK] Exception:", error.message, error.stack)
    return NextResponse.redirect(
      SITE_URL + "/login?error=" + encodeURIComponent("Authentication failed. Please try again.")
    )
  }
}
