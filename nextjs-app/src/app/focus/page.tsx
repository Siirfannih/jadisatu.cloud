'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { cn } from '@/lib/utils'
import { Target, Play, Pause, RotateCcw, CheckCircle2, Circle, Clock, Plus, Coffee } from 'lucide-react'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  domain: string
}

const FOCUS_DURATION = 25 * 60
const BREAK_DURATION = 5 * 60
const SESSIONS_KEY = 'jadisatu-focus-sessions'

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

function loadSessions(): number {
  if (typeof window === 'undefined') return 0
  try {
    const stored = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}')
    return stored[getTodayKey()] || 0
  } catch { return 0 }
}

function saveSessions(count: number) {
  if (typeof window === 'undefined') return
  try {
    const stored = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}')
    stored[getTodayKey()] = count
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(stored))
  } catch { /* ignore */ }
}

export default function FocusPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState(FOCUS_DURATION)
  const [isRunning, setIsRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [justFinished, setJustFinished] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setSessions(loadSessions())
    loadTasks()
  }, [])

  const tick = useCallback(() => {
    setTimeLeft(prev => {
      if (prev <= 1) {
        setIsRunning(false)
        setJustFinished(true)
        if (!isBreak) {
          setSessions(s => {
            const next = s + 1
            saveSessions(next)
            return next
          })
        }
        setIsBreak(b => !b)
        return isBreak ? FOCUS_DURATION : BREAK_DURATION
      }
      return prev - 1
    })
  }, [isBreak])

  useEffect(() => {
    if (isRunning) {
      setJustFinished(false)
      intervalRef.current = setInterval(tick, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning, tick])

  async function loadTasks() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['todo', 'in-progress', 'in_progress'])
      .order('priority')
    if (data) setTasks(data)
    setLoading(false)
  }

  async function toggleTask(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('tasks').update({ status: 'done' }).eq('id', id).eq('user_id', user.id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    const title = newTaskTitle.trim()
    if (!title || adding) return
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAdding(false); return }
    const { data } = await supabase
      .from('tasks')
      .insert({ title, status: 'todo', priority: 'medium', user_id: user.id })
      .select()
      .single()
    if (data) setTasks(prev => [...prev, data])
    setNewTaskTitle('')
    setAdding(false)
  }

  function resetTimer() {
    setIsRunning(false)
    setIsBreak(false)
    setJustFinished(false)
    setTimeLeft(FOCUS_DURATION)
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const progress = isBreak
    ? ((BREAK_DURATION - timeLeft) / BREAK_DURATION) * 100
    : ((FOCUS_DURATION - timeLeft) / FOCUS_DURATION) * 100

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
  const sortedTasks = [...tasks].sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4))

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🎯 Focus Zone</h1>
        <p className="text-muted-foreground mt-1">Lock in and get things done — one session at a time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timer Card */}
        <div className="bg-card border border-border rounded-3xl p-8 shadow-sm flex flex-col items-center">
          <div className={cn(
            'text-sm font-bold uppercase tracking-wider mb-6 px-4 py-1.5 rounded-full',
            isBreak ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
          )}>
            {isBreak ? '☕ Break Time' : '🔥 Focus Session'}
          </div>

          {/* Circular progress */}
          <div className="relative w-56 h-56 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" strokeWidth="4" className="stroke-muted" />
              <circle
                cx="50" cy="50" r="45" fill="none" strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                strokeLinecap="round"
                className={cn('transition-all duration-1000', isBreak ? 'stroke-green-500' : 'stroke-orange-500')}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tabular-nums tracking-tight">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Completion message */}
          {justFinished && (
            <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-4 flex items-center gap-1.5">
              <Coffee size={14} />
              {isBreak ? 'Great session! Take a breather ☕' : 'Break over — ready for another round? 💪'}
            </p>
          )}

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={cn(
                'flex items-center gap-2 px-8 py-3 rounded-2xl font-semibold transition-colors text-white',
                isRunning ? 'bg-orange-500 hover:bg-orange-600' : 'bg-orange-500 hover:bg-orange-600'
              )}
            >
              {isRunning ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start</>}
            </button>
            <button
              onClick={resetTimer}
              className="p-3 rounded-2xl border border-border hover:bg-muted transition-colors text-muted-foreground"
              title="Reset timer"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Session stats */}
          <div className="flex items-center gap-6 mt-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-orange-500" />
              <span>{sessions} session{sessions !== 1 ? 's' : ''} today</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} />
              <span>{sessions * 25}m focused</span>
            </div>
          </div>
        </div>

        {/* Tasks Card */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Today&apos;s Focus Tasks</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{sortedTasks.length} task{sortedTasks.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto min-h-[200px]">
            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : sortedTasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-orange-400/40" />
                <p className="text-sm font-medium text-muted-foreground">Nothing on your plate yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Add a focus task to get started!</p>
              </div>
            ) : (
              sortedTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted transition-colors text-left group"
                >
                  <Circle size={20} className="text-muted-foreground group-hover:text-orange-500 shrink-0 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                        task.priority === 'urgent' || task.priority === 'high'
                          ? 'bg-red-500/10 text-red-500'
                          : task.priority === 'medium'
                            ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                            : 'bg-blue-500/10 text-blue-500'
                      )}>
                        {task.priority}
                      </span>
                      {task.domain && (
                        <span className="text-[10px] text-muted-foreground">{task.domain}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Quick add task */}
          <form onSubmit={addTask} className="mt-4 flex items-center gap-2 pt-4 border-t border-border">
            <input
              type="text"
              placeholder="Add a focus task..."
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all"
            />
            <button
              type="submit"
              disabled={!newTaskTitle.trim() || adding}
              className="p-2.5 rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
