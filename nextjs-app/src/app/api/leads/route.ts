import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stats = searchParams.get("stats")
    const category = searchParams.get("category")
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    if (stats === "true") {
      const { count: total } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })

      const today = new Date().toISOString().split("T")[0]
      const todayStart = today + "T00:00:00"
      const { count: today_new } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("scraped_at", todayStart)

      const { count: high_opportunity } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("opportunity_level", "Very High")

      const { data: scoresData } = await supabase
        .from("leads")
        .select("pain_score")
        .gt("pain_score", 0)

      const scores = scoresData?.map((d: any) => d.pain_score) || []
      const avg_pain_score = scores.length
        ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
        : 0

      const { data: categoriesData } = await supabase
        .from("leads")
        .select("category")
        .neq("category", "")
        .not("category", "is", null)

      const categories: Record<string, number> = {}
      categoriesData?.forEach((item: any) => {
        const cat = item.category
        if (cat) {
          categories[cat] = (categories[cat] || 0) + 1
        }
      })

      return NextResponse.json({
        total_collected: total || 0,
        today_new: today_new || 0,
        high_opportunity: high_opportunity || 0,
        avg_pain_score,
        categories,
        sources_active: 2,
        keywords_tracked: 15,
      })
    }

    let query = supabase
      .from("leads")
      .select("*")
      .order("pain_score", { ascending: false })
      .order("scraped_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (category && category !== "All") {
      query = query.eq("category", category)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      count: data?.length || 0,
    })
  } catch (error: any) {
    console.error("API Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing id or status" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: "Lead updated successfully",
    })
  } catch (error: any) {
    console.error("API Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
