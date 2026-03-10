'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import {
  Target, Activity, CheckCircle2, Circle, Trash2, Plus,
  Briefcase, GraduationCap, DollarSign,
  User, Bell, LogOut, ChevronRight, Clock,
  LayoutDashboard
} from 'lucide-react'

type UserType = {
  id: string
  email?: string
  user_metadata?: { full_name?: string; avatar_url?: string }
}

type Task = {
  id: string; title: string; status: string; domain: string
  priority: string; project_id: string | null; created_at: string; updated_at: string
}

type Domain = {
  id: string; name: string; display_name: string; color: string | null
  icon: string | null; total_tasks: number; completed_tasks: number; progress_percentage: number
}

type Project = {
  id: string; name: string; description: string | null; status: string; domain: string
}

type ActivityItem = {
  id: string; type: string; description: string; created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<UserType | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)

  useEffect(() => { checkUser() }, [])

  async function checkUser() {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser()
      if (error || !authUser) { router.push('/login'); return }
      setUser(authUser)
      await loadDashboardData()
    } catch { router.push('/login') }
  }

  async function loadDashboardData() {
    setLoading(true)
    try {
      const [tasksRes, domainsRes, projectsRes, activitiesRes] = await Promise.all([
        fetch('/light/api/tasks?status=active&limit=100'),
        fetch('/light/api/domains'),
        fetch('/light/api/projects'),
        fetch('/light/api/activities?limit=5')
      ])
      if (tasksRes.ok) { const d = await tasksRes.json(); setTasks(Array.isArray(d) ? d : []) }
      if (domainsRes.ok) { const d = await domainsRes.json(); setDomains(Array.isArray(d) ? d : []) }
      if (projectsRes.ok) { const d = await projectsRes.json(); setProjects(Array.isArray(d) ? d : []) }
      if (activitiesRes.ok) { const d = await activitiesRes.json(); setActivities(Array.isArray(d) ? d : []) }
    } catch (e) { console.error('Error loading dashboard data:', e) }
    finally { setLoading(false) }
  }

  async function handleToggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    try {
      const res = await fetch('/light/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId, status: newStatus }) })
      if (!res.ok) throw new Error('Failed')
      await loadDashboardData()
    } catch { setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: currentStatus } : t)) }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return
    setTasks(prev => prev.filter(t => t.id !== taskId))
    try { await fetch('/light/api/tasks/' + taskId, { method: 'DELETE' }) } catch { await loadDashboardData() }
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    try {
      const res = await fetch('/light/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTaskTitle, status: 'todo', priority: 'medium', domain: 'personal' }) })
      if (!res.ok) throw new Error('Failed')
      setNewTaskTitle('')
      await loadDashboardData()
    } catch (e) { console.error('Error:', e) }
    finally { setAddingTask(false) }
  }

  async function handleUpdateTaskStatus(taskId: string, status: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    try { await fetch('/light/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId, status }) }) } catch {}
    await loadDashboardData()
  }

  async function handleLogout() {
    try { await supabase.auth.signOut({ scope: 'local' }) } catch {}
    window.location.href = '/light/login'
  }

  const getDomainIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'work': return <Briefcase className="w-5 h-5" />
      case 'learn': return <GraduationCap className="w-5 h-5" />
      case 'business': return <DollarSign className="w-5 h-5" />
      case 'personal': return <User className="w-5 h-5" />
      default: return <Target className="w-5 h-5" />
    }
  }

  const getDomainColor = (name: string) => {
    const n = name.toLowerCase()
    if (n === 'work') return 'text-blue-600 bg-blue-50 border-blue-100'
    if (n === 'learn') return 'text-amber-600 bg-amber-50 border-amber-100'
    if (n === 'business') return 'text-emerald-600 bg-emerald-50 border-emerald-100'
    if (n === 'personal') return 'text-violet-600 bg-violet-50 border-violet-100'
    return 'text-slate-600 bg-slate-50 border-slate-100'
  }

  const focusTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'completed').slice(0, 3)
  const totalTasks = domains.reduce((sum, d) => sum + d.total_tasks, 0)
  const domainPercentages = domains.map(d => ({ ...d, pct: totalTasks > 0 ? (d.total_tasks / totalTasks) * 100 : 25 }))
  const overallBalance = domains.length > 0 ? Math.round(domains.reduce((s, d) => s + d.progress_percentage, 0) / domains.length) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 text-lg">Loading your dashboard...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 font-medium mb-1">Good morning</p>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Creator'}!
          </h1>
          <p className="text-slate-500 text-lg mt-1">
            You have <span className="text-blue-600 font-medium">{tasks.filter(t => t.status !== 'done').length} tasks</span> active
            {projects.length > 0 && <> and <span className="text-purple-600 font-medium">{projects.length} projects</span> in progress</>}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/projects')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-medium transition-colors shadow-sm">
            <Plus className="w-5 h-5" /><span>New Project</span>
          </button>
        </div>
      </div>

      {/* Life Balance */}
      {domains.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-5">
          <div className="flex justify-between text-xs uppercase tracking-wider text-slate-500 mb-3">
            <span>Life Balance</span>
            <span className="text-slate-900 font-semibold">{overallBalance}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex mb-3">
            {domainPercentages.map((d, i) => {
              let bg = 'bg-violet-500'
              if (d.name === 'work') bg = 'bg-blue-500'
              else if (d.name === 'learn') bg = 'bg-amber-500'
              else if (d.name === 'business') bg = 'bg-emerald-500'
              return <div key={i} className={bg} style={{ width: d.pct + '%' }} />
            })}
          </div>
          <div className="flex gap-4 text-xs">
            {domains.map((d) => {
              let dot = 'bg-violet-500'
              if (d.name === 'work') dot = 'bg-blue-500'
              else if (d.name === 'learn') dot = 'bg-amber-500'
              else if (d.name === 'business') dot = 'bg-emerald-500'
              return (
                <span key={d.id} className="flex items-center gap-1.5 text-slate-500">
                  <div className={'w-2 h-2 rounded-full ' + dot} />{d.display_name}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Today's Focus */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Today&apos;s Focus</h2>
              <p className="text-sm text-slate-500">{focusTasks.length} priority tasks</p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            type="text" value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            placeholder="Add a new task..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-300 text-slate-900 placeholder:text-slate-400"
            disabled={addingTask}
          />
          <button onClick={handleAddTask} disabled={addingTask || !newTaskTitle.trim()} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" />Add
          </button>
        </div>

        {focusTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No tasks yet. Add your first task above!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {focusTasks.map((task) => (
              <div key={task.id} className="group flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all">
                <button onClick={() => handleToggleTask(task.id, task.status)} className="shrink-0">
                  {task.status === 'done' || task.status === 'completed'
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    : <Circle className="w-5 h-5 text-slate-300 hover:text-blue-500" />}
                </button>
                <span className={'flex-1 text-sm ' + (task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900')}>{task.title}</span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleUpdateTaskStatus(task.id, 'in-progress')} className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs rounded-lg">Dikerjakan</button>
                  <button onClick={() => handleUpdateTaskStatus(task.id, 'backlog')} className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 text-xs rounded-lg">Ditunda</button>
                  <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Domain Cards */}
      {domains.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {domains.map((domain) => {
            const color = getDomainColor(domain.name)
            let bar = 'bg-violet-500'
            if (domain.name === 'work') bar = 'bg-blue-500'
            else if (domain.name === 'learn') bar = 'bg-amber-500'
            else if (domain.name === 'business') bar = 'bg-emerald-500'
            return (
              <div key={domain.id} className={'bg-white border p-6 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer border-slate-100 ' + color}>
                <div className="flex items-center justify-between mb-4">
                  <div className={'p-3 rounded-xl ' + color}>{getDomainIcon(domain.name)}</div>
                  <span className="text-4xl font-bold text-slate-900">{domain.progress_percentage}%</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{domain.display_name}</h3>
                <p className="text-sm text-slate-500 mb-3">{domain.completed_tasks} / {domain.total_tasks} tasks</p>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={bar} style={{ width: domain.progress_percentage + '%' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {domains.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-8 text-center">
          <LayoutDashboard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No domains yet</h3>
          <p className="text-sm text-slate-500">Domains will be created automatically when you add tasks.</p>
        </div>
      )}

      {/* Active Projects */}
      {projects.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Active Projects</h2>
            </div>
            <a href="/projects" className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 3).map((project) => (
              <div key={project.id} className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl transition-all cursor-pointer">
                <h3 className="font-semibold text-slate-900 mb-1">{project.name}</h3>
                <p className="text-sm text-slate-500 line-clamp-2">{project.description || 'No description'}</p>
                <div className="mt-3">
                  <span className={'text-xs px-2 py-1 rounded-lg ' + getDomainColor(project.domain)}>{project.domain}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {activities.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
              <Activity className="w-6 h-6 text-violet-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Recent Activity</h2>
          </div>
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">{a.description}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
