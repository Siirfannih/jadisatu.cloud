'use client'

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Folder } from "lucide-react"

interface Project {
  id: string
  title: string
  description: string
  status: string
  color: string
  task_count?: number
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    const { data: projectsData } = await supabase.from("projects").select("*").order("created_at")
    if (!projectsData) return
    const withCounts = await Promise.all(projectsData.map(async (p) => {
      const { count } = await supabase.from("tasks").select("*", { count: "exact", head: true }).eq("project_id", p.id).neq("status", "done")
      return { ...p, task_count: count || 0 }
    }))
    setProjects(withCounts)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Overview of all active projects.</p>
        </div>
        <button className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project, i) => (
          <div key={project.id}
            className={cn(
              "relative p-6 rounded-3xl transition-all cursor-pointer group overflow-hidden",
              i === 0 ? "bg-gradient-to-br from-primary to-purple-600 text-white shadow-xl shadow-primary/20" : "bg-card hover:bg-muted/30 border border-border hover:shadow-lg"
            )}>
            <div className={cn("absolute top-0 left-0 w-1/2 h-16 opacity-10 rounded-br-3xl", i === 0 ? "bg-white" : "bg-foreground")} />
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-8">
                <div className={cn("p-3 rounded-2xl", i === 0 ? "bg-white/20 backdrop-blur-sm" : "bg-muted shadow-sm")}>
                  <Folder size={24} className={i === 0 ? "text-white" : "text-foreground"} />
                </div>
                <span className={cn("text-xs font-bold px-2 py-1 rounded-lg uppercase",
                  project.status === "active" ? (i === 0 ? "bg-white/20 text-white" : "bg-green-500/10 text-green-400") :
                  "bg-yellow-500/10 text-yellow-400"
                )}>{project.status}</span>
              </div>
              <div className="mt-auto">
                <h3 className={cn("text-lg font-bold mb-1", i === 0 ? "text-white" : "text-foreground")}>{project.title}</h3>
                <p className={cn("text-sm mb-2", i === 0 ? "text-blue-100" : "text-muted-foreground")}>{project.description}</p>
                <p className={cn("text-xs font-medium", i === 0 ? "text-blue-100" : "text-muted-foreground/70")}>{project.task_count} open tasks</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
