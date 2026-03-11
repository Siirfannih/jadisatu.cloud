'use client'

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Plus, Calendar, Flag } from "lucide-react"

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
  domain?: string
  assignee?: string
  due_date: string | null
  project_id: string | null
}

export default function Kanban() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [adding, setAdding] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState("")
  const [newTaskDomain, setNewTaskDomain] = useState("work")
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    const res = await fetch('/light/api/tasks?limit=200')
    if (!res.ok) return
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
  }

  async function addTask(status: string) {
    if (!newTitle.trim()) return
    const domain = newTaskDomain || 'work'
    const res = await fetch('/light/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), status, priority: 'medium', domain }),
    })
    if (res.ok) {
      const created = await res.json()
      setTasks(prev => [created, ...prev])
      setNewTitle("")
      setAdding(null)
    }
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("taskId", id)
    e.dataTransfer.effectAllowed = "move"
    setDraggingId(id)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDropTarget(null)
  }

  async function handleDrop(e: React.DragEvent, status: string) {
    e.preventDefault()
    setDropTarget(null)
    const taskId = e.dataTransfer.getData("taskId")
    if (!taskId) return
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    try {
      await fetch('/light/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status }),
      })
    } catch {
      loadTasks()
    }
    setDraggingId(null)
  }

  function handleDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropTarget(colId)
  }

  function handleDragLeave() {
    setDropTarget(null)
  }

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kanban Board</h1>
          <p className="text-muted-foreground">Manage tasks across all projects.</p>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-4 sm:gap-6 min-w-0 pb-4">
          {COLUMNS.map(col => (
            <div
              key={col.id}
              className={cn(
                "flex-1 flex flex-col min-w-[240px] sm:min-w-[280px] bg-muted/20 rounded-xl border-2 border-border/50 transition-colors",
                dropTarget === col.id && "border-primary bg-primary/5"
              )}
              onDrop={(e) => handleDrop(e, col.id)}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
            >
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
                  <div className="bg-card border border-primary/50 p-3 rounded-lg space-y-2">
                    <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addTask(col.id); if (e.key === "Escape") setAdding(null) }}
                      placeholder="Task title..." autoFocus
                      className="w-full bg-transparent outline-none text-sm" />
                    <select value={newTaskDomain} onChange={(e) => setNewTaskDomain(e.target.value)}
                      className="w-full bg-muted border border-border rounded px-2 py-1 text-xs text-foreground">
                      <option value="work">Work</option>
                      <option value="learn">Learn</option>
                      <option value="business">Business</option>
                      <option value="personal">Personal</option>
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => addTask(col.id)} className="text-xs bg-primary text-white px-3 py-1 rounded">Add</button>
                      <button onClick={() => setAdding(null)} className="text-xs text-muted-foreground px-3 py-1">Cancel</button>
                    </div>
                  </div>
                )}
                {tasks.filter(t => t.status === col.id).map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "bg-card border border-border p-4 rounded-lg shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing group",
                      draggingId === task.id && "opacity-50"
                    )}
                  >
                    <h4 className="font-medium text-sm mb-2 leading-snug">{task.title}</h4>
                    {(task.domain || task.priority) && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {task.domain && (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded capitalize",
                            task.domain === "work" ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" :
                            task.domain === "learn" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                            task.domain === "business" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                            "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                          )}>{task.domain}</span>
                        )}
                        <div className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded",
                          task.priority === "high" || task.priority === "urgent" ? "text-red-400 bg-red-400/10" :
                          task.priority === "medium" ? "text-yellow-400 bg-yellow-400/10" : "text-blue-400 bg-blue-400/10"
                        )}><Flag size={10} /> {task.priority}</div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                          (task.assignee || "me") === "me" ? "bg-primary/20 text-primary" : "bg-purple-500/20 text-purple-500"
                        )}>{(task.assignee || "me").charAt(0).toUpperCase()}</div>
                      </div>
                      {task.due_date && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Calendar size={10} /> {new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
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
