'use client'

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-browser"
import { cn } from "@/lib/utils"
import { Plus, MoreHorizontal, Calendar, Flag } from "lucide-react"

const COLUMNS = [
  { id: "backlog", title: "Backlog", color: "bg-zinc-500" },
  { id: "todo", title: "To Do", color: "bg-blue-500" },
  { id: "in-progress", title: "In Progress", color: "bg-yellow-500" },
  { id: "review", title: "Review", color: "bg-purple-500" },
  { id: "done", title: "Done", color: "bg-green-500" },
]

interface Task {
  id: string
  title: string
  status: string
  priority: string
  assignee: string
  due_date: string | null
  project_id: string | null
}

export default function Kanban() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [adding, setAdding] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState("")
  const supabase = createClient()

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from("tasks").select("*").eq("user_id", user.id).order("sort_order")
    if (data) setTasks(data)
  }

  async function addTask(status: string) {
    if (!newTitle.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from("tasks").insert({ title: newTitle, status, assignee: "Irfan", user_id: user.id })
    setNewTitle("")
    setAdding(null)
    loadTasks()
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("taskId", id)
  }

  async function handleDrop(e: React.DragEvent, status: string) {
    const taskId = e.dataTransfer.getData("taskId")
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from("tasks").update({ status }).eq("id", taskId).eq("user_id", user.id)
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status } : t))
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault() }

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kanban Board</h1>
          <p className="text-muted-foreground">Manage tasks across all projects.</p>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-6 min-w-[1200px] pb-4">
          {COLUMNS.map(col => (
            <div key={col.id} className="flex-1 flex flex-col min-w-[280px] bg-muted/20 rounded-xl border border-border/50"
              onDrop={(e) => handleDrop(e, col.id)} onDragOver={handleDragOver}>
              <div className="p-4 flex items-center justify-between border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", col.color)} />
                  <h3 className="font-semibold text-sm">{col.title}</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status === col.id).length}
                  </span>
                </div>
                <button onClick={() => { setAdding(col.id); setNewTitle("") }} className="text-muted-foreground hover:text-foreground">
                  <Plus size={16} />
                </button>
              </div>

              <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                {adding === col.id && (
                  <div className="bg-card border border-primary/50 p-3 rounded-lg">
                    <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addTask(col.id); if (e.key === "Escape") setAdding(null) }}
                      placeholder="Task title..." autoFocus
                      className="w-full bg-transparent outline-none text-sm mb-2" />
                    <div className="flex gap-2">
                      <button onClick={() => addTask(col.id)} className="text-xs bg-primary text-white px-3 py-1 rounded">Add</button>
                      <button onClick={() => setAdding(null)} className="text-xs text-muted-foreground px-3 py-1">Cancel</button>
                    </div>
                  </div>
                )}
                {tasks.filter(t => t.status === col.id).map(task => (
                  <div key={task.id} draggable onDragStart={(e) => handleDragStart(e, task.id)}
                    className="bg-card border border-border p-4 rounded-lg shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing group">
                    <h4 className="font-medium text-sm mb-3 leading-snug">{task.title}</h4>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                          task.assignee === "Irfan" ? "bg-primary/20 text-primary" : "bg-purple-500/20 text-purple-500"
                        )}>{task.assignee === "Irfan" ? "I" : "AI"}</div>
                        <div className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded",
                          task.priority === "high" || task.priority === "urgent" ? "text-red-400 bg-red-400/10" :
                          task.priority === "medium" ? "text-yellow-400 bg-yellow-400/10" : "text-blue-400 bg-blue-400/10"
                        )}><Flag size={10} /> {task.priority}</div>
                      </div>
                      {task.due_date && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Calendar size={10} /> {task.due_date}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
