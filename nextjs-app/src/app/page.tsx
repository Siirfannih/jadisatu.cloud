'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check, Rocket, Clock, PenTool, Plus, Calendar as CalendarIcon,
  MessageSquare, GitCommit, FileEdit, CheckCircle2, Circle,
  ArrowRight, Trash2, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react'

const MorningBriefing = dynamic(() => import('@/components/dashboard/MorningBriefing'), {
  ssr: false,
  loading: () => null,
})

type Task = { id: string; title: string; status: string; domain: string; priority: string; created_at: string }
type Project = { id: string; name: string; description: string | null; status: string }
type ActivityItem = { id: string; type?: string; action?: string; description: string; created_at: string }
type Idea = { id: string; title: string; tags?: string[]; source: string; status: string; created_at: string }
type ScheduleBlock = { id: string; title: string; start_time: string; end_time: string; domain: string | null; type: string; date: string }
type Content = { id: string; title: string; status: string }

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: { full_name?: string } } | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending'>('pending')
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set())

  useEffect(() => { checkUser() }, [])

  async function checkUser() {
    const { data: { user: u }, error } = await supabase.auth.getUser()
    if (error || !u) { router.push('/login'); return }
    setUser(u)
    fetch('/light/api/init-user', { method: 'POST' }).catch(() => {})
    await loadData()
  }

  async function loadData() {
    setLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]
    const [tRes, pRes, aRes, sRes, cRes] = await Promise.all([
      fetch('/light/api/tasks?status=active&limit=100'),
      fetch('/light/api/projects'),
      fetch('/light/api/activities?limit=5'),
      fetch(`/light/api/schedule?date=${todayStr}`),
      fetch('/light/api/contents'),
    ])
    if (tRes.ok) { const d = await tRes.json(); setTasks(Array.isArray(d) ? d : []) }
    if (pRes.ok) { const d = await pRes.json(); setProjects(Array.isArray(d) ? d : []) }
    if (aRes.ok) { const d = await aRes.json(); setActivities(Array.isArray(d) ? d : []) }
    if (sRes.ok) { const d = await sRes.json(); setSchedule(Array.isArray(d) ? d : []) }
    if (cRes.ok) { const d = await cRes.json(); setContents(Array.isArray(d) ? d : []) }

    const { data: { user: u } } = await supabase.auth.getUser()
    if (u) {
      const { data: ideasData } = await supabase
        .from('ideas')
        .select('*')
        .eq('user_id', u.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(3)
      if (ideasData) setIdeas(ideasData)
    }
    setLoading(false)
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return
    await fetch('/light/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle, status: 'todo', priority: 'medium', domain: 'personal' }),
    })
    setNewTaskTitle('')
    await loadData()
  }

  async function toggleTask(id: string, status: string) {
    const ns = status === 'done' ? 'todo' : 'done'
    if (ns === 'done') {
      setCompletingIds(prev => new Set(prev).add(id))
      setTimeout(() => setFadingIds(prev => new Set(prev).add(id)), 800)
      setTimeout(async () => {
        await fetch('/light/api/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: ns }),
        })
        setCompletingIds(prev => { const s = new Set(prev); s.delete(id); return s })
        setFadingIds(prev => { const s = new Set(prev); s.delete(id); return s })
        await loadData()
      }, 1400)
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: ns } : t))
      await fetch('/light/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: ns }),
      })
      await loadData()
    }
  }

  async function deleteTask(id: string) {
    setFadingIds(prev => new Set(prev).add(id))
    setTimeout(async () => {
      await fetch(`/light/api/tasks/${id}`, { method: 'DELETE' })
      setFadingIds(prev => { const s = new Set(prev); s.delete(id); return s })
      setTasks(prev => prev.filter(t => t.id !== id))
    }, 600)
  }

  async function saveNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    if (u) {
      const tags = noteText.match(/#\w+/g)?.map(t => t.slice(1)) || []
      const title = noteText.replace(/#\w+/g, '').trim()
      await supabase.from('ideas').insert({
        title: title || noteText,
        tags,
        source: 'quick-note',
        status: 'active',
        user_id: u.id,
      })
      setNoteText('')
    }
    setSavingNote(false)
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Creator'
  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }
  const greetingEmoji = () => {
    const h = new Date().getHours()
    if (h < 12) return '☀️'
    if (h < 17) return '🚀'
    return '🌙'
  }
  const completedCount = tasks.filter(t => t.status === 'done').length
  const activeProjectCount = projects.filter(p => p.status === 'active').length
  const pendingTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'completed')
  const displayTasks = taskFilter === 'pending' ? pendingTasks : tasks
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const activityIcons: Record<string, { icon: typeof FileEdit; color: string; bg: string; darkBg: string }> = {
    comment: { icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-500/10' },
    commit: { icon: GitCommit, color: 'text-purple-500', bg: 'bg-purple-50', darkBg: 'dark:bg-purple-500/10' },
    edit: { icon: FileEdit, color: 'text-orange-500', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-500/10' },
    complete: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-500/10' },
  }

  const ideaStyles = [
    { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' },
  ]

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header skeleton */}
        <div>
          <div className="h-4 w-32 bg-muted rounded-lg animate-pulse mb-3" />
          <div className="h-10 w-80 bg-muted rounded-lg animate-pulse mb-3" />
          <div className="h-5 w-64 bg-muted rounded-lg animate-pulse" />
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-3xl p-6 border border-border shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-muted animate-pulse mb-6" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse mb-3" />
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
              <div className="h-6 w-40 bg-muted rounded animate-pulse mb-6" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 mb-3">
                  <div className="w-5 h-5 rounded bg-muted animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
              <div className="h-6 w-24 bg-muted rounded animate-pulse mb-4" />
              <div className="h-48 bg-muted rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <MorningBriefing />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground font-medium mb-1">{today}</p>
          <h1 className="text-4xl font-bold text-foreground tracking-tight mb-3">
            {greeting()}, {userName}! {greetingEmoji()}
          </h1>
          <p className="text-muted-foreground text-lg">
            You have <span className="text-orange-600 dark:text-orange-400 font-medium">{pendingTasks.length} tasks</span> to tackle
            and <span className="text-purple-600 dark:text-purple-400 font-medium">{activeProjectCount} projects</span> in motion.
          </p>
        </div>
        <Link
          href="/projects"
          className="hidden sm:flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-3 rounded-xl font-medium transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" /><span>New Project</span>
        </Link>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card rounded-3xl p-6 border border-border shadow-sm relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-50 dark:bg-blue-500/5 rounded-full opacity-50"></div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-6 relative z-10">
            <Check className="w-6 h-6 text-blue-600 dark:text-blue-400" strokeWidth={3} />
          </div>
          <p className="text-sm text-muted-foreground font-medium mb-2 relative z-10">Tasks Completed</p>
          <div className="flex items-baseline gap-3 relative z-10">
            <h3 className="text-4xl font-bold text-foreground tracking-tight">{completedCount}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-2 relative z-10">this session</p>
        </div>

        <div className="bg-card rounded-3xl p-6 border border-border shadow-sm relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-50 dark:bg-purple-500/5 rounded-full opacity-50"></div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center mb-6 relative z-10">
            <Rocket className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-sm text-muted-foreground font-medium mb-2 relative z-10">Active Projects</p>
          <div className="flex items-baseline gap-3 relative z-10">
            <h3 className="text-4xl font-bold text-foreground tracking-tight">{activeProjectCount}</h3>
            <span className="text-sm font-medium text-muted-foreground">{projects.length} total</span>
          </div>
        </div>

        <div className="bg-card rounded-3xl p-6 border border-border shadow-sm relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-orange-50 dark:bg-orange-500/5 rounded-full opacity-50"></div>
          <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-6 relative z-10">
            <Clock className="w-6 h-6 text-orange-500 dark:text-orange-400" />
          </div>
          <p className="text-sm text-muted-foreground font-medium mb-2 relative z-10">Pending Tasks</p>
          <div className="flex items-baseline gap-3 relative z-10 mb-4">
            <h3 className="text-4xl font-bold text-foreground tracking-tight">{pendingTasks.length}</h3>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden relative z-10">
            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${tasks.length > 0 ? (pendingTasks.length / tasks.length) * 100 : 0}%` }}></div>
          </div>
        </div>

        <div className="bg-card rounded-3xl p-6 border border-border shadow-sm relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-pink-50 dark:bg-pink-500/5 rounded-full opacity-50"></div>
          <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-500/10 flex items-center justify-center mb-6 relative z-10">
            <PenTool className="w-6 h-6 text-pink-500 dark:text-pink-400" />
          </div>
          <p className="text-sm text-muted-foreground font-medium mb-2 relative z-10">Creative Output</p>
          <div className="flex items-baseline gap-3 relative z-10">
            <h3 className="text-4xl font-bold text-foreground tracking-tight">{contents.length + ideas.length}</h3>
            <span className="text-sm font-medium text-muted-foreground">pieces</span>
          </div>
        </div>
      </div>

      {/* Main Grid: 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Today's Tasks */}
          <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Today&apos;s Tasks</h2>
                <p className="text-sm text-muted-foreground mt-1">{today}</p>
              </div>
              <div className="flex items-center bg-muted p-1 rounded-xl">
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${taskFilter === 'all' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >All</button>
                <button
                  onClick={() => setTaskFilter('pending')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${taskFilter === 'pending' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >Pending</button>
              </div>
            </div>
            <div className="space-y-3">
              {displayTasks.slice(0, 6).map(task => {
                const isC = completingIds.has(task.id)
                const isF = fadingIds.has(task.id)
                return (
                  <div
                    key={task.id}
                    className={`group flex items-center gap-4 p-4 rounded-2xl border border-border hover:border-primary/30 transition-colors bg-card relative ${isC ? 'task-completing bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' : ''} ${isF ? 'task-fade-out' : ''}`}
                  >
                    <button
                      onClick={() => toggleTask(task.id, task.status)}
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${task.status === 'done' || isC ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/30 hover:border-blue-500'} ${isC ? 'check-pop' : ''}`}
                    >
                      {(task.status === 'done' || isC) && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </button>
                    {isC && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 rounded-full bg-emerald-400/20 confetti-burst" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${task.priority === 'high' ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : task.priority === 'medium' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                          {task.priority}
                        </span>
                        <h4 className={`task-title text-sm font-semibold ${task.status === 'done' ? 'text-muted-foreground line-through' : isC ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {task.title}
                        </h4>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span>{task.domain}</span><span>•</span><span>{task.status}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1.5 text-muted-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
              {displayTasks.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">All clear! Add a task to get started ✨</p>
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder="Add a new task..."
                  className="flex-1 bg-muted border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground text-foreground"
                />
                <button
                  onClick={addTask}
                  disabled={!newTaskTitle.trim()}
                  className="px-4 py-3 bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />Add
                </button>
              </div>
            </div>
          </div>

          {/* Creative Preview */}
          <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">Creative Hub</h2>
                <p className="text-sm text-muted-foreground mt-1">Recent drafts and ideas</p>
              </div>
              <Link
                href="/creative"
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-4 py-2 rounded-xl"
              >
                Open Hub <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {ideas.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {ideas.map((idea, i) => {
                  const style = ideaStyles[i % ideaStyles.length]
                  return (
                    <Link
                      href="/creative"
                      key={idea.id}
                      className="group rounded-2xl overflow-hidden border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer bg-card flex flex-col"
                    >
                      <div className={`aspect-[4/3] relative w-full overflow-hidden ${style.bg} flex items-center justify-center`}>
                        <PenTool className={`w-10 h-10 ${style.color} opacity-30`} />
                        {idea.tags && idea.tags[0] && (
                          <div className="absolute top-3 left-3">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-card/90 ${style.color}`}>
                              {idea.tags[0]}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h4 className="text-sm font-semibold text-foreground line-clamp-1">{idea.title}</h4>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <PenTool className="w-10 h-10 text-orange-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">Your canvas is blank — what will you create? 🎨</p>
                <Link href="/creative" className="text-sm text-orange-600 dark:text-orange-400 font-medium inline-block">
                  Start creating &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Widgets */}
        <div className="space-y-8">
          {/* Calendar Widget */}
          <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Calendar</h2>
              <Link href="/calendar" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                Full View
              </Link>
            </div>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
                className="p-1 hover:bg-muted rounded-lg"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="text-sm font-semibold text-foreground">
                {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
                className="p-1 hover:bg-muted rounded-lg"
              >
                <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-bold text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            {(() => {
              const year = selectedDate.getFullYear()
              const month = selectedDate.getMonth()
              const firstDay = new Date(year, month, 1).getDay()
              const daysInMonth = new Date(year, month + 1, 0).getDate()
              const todayDate = new Date()
              const isToday = (d: number) => todayDate.getFullYear() === year && todayDate.getMonth() === month && todayDate.getDate() === d
              const cells = []
              for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />)
              for (let d = 1; d <= daysInMonth; d++) {
                cells.push(
                  <button
                    key={d}
                    className={`text-xs py-1.5 rounded-lg transition-colors ${isToday(d) ? 'bg-primary text-white font-bold' : 'text-foreground hover:bg-muted'}`}
                  >
                    {d}
                  </button>
                )
              }
              return <div className="grid grid-cols-7 gap-1">{cells}</div>
            })()}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Today&apos;s Schedule</p>
              {schedule.length > 0 ? (
                <div className="space-y-2">
                  {schedule.map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-2 rounded-xl bg-muted">
                      <div className="w-1 h-8 rounded-full bg-primary shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-1">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground">{s.start_time} – {s.end_time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">Free day ahead — time to create! ✨</p>
              )}
            </div>
          </div>

          {/* Activity */}
          <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">Activity</h2>
              <Link href="/history" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                View All
              </Link>
            </div>
            {activities.length > 0 ? (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-border">
                {activities.map(a => {
                  const ai = activityIcons[a.type || 'edit'] || activityIcons.edit
                  const Icon = ai.icon
                  return (
                    <div key={a.id} className="relative flex items-start gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-card bg-card shrink-0 relative z-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ai.bg} ${ai.darkBg}`}>
                          <Icon className={`w-4 h-4 ${ai.color}`} />
                        </div>
                      </div>
                      <div className="flex-1 pt-1.5">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{a.action || 'Action'}</span> {a.description}
                        </p>
                        <span className="text-xs text-muted-foreground mt-1 block">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Your story starts now — make your first move 🌟</p>
            )}
          </div>

          {/* Quick Note */}
          <div className="bg-card rounded-3xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Quick Note</h2>
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              className="w-full h-32 resize-none bg-muted border-none rounded-2xl p-4 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
              placeholder="Jot down an idea... (use #tags)"
            ></textarea>
            <div className="mt-4 flex justify-end">
              <button
                onClick={saveNote}
                disabled={savingNote || !noteText.trim()}
                className="px-4 py-2 bg-foreground hover:bg-foreground/90 disabled:opacity-40 text-background text-sm font-medium rounded-xl transition-colors shadow-sm"
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
