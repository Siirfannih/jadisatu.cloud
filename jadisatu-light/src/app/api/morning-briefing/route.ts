import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("morning_briefings")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .single()

    if (error && error.code !== "PGRST116") throw error

    return NextResponse.json(data || null)
  } catch (error) {
    console.error("Error fetching morning briefing:", error)
    return NextResponse.json({ error: "Failed to fetch morning briefing" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { energy, focus, priority, blocker } = body
    const today = new Date().toISOString().split("T")[0]

    const { data: briefingData, error: briefingError } = await supabase
      .from("morning_briefings")
      .upsert({
        date: today,
        energy_level: energy,
        focus_domain: focus,
        priority_task: priority,
        blockers: blocker,
        user_id: user.id,
      }, {
        onConflict: "date,user_id"
      })
      .select()
      .single()

    if (briefingError) throw briefingError

    return NextResponse.json({ success: true, data: briefingData })
  } catch (error) {
    console.error("Error saving morning briefing:", error)
    return NextResponse.json({ error: "Failed to save morning briefing" }, { status: 500 })
  }
}
