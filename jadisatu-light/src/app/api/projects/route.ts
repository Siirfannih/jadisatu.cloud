import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("projects")
      .select("id, title, description, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      
    if (error) throw error
    
    const mapped = (data ?? []).map(p => ({ ...p, name: p.title }))
    
    return NextResponse.json(mapped)
  } catch (e) {
    console.error("Error fetching projects:", e)
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
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
    const { name, title, description, status } = body
    
    const projectTitle = title || name
    if (!projectTitle) {
      return NextResponse.json({ error: "name or title required" }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from("projects")
      .insert({
        title: projectTitle,
        description: description || null,
        status: status || "active",
        user_id: user.id,
      })
      .select()
      .single()
      
    if (error) throw error
    
    return NextResponse.json({ ...data, name: data.title })
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
