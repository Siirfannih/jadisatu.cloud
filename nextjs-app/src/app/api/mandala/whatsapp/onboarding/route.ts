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

export async function GET() {
  try {
    const authSupabase = await createServerClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenantId = await getOrCreateTenant(user)
    const supabase = getServiceSupabase()

    const { data } = await supabase
      .from('mandala_tenants')
      .select('onboarding_status, onboarding_data, owner_verified')
      .eq('id', tenantId)
      .single()

    if (!data) {
      return NextResponse.json({ status: 'pending', step: 0, total: 7 })
    }

    const oData = (data.onboarding_data || { step: 0 }) as { step?: number; answers?: Record<string, string> }

    return NextResponse.json({
      status: data.onboarding_status || 'pending',
      step: oData.step || 0,
      total: 7,
      owner_verified: data.owner_verified || false,
      answers: data.onboarding_status === 'completed' ? oData.answers : undefined,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/mandala/whatsapp/onboarding
 * Save business profile from dashboard form (Hybrid Onboarding Step 1)
 * Then trigger WA deep-dive questions (Step 2)
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

    if (body.action === 'save_business_profile') {
      const { business_name, category, products, price_range, communication_style } = body

      if (!business_name || !category || !products) {
        return NextResponse.json({ error: 'business_name, category, products required' }, { status: 400 })
      }

      // Save to onboarding_data
      const onboardingData = {
        step: 5, // Form covers first 5 of 7 questions
        business_profile: { business_name, category, products, price_range, communication_style },
        answers: {
          nama_bisnis: business_name,
          bidang_bisnis: category,
          produk_utama: products,
          kisaran_harga: price_range || 'Belum diisi',
          gaya_komunikasi: communication_style || 'ramah',
        },
      }

      await supabase.from('mandala_tenants').update({
        onboarding_data: onboardingData,
        onboarding_status: 'profile_saved',
      }).eq('id', tenantId)

      // Get owner_whatsapp for WA deep-dive questions
      const { data: tenant } = await supabase
        .from('mandala_tenants')
        .select('owner_whatsapp')
        .eq('id', tenantId)
        .single()

      // Send deep-dive questions via WhatsApp (Step 2)
      if (tenant?.owner_whatsapp) {
        try {
          await fetch(`${ENGINE_URL}/api/wa/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant: tenantId,
              to: tenant.owner_whatsapp,
              message: `Terima kasih sudah isi profil bisnis *${business_name}*! 🎉\n\nAku butuh 2 info lagi biar makin jago handle customer kamu:\n\n1️⃣ Ada hal yang *TIDAK BOLEH* aku bilang ke customer? (misal: jangan sebut harga kompetitor, jangan janji garansi)\n\n2️⃣ Ada *promo/diskon* yang sedang jalan?\n\nReply langsung di sini ya! 😊`,
            }),
          })

          await supabase.from('mandala_tenants').update({
            onboarding_status: 'wa_deepdive',
          }).eq('id', tenantId)
        } catch {
          // WA send failed, but profile saved — that's OK
        }
      }

      // Create notification
      await supabase.from('mandala_notifications').insert({
        tenant_id: tenantId,
        type: 'onboarding',
        title: 'Profil bisnis tersimpan ✅',
        body: `${business_name} (${category}) — Mandala sedang mempelajari bisnis kamu.`,
      })

      return NextResponse.json({ success: true, message: 'Business profile saved' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
