import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function POST() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user already has domains
    const { data: existingDomains } = await supabase
      .from("domains")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)

    if (existingDomains && existingDomains.length > 0) {
      return NextResponse.json({ message: "User already initialized" })
    }

    // Create default domains
    const defaultDomains = [
      { name: "work", display_name: "Work", icon: "Briefcase", color: "blue" },
      { name: "learn", display_name: "Learn", icon: "GraduationCap", color: "purple" },
      { name: "business", display_name: "Business", icon: "TrendingUp", color: "green" },
      { name: "personal", display_name: "Personal", icon: "Heart", color: "pink" }
    ]

    const domainsToInsert = defaultDomains.map(d => ({
      ...d,
      user_id: user.id
    }))

    const { error: domainsError } = await supabase
      .from("domains")
      .upsert(domainsToInsert, { onConflict: 'name', ignoreDuplicates: true })

    if (domainsError) throw domainsError

    return NextResponse.json({ message: "User initialized successfully" })
  } catch (error) {
    console.error("Error initializing user:", error)
    return NextResponse.json({ error: "Failed to initialize user" }, { status: 500 })
  }
}
