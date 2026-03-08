import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: domains, error: domainsError } = await supabase
      .from("domains")
      .select("*")
      .eq("user_id", user.id)
      .order("name")

    if (domainsError) throw domainsError

    const domainsWithStats = await Promise.all(
      (domains || []).map(async (domain) => {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, status")
          .eq("user_id", user.id)
          .eq("domain", domain.name.toLowerCase())

        const totalTasks = tasks?.length || 0
        const completedTasks = tasks?.filter((t) => t.status === "done").length || 0
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

        return {
          ...domain,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          progress_percentage: progressPercentage,
        }
      })
    )

    return NextResponse.json(domainsWithStats)
  } catch (error) {
    console.error("Error fetching domains:", error)
    return NextResponse.json({ error: "Failed to fetch domains" }, { status: 500 })
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
    const { name, display_name, icon, color } = body
    
    if (!name || !display_name) {
      return NextResponse.json({ error: "name and display_name required" }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from("domains")
      .insert({
        name: String(name).toLowerCase().replace(/\s+/g, "_"),
        display_name: String(display_name),
        icon: icon || null,
        color: color || null,
        user_id: user.id,
      })
      .select()
      .single()
      
    if (error) throw error
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error creating domain:", error)
    return NextResponse.json({ error: "Failed to create domain" }, { status: 500 })
  }
}
