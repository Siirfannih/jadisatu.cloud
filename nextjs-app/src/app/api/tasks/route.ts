import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") || "10"
    const status = searchParams.get("status")
    const project_id = searchParams.get("project_id")

    let query = supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(parseInt(limit, 10))

    if (project_id) query = query.eq("project_id", project_id)
    if (status && status !== "active") {
      query = query.eq("status", status)
    }
    if (status === "active") {
      query = query.in("status", ["todo", "in_progress"])
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching tasks:", error)
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
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
    const { title, status, assignee, project_id, priority, domain } = body
    
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: String(title),
        status: status || "todo",
        assignee: assignee || "me",
        project_id: project_id || null,
        priority: priority || "medium",
        domain: domain || "personal",
        user_id: user.id,  // Set user_id from authenticated user
      })
      .select()
      .single()
      
    if (error) throw error
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, status } = body

    const { data, error } = await supabase
      .from("tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)  // Ensure user can only update their own tasks
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}
