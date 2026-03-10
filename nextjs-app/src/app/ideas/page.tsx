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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ideas & Notes</h1>
          <p className="text-muted-foreground">Capture everything, organize later.</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-lg">
          <button onClick={() => setViewMode("grid")} className={cn("p-2 rounded-md transition-colors", viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
            <LayoutGrid size={18} />
          </button>
          <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-md transition-colors", viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
        <div className="relative bg-card border border-border rounded-xl p-2 flex items-center gap-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/50 transition-all">
          <Plus className="text-muted-foreground ml-2" size={20} />
          <input
            type="text"
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addIdea()}
            placeholder="Capture a quick idea... (Press Enter to save, use #tags)"
            className="flex-1 bg-transparent border-none outline-none py-3 text-lg placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search ideas..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-full pl-9 pr-4 py-1.5 text-sm outline-none focus:border-primary transition-colors" />
        </div>
      </div>

      <div className={cn("grid gap-4", viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1")}>
        {filtered.map((idea) => (
          <div key={idea.id} className="group bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
            <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">{idea.title}</h3>
            {viewMode === "grid" && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{idea.content}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {idea.tags?.map(tag => (
                <span key={tag} className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground font-medium">#{tag}</span>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
              <span>{idea.source === "manual" ? "You" : idea.source}</span>
              <span>{new Date(idea.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
