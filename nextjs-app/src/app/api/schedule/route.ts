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
      .from("schedule_blocks")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("start_time")

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching schedule:", error)
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 })
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
    const { date, start_time, end_time, title, domain, type } = body
    
    if (!title || !start_time || !end_time) {
      return NextResponse.json({ error: "title, start_time, and end_time required" }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from("schedule_blocks")
      .insert({
        date: date || new Date().toISOString().split("T")[0],
        start_time,
        end_time,
        title,
        domain: domain || null,
        type: type || "task",
        user_id: user.id,
      })
      .select()
      .single()
      
    if (error) throw error
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error creating schedule block:", error)
    return NextResponse.json({ error: "Failed to create schedule block" }, { status: 500 })
  }
}
