import { createClient as createServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateTenant } from '@/lib/mandala-auth'

const ENGINE_URL = process.env.MANDALA_ENGINE_URL || 'http://localhost:3100'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/**
 * POST /api/mandala/whatsapp/verify
 *
 * action: 'send_code' — generate 6-digit code, send via WA to owner's personal number
 * action: 'verify_code' — check code, mark owner as verified, trigger onboarding
 */
export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createServerClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = await getOrCreateTenant(user)
    const supabase = getServiceSupabase()
    const body = await request.json()
    const { action } = body

    if (action === 'send_code') {
      const { phone_number } = body
      if (!phone_number) {
        return NextResponse.json({ error: 'phone_number required' }, { status: 400 })
      }

      // Normalize: strip +, spaces, dashes
      const normalized = phone_number.replace(/[\s\-\+\(\)]/g, '')

      // Rate limit: 60s cooldown between send_code requests
      const { data: tenant } = await supabase
        .from('mandala_tenants')
        .select('business_whatsapp, owner_verify_expires')
        .eq('id', tenantId)
        .single()

      if (tenant?.owner_verify_expires) {
        const lastSent = new Date(tenant.owner_verify_expires).getTime() - 10 * 60 * 1000 // expires = sent + 10min
        if (Date.now() - lastSent < 60000) {
          return NextResponse.json({ error: 'Tunggu 60 detik sebelum kirim ulang.' }, { status: 429 })
        }
      }

      if (tenant?.business_whatsapp === normalized) {
        return NextResponse.json({
          error: 'Nomor ini sudah digunakan sebagai nomor bisnis Mandala. Gunakan nomor pribadi yang berbeda.',
        }, { status: 400 })
      }

      // Generate 6-digit code
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 min

      // Save code to DB
      await supabase.from('mandala_tenants').update({
        owner_whatsapp: normalized,
        owner_verify_code: code,
        owner_verify_expires: expires.toISOString(),
        owner_verified: false,
      }).eq('id', tenantId)

      // Send code via WhatsApp (using tenant's connected WA session)
      try {
        const res = await fetch(`${ENGINE_URL}/api/wa/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant: tenantId,
            to: normalized,
            message: `🔐 Kode verifikasi Mandala kamu: *${code}*\n\nMasukkan kode ini di dashboard jadisatu.cloud untuk menghubungkan nomor kamu.\n\nKode berlaku 10 menit.`,
          }),
        })

        if (!res.ok) {
          // Send failed — clear saved code so user can retry immediately
          await supabase.from('mandala_tenants').update({
            owner_verify_code: null,
            owner_verify_expires: null,
          }).eq('id', tenantId)
          const errBody = await res.json().catch(() => ({}))
          return NextResponse.json({
            error: errBody.error || 'Gagal mengirim kode. Pastikan WhatsApp bisnis sudah terkoneksi.'
          }, { status: 502 })
        }
      } catch {
        // Engine unreachable — clear saved code so user can retry
        await supabase.from('mandala_tenants').update({
          owner_verify_code: null,
          owner_verify_expires: null,
        }).eq('id', tenantId)
        return NextResponse.json({ error: 'Engine tidak tersedia. Coba lagi nanti.' }, { status: 503 })
      }

      return NextResponse.json({ success: true, message: 'Kode verifikasi dikirim ke WhatsApp' })
    }

    if (action === 'verify_code') {
      const { code } = body
      if (!code) {
        return NextResponse.json({ error: 'code required' }, { status: 400 })
      }

      const { data: tenant } = await supabase
        .from('mandala_tenants')
        .select('owner_verify_code, owner_verify_expires, owner_whatsapp, onboarding_status, owner_verify_attempts')
        .eq('id', tenantId)
        .single()

      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
      }

      if (!tenant.owner_verify_code) {
        return NextResponse.json({ error: 'Belum ada kode verifikasi. Kirim kode dulu.' }, { status: 400 })
      }

      // Rate limit: max 5 attempts
      if ((tenant.owner_verify_attempts || 0) >= 5) {
        // Invalidate code after 5 failed attempts
        await supabase.from('mandala_tenants').update({
          owner_verify_code: null,
          owner_verify_expires: null,
          owner_verify_attempts: 0,
        }).eq('id', tenantId)
        return NextResponse.json({ error: 'Terlalu banyak percobaan. Kirim ulang kode baru.' }, { status: 429 })
      }

      if (new Date() > new Date(tenant.owner_verify_expires)) {
        await supabase.from('mandala_tenants').update({
          owner_verify_code: null,
          owner_verify_expires: null,
          owner_verify_attempts: 0,
        }).eq('id', tenantId)
        return NextResponse.json({ error: 'Kode sudah expired. Kirim ulang.' }, { status: 400 })
      }

      if (tenant.owner_verify_code !== code.trim()) {
        // Increment attempt counter
        await supabase.from('mandala_tenants').update({
          owner_verify_attempts: (tenant.owner_verify_attempts || 0) + 1,
        }).eq('id', tenantId)
        const remaining = 5 - ((tenant.owner_verify_attempts || 0) + 1)
        return NextResponse.json({ error: `Kode salah. ${remaining} percobaan tersisa.` }, { status: 400 })
      }

      // Verified!
      await supabase.from('mandala_tenants').update({
        owner_verified: true,
        owner_verify_code: null,
        owner_verify_expires: null,
      }).eq('id', tenantId)

      // Create notification
      await supabase.from('mandala_notifications').insert({
        tenant_id: tenantId,
        type: 'system',
        title: 'Nomor owner terverifikasi ✅',
        body: `Nomor ${tenant.owner_whatsapp} terhubung. Mandala akan mengirim notifikasi ke nomor ini.`,
      })

      // Trigger onboarding if pending
      if (tenant.onboarding_status === 'pending' || !tenant.onboarding_status) {
        try {
          // Refresh tenant in engine so it knows owner_whatsapp
          await fetch(`${ENGINE_URL}/api/tenants/${tenantId}/refresh`, { method: 'POST' }).catch(() => {})

          // Trigger onboarding via engine
          const onboardRes = await fetch(`${ENGINE_URL}/api/owner/onboarding-invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant_id: tenantId }),
          })

          if (!onboardRes.ok) {
            // Fallback: send onboarding invite directly
            const ownerNum = tenant.owner_whatsapp
            if (ownerNum) {
              await fetch(`${ENGINE_URL}/api/wa/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tenant: tenantId,
                  to: ownerNum,
                  message: `Halo! Aku Mandala, AI sales assistant-mu 🤖\n\nNomor kamu udah terverifikasi! Sekarang aku bisa kirim update ke kamu.\n\nBiar aku bisa bantu handle customer kamu dengan baik, aku perlu kenalan dulu sama bisnis kamu.\n\nReply "oke" untuk mulai kenalan ya! (cuma 7 pertanyaan singkat)`,
                }),
              })

              await supabase.from('mandala_tenants').update({
                onboarding_status: 'wa_connected',
              }).eq('id', tenantId)
            }
          }
        } catch (err) {
          console.error('Onboarding trigger after verification failed:', err)
        }
      }

      return NextResponse.json({ success: true, verified: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('WhatsApp verify error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
