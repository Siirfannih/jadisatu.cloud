'use client'

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-browser"
import { cn } from "@/lib/utils"
import { Search, Plus, LayoutGrid, List as ListIcon, Tag, X } from "lucide-react"

interface Idea {
  id: string
  title: string
  content: string
  tags: string[]
  source: string
  status: string
  created_at: string
}

export default function Ideas() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [newIdea, setNewIdea] = useState("")
  const supabase = createClient()

  useEffect(() => { loadIdeas() }, [])

  async function loadIdeas() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from("ideas").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false })
    if (data) setIdeas(data)
  }

  async function addIdea() {
    if (!newIdea.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const tags = newIdea.match(/#\w+/g)?.map(t => t.slice(1)) || []
    const title = newIdea.replace(/#\w+/g, "").trim()
    await supabase.from("ideas").insert({ title, tags, source: "manual", user_id: user.id })
    setNewIdea("")
    loadIdeas()
  }

  const filtered = ideas.filter(i =>
    i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Ideas & Notes</h1>
          <p className="text-muted-foreground text-sm mt-1">Capture everything, organize later.</p>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 border border-border p-1 rounded-xl">
          <button onClick={() => setViewMode("grid")} className={cn("p-2 rounded-lg transition-colors", viewMode === "grid" ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <LayoutGrid size={18} />
          </button>
          <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-lg transition-colors", viewMode === "list" ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl blur-xl opacity-50 pointer-events-none" />
        <div className="relative bg-card border border-border rounded-2xl p-3 flex items-center gap-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 transition-all">
          <Plus className="text-muted-foreground shrink-0" size={20} />
          <input
            type="text"
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addIdea()}
            placeholder="Capture a quick idea... (Enter to save, use #tags)"
            className="flex-1 min-w-0 bg-transparent border-none outline-none py-2 text-base placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search ideas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          />
        </div>
      </div>

      <div className={cn("grid gap-4", viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1")}>
        {filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 rounded-2xl border border-dashed border-border bg-muted/20">
            <Tag className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground text-center">
              {searchQuery ? "No ideas match your search." : "No ideas yet. Add one above."}
            </p>
          </div>
        ) : (
          filtered.map((idea) => (
            <div key={idea.id} className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
              <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{idea.title}</h3>
              {viewMode === "grid" && idea.content && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{idea.content}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {idea.tags?.map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-1 rounded-lg bg-muted text-muted-foreground font-medium">#{tag}</span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                <span className="capitalize">{idea.source === "manual" ? "You" : idea.source}</span>
                <span>{new Date(idea.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
