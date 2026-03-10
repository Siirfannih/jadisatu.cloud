'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
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

type Activity = {
  id: string
  type: string
  description: string
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser()

      if (error || !authUser) {
        router.push('/login')
        return
      }

      setUser(authUser)
      await loadDashboardData()
    } catch (error) {
      console.error('Error checking user:', error)
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

      if (tasksRes.ok) {
        const data = await tasksRes.json()
        setTasks(Array.isArray(data) ? data : [])
      }

      if (domainsRes.ok) {
        const data = await domainsRes.json()
        setDomains(Array.isArray(data) ? data : [])
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json()
        setProjects(Array.isArray(data) ? data : [])
      }

      if (activitiesRes.ok) {
        const data = await activitiesRes.json()
        setActivities(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'

    setTasks(prevTasks =>
      prevTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    )

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus })
      })

      if (!response.ok) throw new Error('Failed to update task')

      await loadDashboardData()
    } catch (error) {
      console.error('Error toggling task:', error)
      setTasks(prevTasks =>
        prevTasks.map(t => t.id === taskId ? { ...t, status: currentStatus } : t)
      )
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!confirm('Are you sure you want to delete this task?')) return

    setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId))

    try {
      const response = await fetch('/api/tasks/' + taskId, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete task')
    } catch (error) {
      console.error('Error deleting task:', error)
      await loadDashboardData()
    }
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return

    setAddingTask(true)
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          status: 'todo',
          priority: 'medium',
          domain: 'personal'
        })
      })

      if (!response.ok) throw new Error('Failed to add task')

      setNewTaskTitle('')
      await loadDashboardData()
    } catch (error) {
      console.error('Error adding task:', error)
    } finally {
      setAddingTask(false)
    }
  }

  async function handleUpdateTaskStatus(taskId: string, status: string) {
    setTasks(prevTasks =>
      prevTasks.map(t => t.id === taskId ? { ...t, status } : t)
    )

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status })
      })

      if (!response.ok) throw new Error('Failed to update task')

      await loadDashboardData()
    } catch (error) {
      console.error('Error updating task:', error)
      await loadDashboardData()
    }
  }

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout error:', error)
      window.location.href = '/login'
    }
  }

  const getDomainIcon = (domainName: string) => {
    switch (domainName.toLowerCase()) {
      case 'work': return <Briefcase className="w-5 h-5" />
      case 'learn': return <GraduationCap className="w-5 h-5" />
      case 'business': return <DollarSign className="w-5 h-5" />
      case 'personal': return <User className="w-5 h-5" />
      default: return <Target className="w-5 h-5" />
    }
  }

  const getDomainColor = (domainName: string) => {
    const name = domainName.toLowerCase()
    if (name === 'work') return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
    if (name === 'learn') return 'text-amber-500 bg-amber-500/10 border-amber-500/20'
    if (name === 'business') return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    if (name === 'personal') return 'text-violet-500 bg-violet-500/10 border-violet-500/20'
    return 'text-gray-500 bg-gray-500/10 border-gray-500/20'
  }

  const focusTasks = tasks
    .filter(t => t.status !== 'done' && t.status !== 'completed')
    .slice(0, 3)

  const totalTasks = domains.reduce((sum, d) => sum + d.total_tasks, 0)
  const domainPercentages = domains.map(d => ({
    ...d,
    percentage: totalTasks > 0 ? (d.total_tasks / totalTasks) * 100 : 25
  }))

  const overallBalance = domains.length > 0
    ? Math.round(domains.reduce((sum, d) => sum + d.progress_percentage, 0) / domains.length)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground text-lg">Loading your dashboard...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Creator'}!</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-xl bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Life Balance */}
      {domains.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground mb-3">
            <span>Life Balance</span>
            <span className="text-foreground font-semibold">{overallBalance}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden flex mb-3">
            {domainPercentages.map((d, i) => {
              let bgColor = 'bg-violet-500'
              if (d.name === 'work') bgColor = 'bg-blue-500'
              else if (d.name === 'learn') bgColor = 'bg-amber-500'
              else if (d.name === 'business') bgColor = 'bg-emerald-500'

              return (
                <div key={i} className={bgColor} style={{ width: d.percentage + '%' }} />
              )
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
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Today&apos;s Focus</h2>
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
              className="flex-1 px-4 py-2.5 bg-background/50 dark:bg-white/5 border border-border/50 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-colors"
              disabled={addingTask}
            />
            <button
              onClick={handleAddTask}
              disabled={addingTask || !newTaskTitle.trim()}
              className="px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
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
              <div
                key={task.id}
                className="group flex items-center gap-3 p-3 bg-muted/30 dark:bg-white/5 hover:bg-muted/50 dark:hover:bg-white/10 border border-border/30 dark:border-white/5 rounded-xl transition-all"
              >
                <button onClick={() => handleToggleTask(task.id, task.status)} className="shrink-0">
                  {task.status === 'done' || task.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground hover:text-primary" />
                  )}
                </button>

                <span className={'flex-1 text-sm ' + (task.status === 'done' || task.status === 'completed'
                    ? 'line-through text-muted-foreground'
                    : '')}>
                  {task.title}
                </span>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleUpdateTaskStatus(task.id, 'in-progress')}
                    className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs rounded-lg"
                  >
                    Dikerjakan
                  </button>
                  <button
                    onClick={() => handleUpdateTaskStatus(task.id, 'backlog')}
                    className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs rounded-lg"
                  >
                    Ditunda
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg"
                  >
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
                className={'bg-card border rounded-2xl p-5 hover:scale-105 transition-transform cursor-pointer ' + colorClass}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={'p-2 rounded-xl ' + colorClass}>
                    {getDomainIcon(domain.name)}
                  </div>
                  <span className="text-2xl font-bold">
                    {domain.progress_percentage}%
                  </span>
                </div>

                <h3 className="text-lg font-semibold mb-1">
                  {domain.display_name}
                </h3>

                <p className="text-sm text-muted-foreground mb-3">
                  {domain.completed_tasks} / {domain.total_tasks} tasks
                </p>

                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className={barColor} style={{ width: domain.progress_percentage + '%' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {domains.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <LayoutDashboard className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No domains yet</h3>
          <p className="text-sm text-muted-foreground">
            Domains help you organize your life. They will be created automatically when you add tasks.
          </p>
        </div>
      )}

      {/* Active Projects */}
      {projects.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Active Projects</h2>
            </div>
            <a href="/projects" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              View all
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 3).map((project) => (
              <div
                key={project.id}
                className="p-4 bg-muted/30 dark:bg-white/5 hover:bg-muted/50 dark:hover:bg-white/10 border border-border/30 dark:border-white/5 rounded-xl transition-all cursor-pointer"
              >
                <h3 className="font-semibold mb-1">{project.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {project.description || 'No description'}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className={'text-xs px-2 py-1 rounded ' + getDomainColor(project.domain)}>
                    {project.domain}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {activities.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>

          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 bg-muted/30 dark:bg-white/5 rounded-xl"
              >
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Tasks (if more than 3) */}
      {tasks.length > 3 && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">All Active Tasks</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {tasks.filter(t => t.status !== 'done').length} remaining
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tasks.filter(t => t.status !== 'done' && t.status !== 'completed').map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-3 p-3 bg-muted/30 dark:bg-white/5 hover:bg-muted/50 dark:hover:bg-white/10 border border-border/30 dark:border-white/5 rounded-xl transition-all"
              >
                <button onClick={() => handleToggleTask(task.id, task.status)} className="shrink-0">
                  <Circle className="w-5 h-5 text-muted-foreground hover:text-primary" />
                </button>

                <span className="flex-1 text-sm">{task.title}</span>

                <span className={'text-xs px-2 py-1 rounded ' + getDomainColor(task.domain)}>
                  {task.domain}
                </span>

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-opacity"
                >
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
