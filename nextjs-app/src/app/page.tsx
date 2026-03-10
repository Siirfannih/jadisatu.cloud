'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import {
  Target, TrendingUp, Zap, Activity,
  CheckCircle2, Circle, Play, Trash2, Plus,
  Briefcase, GraduationCap, DollarSign,
  User, Search, Bell, LogOut, ChevronRight, Clock,
  Sparkles, LayoutDashboard
} from 'lucide-react'

type User = {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
  }
}

type Task = {
  id: string
  title: string
  status: string
  domain: string
  priority: string
  project_id: string | null
  created_at: string
  updated_at: string
}

type Domain = {
  id: string
  name: string
  display_name: string
  color: string | null
  icon: string | null
  total_tasks: number
  completed_tasks: number
  progress_percentage: number
}

type Project = {
  id: string
  name: string
  description: string | null
  status: string
  domain: string
}

type ActivityItem = {
  id: string
  type: string
  description: string
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [user, setUser] = useState<User | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser()
      if (error || !authUser) { router.push('/login'); return }
      setUser(authUser)
      await loadDashboardData()
    } catch {
      router.push('/login')
    }
  }

  async function loadDashboardData() {
    setLoading(true)
    try {
      const [tasksRes, domainsRes, projectsRes, activitiesRes] = await Promise.all([
        fetch('/api/tasks?status=active&limit=100'),
        fetch('/api/domains'),
        fetch('/api/projects'),
        fetch('/api/activities?limit=5')
      ])
      if (tasksRes.ok) { const data = await tasksRes.json(); setTasks(Array.isArray(data) ? data : []) }
      if (domainsRes.ok) { const data = await domainsRes.json(); setDomains(Array.isArray(data) ? data : []) }
      if (projectsRes.ok) { const data = await projectsRes.json(); setProjects(Array.isArray(data) ? data : []) }
      if (activitiesRes.ok) { const data = await activitiesRes.json(); setActivities(Array.isArray(data) ? data : []) }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    try {
      const res = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId, status: newStatus }) })
      if (!res.ok) throw new Error('Failed')
      await loadDashboardData()
    } catch { setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: currentStatus } : t)) }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Are you sure you want to delete this task?')) return
    setTasks(prev => prev.filter(t => t.id !== taskId))
    try {
      const res = await fetch('/api/tasks/' + taskId, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
    } catch { await loadDashboardData() }
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    try {
      const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTaskTitle, status: 'todo', priority: 'medium', domain: 'personal' }) })
      if (!res.ok) throw new Error('Failed')
      setNewTaskTitle('')
      await loadDashboardData()
    } catch (error) { console.error('Error adding task:', error) }
    finally { setAddingTask(false) }
  }

  async function handleUpdateTaskStatus(taskId: string, status: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    try {
      const res = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId, status }) })
      if (!res.ok) throw new Error('Failed')
      await loadDashboardData()
    } catch { await loadDashboardData() }
  }

  async function handleLogout() {
    try { await supabase.auth.signOut({ scope: 'local' }) } catch {}
    window.location.href = '/login'
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
    if (n === 'work') return isLight ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-blue-500 bg-blue-500/10 border-blue-500/20'
    if (n === 'learn') return isLight ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
    if (n === 'business') return isLight ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    if (n === 'personal') return isLight ? 'text-violet-600 bg-violet-50 border-violet-100' : 'text-violet-500 bg-violet-500/10 border-violet-500/20'
    return isLight ? 'text-slate-600 bg-slate-50 border-slate-100' : 'text-gray-500 bg-gray-500/10 border-gray-500/20'
  }

  const focusTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'completed').slice(0, 3)
  const totalTasks = domains.reduce((sum, d) => sum + d.total_tasks, 0)
  const domainPercentages = domains.map(d => ({ ...d, percentage: totalTasks > 0 ? (d.total_tasks / totalTasks) * 100 : 25 }))
  const overallBalance = domains.length > 0 ? Math.round(domains.reduce((sum, d) => sum + d.progress_percentage, 0) / domains.length) : 0

  // Card class helper
  const cardClass = cn(
    'bg-card border border-border p-6',
    isLight ? 'rounded-3xl shadow-sm' : 'rounded-2xl'
  )
  const cardClassCompact = cn(
    'bg-card border border-border p-5',
    isLight ? 'rounded-3xl shadow-sm' : 'rounded-2xl'
  )
  const itemClass = cn(
    'p-3 transition-all',
    isLight
      ? 'bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl'
      : 'bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl'
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className={cn('text-lg', isLight ? 'text-slate-400' : 'text-muted-foreground')}>Loading your dashboard...</div>
      </div>
    )
  }

  return (
    <div className={cn('max-w-7xl mx-auto', isLight ? 'space-y-8' : 'space-y-6')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {isLight && <p className="text-slate-500 font-medium mb-1">Good morning</p>}
          <h1 className={cn(
            'font-bold',
            isLight ? 'text-4xl text-slate-900 tracking-tight' : 'text-2xl'
          )}>
            Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Creator'}!
          </h1>
          <p className={cn('text-sm', isLight ? 'text-slate-500 text-lg mt-1' : 'text-muted-foreground')}>
            {isLight ? (
              <>
                You have <span className="text-blue-600 font-medium">{tasks.filter(t => t.status !== 'done').length} tasks</span> active
                {projects.length > 0 && <> and <span className="text-purple-600 font-medium">{projects.length} projects</span> in progress</>}.
              </>
            ) : (
              new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLight ? (
            <button
              onClick={() => router.push('/projects')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-medium transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              <span>New Project</span>
            </button>
          ) : (
            <>
              <button className="p-2 rounded-xl bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="w-5 h-5" />
              </button>
              <button onClick={handleLogout} className="p-2 rounded-xl bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Life Balance */}
      {domains.length > 0 && (
        <div className={cardClassCompact}>
          <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground mb-3">
            <span>Life Balance</span>
            <span className={cn('font-semibold', isLight ? 'text-slate-900' : 'text-foreground')}>{overallBalance}%</span>
          </div>
          <div className={cn('h-2 rounded-full overflow-hidden flex mb-3', isLight ? 'bg-slate-100' : 'bg-muted')}>
            {domainPercentages.map((d, i) => {
              let bgColor = 'bg-violet-500'
              if (d.name === 'work') bgColor = 'bg-blue-500'
              else if (d.name === 'learn') bgColor = 'bg-amber-500'
              else if (d.name === 'business') bgColor = 'bg-emerald-500'
              return <div key={i} className={bgColor} style={{ width: d.percentage + '%' }} />
            })}
          </div>
          <div className="flex gap-4 text-xs">
            {domains.map((d) => {
              let dotColor = 'bg-violet-500'
              if (d.name === 'work') dotColor = 'bg-blue-500'
              else if (d.name === 'learn') dotColor = 'bg-amber-500'
              else if (d.name === 'business') dotColor = 'bg-emerald-500'
              return (
                <span key={d.id} className="flex items-center gap-1.5 text-muted-foreground">
                  <div className={'w-2 h-2 rounded-full ' + dotColor} />
                  {d.display_name}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Today's Focus */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Target className={cn('w-5 h-5', isLight ? 'text-blue-600' : 'text-primary')} />
            <h2 className={cn('font-semibold', isLight ? 'text-xl text-slate-900' : 'text-lg')}>Today&apos;s Focus</h2>
          </div>
          {focusTasks.length > 0 && (
            <span className="text-sm text-muted-foreground">{focusTasks.length} priority tasks</span>
          )}
        </div>

        <div className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              placeholder="Add a new task..."
              className={cn(
                'flex-1 px-4 py-2.5 text-sm focus:outline-none transition-colors',
                isLight
                  ? 'bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-300 text-slate-900 placeholder:text-slate-400'
                  : 'bg-white/5 border border-white/10 rounded-xl focus:border-primary/50'
              )}
              disabled={addingTask}
            />
            <button
              onClick={handleAddTask}
              disabled={addingTask || !newTaskTitle.trim()}
              className={cn(
                'px-4 py-2.5 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors',
                isLight ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary hover:bg-primary/90'
              )}
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {focusTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No tasks yet. Add your first task above!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {focusTasks.map((task) => (
              <div key={task.id} className={cn('group flex items-center gap-3', itemClass)}>
                <button onClick={() => handleToggleTask(task.id, task.status)} className="shrink-0">
                  {task.status === 'done' || task.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <Circle className={cn('w-5 h-5', isLight ? 'text-slate-300 hover:text-blue-500' : 'text-muted-foreground hover:text-primary')} />
                  )}
                </button>
                <span className={'flex-1 text-sm ' + (task.status === 'done' || task.status === 'completed' ? 'line-through text-muted-foreground' : '')}>
                  {task.title}
                </span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleUpdateTaskStatus(task.id, 'in-progress')} className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-500 text-xs rounded-lg">
                    Dikerjakan
                  </button>
                  <button onClick={() => handleUpdateTaskStatus(task.id, 'backlog')} className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-xs rounded-lg">
                    Ditunda
                  </button>
                  <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Domain Cards */}
      {domains.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {domains.map((domain) => {
            const colorClass = getDomainColor(domain.name)
            let barColor = 'bg-violet-500'
            if (domain.name === 'work') barColor = 'bg-blue-500'
            else if (domain.name === 'learn') barColor = 'bg-amber-500'
            else if (domain.name === 'business') barColor = 'bg-emerald-500'

            return (
              <div
                key={domain.id}
                className={cn(
                  'bg-card border p-5 hover:scale-[1.02] transition-all cursor-pointer',
                  isLight ? 'rounded-3xl shadow-sm border-slate-100 hover:shadow-md' : 'rounded-2xl',
                  colorClass
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={cn('p-2 rounded-xl', colorClass)}>{getDomainIcon(domain.name)}</div>
                  <span className="text-2xl font-bold">{domain.progress_percentage}%</span>
                </div>
                <h3 className="text-lg font-semibold mb-1">{domain.display_name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{domain.completed_tasks} / {domain.total_tasks} tasks</p>
                <div className={cn('w-full h-2 rounded-full overflow-hidden', isLight ? 'bg-slate-100' : 'bg-muted')}>
                  <div className={barColor} style={{ width: domain.progress_percentage + '%' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {domains.length === 0 && (
        <div className={cn(cardClass, 'text-center py-8')}>
          <LayoutDashboard className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No domains yet</h3>
          <p className="text-sm text-muted-foreground">Domains help you organize your life. They will be created automatically when you add tasks.</p>
        </div>
      )}

      {/* Active Projects */}
      {projects.length > 0 && (
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Briefcase className={cn('w-5 h-5', isLight ? 'text-blue-600' : 'text-primary')} />
              <h2 className={cn('font-semibold', isLight ? 'text-xl text-slate-900' : 'text-lg')}>Active Projects</h2>
            </div>
            <a href="/projects" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 3).map((project) => (
              <div key={project.id} className={cn(itemClass, 'p-4 cursor-pointer')}>
                <h3 className="font-semibold mb-1">{project.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{project.description || 'No description'}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className={'text-xs px-2 py-1 rounded ' + getDomainColor(project.domain)}>{project.domain}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {activities.length > 0 && (
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-4">
            <Activity className={cn('w-5 h-5', isLight ? 'text-blue-600' : 'text-primary')} />
            <h2 className={cn('font-semibold', isLight ? 'text-xl text-slate-900' : 'text-lg')}>Recent Activity</h2>
          </div>
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className={cn('flex items-start gap-3', itemClass)}>
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(activity.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Tasks */}
      {tasks.length > 3 && (
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className={cn('w-5 h-5', isLight ? 'text-blue-600' : 'text-primary')} />
              <h2 className={cn('font-semibold', isLight ? 'text-xl text-slate-900' : 'text-lg')}>All Active Tasks</h2>
            </div>
            <span className="text-sm text-muted-foreground">{tasks.filter(t => t.status !== 'done').length} remaining</span>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tasks.filter(t => t.status !== 'done' && t.status !== 'completed').map((task) => (
              <div key={task.id} className={cn('group flex items-center gap-3', itemClass)}>
                <button onClick={() => handleToggleTask(task.id, task.status)} className="shrink-0">
                  <Circle className={cn('w-5 h-5', isLight ? 'text-slate-300 hover:text-blue-500' : 'text-muted-foreground hover:text-primary')} />
                </button>
                <span className="flex-1 text-sm">{task.title}</span>
                <span className={'text-xs px-2 py-1 rounded ' + getDomainColor(task.domain)}>{task.domain}</span>
                <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
