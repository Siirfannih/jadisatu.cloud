import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("projects")
      .select("id, name, description, status")
      .eq("user_id", user.id)  // Filter by user_id
      .order("created_at", { ascending: false })
      
    if (error) throw error
    
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error("Error fetching projects:", e)
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, status } = body
    
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        description: description || null,
        status: status || "active",
        user_id: user.id,  // Set user_id from authenticated user
      })
      .select()
      .single()
      
    if (error) throw error
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
