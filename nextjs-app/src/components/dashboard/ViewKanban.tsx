'use client'

import { useState, useEffect } from 'react'
import { Plus, MoreHorizontal, Flag, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const COLUMNS = [
  { id: 'backlog', title: 'Backlog', dot: 'bg-gray-500' },
  { id: 'todo', title: 'To Do', dot: 'bg-learn' },
  { id: 'in-progress', title: 'In Progress', dot: 'bg-work' },
  { id: 'review', title: 'Review', dot: 'bg-personal' },
  { id: 'done', title: 'Done', dot: 'bg-success' },
]

type Task = {
  id: string
  title: string
  status: string
  priority?: string
  assignee?: string
  due_date?: string
  project_id?: string
}

export default function ViewKanban() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [addingColumn, setAddingColumn] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    loadTasks()
  }, [])

  async function loadTasks() {
    setLoading(true)
    try {
      const res = await fetch('/light/api/tasks?limit=200')
      if (res.ok) {
        const data = await res.json()
        setTasks(Array.isArray(data) ? data : data?.tasks ?? [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function addTask(status: string) {
    if (!newTitle.trim()) return
    try {
      const res = await fetch('/light/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), status, assignee: 'Irfan' }),
      })
      if (res.ok) {
        setNewTitle('')
        setAddingColumn(null)
        loadTasks()
      }
    } catch (e) {
      console.error(e)
    }
  }

  async function moveTask(taskId: string, newStatus: string) {
    try {
      const res = await fetch('/light/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      })
      if (res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const getTasksByColumn = (columnId: string) => {
    const statusMatches: Record<string, string[]> = {
      backlog: ['backlog'],
      todo: ['todo'],
      'in-progress': ['in-progress', 'in_progress'],
      review: ['review'],
      done: ['done'],
    }
    const allowed = statusMatches[columnId] ?? [columnId]
    return tasks.filter((t) => allowed.includes(t.status))
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Task Board</h2>
          <p className="text-sm text-gray-500">To-do per project. Drag or move tasks between columns.</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto custom-scroll pb-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {COLUMNS.map((col) => {
          const columnTasks = getTasksByColumn(col.id)
          return (
            <div
              key={col.id}
              className="kanban-col w-80 flex flex-col flex-shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const taskId = e.dataTransfer.getData('taskId')
                if (taskId) moveTask(taskId, col.id)
              }}
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', col.dot)} />
                  <span className="font-semibold text-white text-sm">{col.title}</span>
                  <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => { setAddingColumn(col.id); setNewTitle('') }}
                  className="text-gray-500 hover:text-white transition-all"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scroll">
                {addingColumn === col.id && (
                  <div className="bg-white/5 border border-accent/30 p-3 rounded-xl">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addTask(col.id)
                        if (e.key === 'Escape') setAddingColumn(null)
                      }}
                      placeholder="Task title..."
                      className="w-full bg-transparent outline-none text-sm text-white placeholder-gray-500 mb-2"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={() => addTask(col.id)} className="text-xs bg-accent text-white px-3 py-1.5 rounded-lg">
                        Add
                      </button>
                      <button onClick={() => setAddingColumn(null)} className="text-xs text-gray-400 px-3 py-1.5">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                    className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-work/30 transition-all cursor-grab active:cursor-grabbing group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded',
                        task.status === 'in-progress' ? 'bg-work/20 text-work-light' : 'bg-white/10 text-gray-400'
                      )}>
                        {task.priority ?? 'medium'}
                      </span>
                      <button className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white">
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                    <h4 className="text-sm font-medium text-white mb-2 leading-snug">{task.title}</h4>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} /> {task.due_date}
                        </span>
                      )}
                      <span className="text-gray-500">{task.assignee ?? '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
