'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Plus,
  X,
  MoreHorizontal,
  Trash2,
  Check,
  Calendar,
  Rocket,
  ChevronRight,
} from 'lucide-react'

interface Project {
  id: string
  title: string
  description: string | null
  status: string
  progress?: number
  task_count?: number
  tasks_done?: number
}

interface Task {
  id: string
  title: string
  status: string
  due_date: string | null
  project_id: string | null
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [addTaskTitle, setAddTaskTitle] = useState('')
  const [addTaskDue, setAddTaskDue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dropdownId, setDropdownId] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    const res = await fetch('/light/api/projects')
    if (!res.ok) return
    const data = await res.json()
    setProjects(Array.isArray(data) ? data : [])
  }, [])

  const loadTasks = useCallback(async () => {
    const res = await fetch('/light/api/tasks?limit=500')
    if (!res.ok) return
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadProjects(), loadTasks()])
    setLoading(false)
  }, [loadProjects, loadTasks])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const projectsWithCounts = projects.map((p) => {
    const projectTasks = tasks.filter((t) => t.project_id === p.id)
    const done = projectTasks.filter((t) => t.status === 'done').length
    const total = projectTasks.length
    const progress = total ? Math.round((done / total) * 100) : 0
    return {
      ...p,
      task_count: total,
      tasks_done: done,
      progress,
    }
  })

  const currentProject = detailId ? projectsWithCounts.find((p) => p.id === detailId) : null
  const detailTasks = detailId ? tasks.filter((t) => t.project_id === detailId) : []

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/light/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newName.trim(), description: newDesc.trim() || null }),
      })
      if (res.ok) {
        const created = await res.json()
        setNewName('')
        setNewDesc('')
        setShowCreateModal(false)
        await loadAll()
        setDetailId(created.id)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteProject(id: string) {
    if (!confirm('Hapus project ini? Task di dalamnya tidak dihapus.')) return
    setDropdownId(null)
    const res = await fetch(`/light/api/projects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      if (detailId === id) setDetailId(null)
      await loadAll()
    }
  }

  async function addTaskToProject() {
    if (!detailId || !addTaskTitle.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/light/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addTaskTitle.trim(),
          status: 'todo',
          project_id: detailId,
          priority: 'medium',
          domain: 'work',
        }),
      })
      if (res.ok) {
        setAddTaskTitle('')
        setAddTaskDue('')
        await loadTasks()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleTask(task: Task) {
    const next = task.status === 'done' ? 'todo' : 'done'
    await fetch('/light/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, status: next }),
    })
    await loadTasks()
  }

  async function removeTask(taskId: string) {
    await fetch(`/light/api/tasks/${taskId}`, { method: 'DELETE' })
    await loadTasks()
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="h-10 w-64 bg-muted rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-card border border-border rounded-3xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1">Kelola project dan task per project.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {projectsWithCounts.map((project, i) => (
          <div
            key={project.id}
            onClick={() => setDetailId(project.id)}
            className={cn(
              'relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl transition-all cursor-pointer group overflow-hidden border',
              i === 0 && projectsWithCounts.length > 0
                ? 'bg-gradient-to-br from-primary to-purple-600 text-white border-transparent shadow-xl shadow-primary/20'
                : 'bg-card border-border hover:border-primary/30 hover:shadow-lg'
            )}
          >
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-3 rounded-2xl',
                      i === 0 ? 'bg-white/20' : 'bg-primary/10 text-primary'
                    )}
                  >
                    <Rocket className={cn('w-5 h-5', i === 0 ? 'text-white' : 'text-primary')} />
                  </div>
                  <div>
                    <h3 className={cn('font-semibold', i === 0 ? 'text-white' : 'text-foreground')}>
                      {project.title}
                    </h3>
                    <span
                      className={cn(
                        'text-xs font-medium uppercase',
                        i === 0 ? 'text-white/80' : 'text-muted-foreground'
                      )}
                    >
                      {project.status}
                    </span>
                  </div>
                </div>
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDropdownId(dropdownId === project.id ? null : project.id)
                    }}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-black/10 hover:text-foreground"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {dropdownId === project.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setDropdownId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden">
                        <button
                          onClick={() => deleteProject(project.id)}
                          className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {project.description && (
                <p
                  className={cn(
                    'text-sm line-clamp-2 mb-4 flex-1',
                    i === 0 ? 'text-white/90' : 'text-muted-foreground'
                  )}
                >
                  {project.description}
                </p>
              )}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className={i === 0 ? 'text-white/80' : 'text-muted-foreground'}>
                    Progress
                  </span>
                  <span className={cn('font-medium', i === 0 ? 'text-white' : 'text-primary')}>
                    {project.progress ?? 0}%
                  </span>
                </div>
                <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', i === 0 ? 'bg-white/60' : 'bg-primary')}
                    style={{ width: `${project.progress ?? 0}%` }}
                  />
                </div>
                <p className={cn('text-xs', i === 0 ? 'text-white/70' : 'text-muted-foreground')}>
                  {project.tasks_done ?? 0}/{project.task_count ?? 0} tasks
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-1 text-sm font-medium text-primary">
                <span>Buka</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
        <button
          onClick={() => setShowCreateModal(true)}
          className="border-2 border-dashed border-border rounded-3xl p-6 flex flex-col items-center justify-center min-h-[200px] text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors"
        >
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Plus className="w-6 h-6" />
          </div>
          <span className="font-medium text-sm">New Project</span>
        </button>
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="bg-card border border-border rounded-3xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold">New Project</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={createProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Nama project
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Launch V1"
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Deskripsi (opsional)
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Tujuan project..."
                  rows={3}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted font-medium text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || submitting}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? '...' : 'Buat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {currentProject && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailId(null)} />
          <div className="relative w-full max-w-lg h-full bg-card border-l border-border shadow-2xl flex flex-col animate-slide-up">
            <div className="p-6 border-b border-border">
              <div className="flex justify-between items-start">
                <div>
                  <span className="inline-block px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold uppercase mb-2">
                    {currentProject.status}
                  </span>
                  <h2 className="text-xl font-bold text-foreground">{currentProject.title}</h2>
                  {currentProject.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {currentProject.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setDetailId(null)}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold text-primary">{currentProject.progress ?? 0}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${currentProject.progress ?? 0}%` }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Task di project ini
              </h3>
              <div className="space-y-2">
                {detailTasks.map((task) => {
                  const done = task.status === 'done'
                  return (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-muted/30 group"
                    >
                      <button
                        onClick={() => toggleTask(task)}
                        className={cn(
                          'mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0',
                          done
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-muted-foreground/40 hover:border-primary'
                        )}
                      >
                        {done && <Check className="w-3 h-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            done ? 'line-through text-muted-foreground' : 'text-foreground'
                          )}
                        >
                          {task.title}
                        </p>
                        {task.due_date && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(task.due_date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive rounded transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
                {detailTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Belum ada task. Tambah di bawah.
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/20">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  addTaskToProject()
                }}
                className="flex flex-col gap-3"
              >
                <input
                  type="text"
                  value={addTaskTitle}
                  onChange={(e) => setAddTaskTitle(e.target.value)}
                  placeholder="Nama task..."
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={addTaskDue}
                    onChange={(e) => setAddTaskDue(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    disabled={!addTaskTitle.trim() || submitting}
                    className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting ? '...' : 'Tambah'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
