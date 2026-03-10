'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { cn } from '@/lib/utils'
import {
  Plus, Search, Filter, CheckCircle2, Circle,
  Trash2, Flag, ArrowUpDown, X
} from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  domain: string
  project_id: string | null
  due_date: string | null
  created_at: string
}

const STATUS_OPTIONS = ['backlog', 'todo', 'in-progress', 'review', 'done']
const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low']
const DOMAIN_OPTIONS = ['work', 'learn', 'business', 'personal']

const STATUS_STYLE: Record<string, string> = {
  backlog: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  todo: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'in-progress': 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  review: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  done: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterDomain, setFilterDomain] = useState('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'priority'>('created_at')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newDomain, setNewDomain] = useState('personal')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const supabase = createClient()

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setTasks(data)
  }

  async function addTask() {
    if (!newTitle.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('tasks').insert({
      title: newTitle,
      status: 'todo',
      priority: newPriority,
      domain: newDomain,
      user_id: user.id,
    })
    setNewTitle('')
    setShowAddForm(false)
    loadTasks()
  }

  async function updateStatus(id: string, status: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('tasks').update({ status }).eq('id', id).eq('user_id', user.id)
    setTasks(tasks.map(t => t.id === id ? { ...t, status } : t))
  }

  async function updateTitle(id: string) {
    if (!editTitle.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('tasks').update({ title: editTitle }).eq('id', id).eq('user_id', user.id)
    setTasks(tasks.map(t => t.id === id ? { ...t, title: editTitle } : t))
    setEditingId(null)
  }

  async function deleteTask(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id)
    setTasks(tasks.filter(t => t.id !== id))
  }

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

  const filtered = tasks
    .filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false
      if (filterDomain !== 'all' && t.domain !== filterDomain) return false
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'priority') return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const counts = {
    all: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    'in-progress': tasks.filter(t => t.status === 'in-progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Manage all your tasks in one place.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors text-sm"
        >
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: counts.all, color: 'text-foreground' },
          { label: 'To Do', value: counts.todo, color: 'text-blue-500' },
          { label: 'In Progress', value: counts['in-progress'], color: 'text-yellow-500' },
          { label: 'Done', value: counts.done, color: 'text-green-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Task title..."
            autoFocus
            className="flex-1 bg-muted border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
            className="bg-muted border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={newDomain} onChange={(e) => setNewDomain(e.target.value)}
            className="bg-muted border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
            {DOMAIN_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={addTask} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90">Add</button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
          <option value="all">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
          <option value="all">All Priority</option>
          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)}
          className="bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
          <option value="all">All Domains</option>
          {DOMAIN_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button
          onClick={() => setSortBy(sortBy === 'created_at' ? 'priority' : 'created_at')}
          className="flex items-center gap-1 px-3 py-2 bg-card border border-border rounded-xl text-sm hover:bg-muted transition-colors"
        >
          <ArrowUpDown size={14} /> {sortBy === 'priority' ? 'Priority' : 'Date'}
        </button>
      </div>

      {/* Task List */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(task => (
              <div key={task.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors group">
                <button onClick={() => updateStatus(task.id, task.status === 'done' ? 'todo' : 'done')}>
                  {task.status === 'done' ? (
                    <CheckCircle2 size={20} className="text-green-500" />
                  ) : (
                    <Circle size={20} className="text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  {editingId === task.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') updateTitle(task.id); if (e.key === 'Escape') setEditingId(null) }}
                      onBlur={() => updateTitle(task.id)}
                      autoFocus
                      className="w-full bg-transparent outline-none text-sm font-medium"
                    />
                  ) : (
                    <p
                      className={cn('text-sm font-medium cursor-pointer', task.status === 'done' && 'line-through text-muted-foreground')}
                      onDoubleClick={() => { setEditingId(task.id); setEditTitle(task.title) }}
                    >
                      {task.title}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-bold uppercase px-2 py-1 rounded-lg', STATUS_STYLE[task.status] || STATUS_STYLE.backlog)}>
                    {task.status}
                  </span>
                  <span className={cn(
                    'text-[10px] font-bold uppercase px-2 py-1 rounded-lg',
                    task.priority === 'urgent' || task.priority === 'high'
                      ? 'bg-red-500/10 text-red-500'
                      : task.priority === 'medium'
                        ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                        : 'bg-blue-500/10 text-blue-500'
                  )}>
                    {task.priority}
                  </span>
                  {task.domain && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-lg">{task.domain}</span>
                  )}
                  <select
                    value={task.status}
                    onChange={(e) => updateStatus(task.id, e.target.value)}
                    className="opacity-0 group-hover:opacity-100 text-xs bg-muted border border-border rounded-lg px-2 py-1 outline-none transition-opacity"
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded text-red-400 hover:text-red-600 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
