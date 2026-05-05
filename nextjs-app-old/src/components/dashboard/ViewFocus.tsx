'use client'

import { useState, useEffect } from 'react'
import { Target, Play, Pause, RotateCcw, FolderOpen, FileText, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const POMODORO_WORK = 25 * 60 // 25 minutes
const POMODORO_BREAK = 5 * 60  // 5 minutes

type Project = { id: string; title: string; description?: string }
type Task = { id: string; title: string; status: string; project_id: string | null; domain?: string }

export default function ViewFocus() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [seconds, setSeconds] = useState(POMODORO_WORK)
  const [isRunning, setIsRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)

  useEffect(() => {
    loadProjectsAndTasks()
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isRunning && seconds > 0) {
      interval = setInterval(() => setSeconds((s) => s - 1), 1000)
    } else if (isRunning && seconds === 0) {
      setIsRunning(false)
      setIsBreak((b) => !b)
      setSeconds(isBreak ? POMODORO_WORK : POMODORO_BREAK)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [isRunning, seconds, isBreak])

  async function loadProjectsAndTasks() {
    setLoading(true)
    try {
      const [projRes, taskRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/tasks?status=active&limit=100'),
      ])
      if (projRes.ok) {
        const data = await projRes.json()
        setProjects(Array.isArray(data) ? data : data?.projects ?? [])
      }
      if (taskRes.ok) {
        const data = await taskRes.json()
        setTasks(Array.isArray(data) ? data : data?.tasks ?? [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filteredTasks = selectedProjectId === 'all'
    ? tasks.filter((t) => t.status !== 'done')
    : tasks.filter((t) => t.project_id === selectedProjectId && t.status !== 'done')

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const resetTimer = () => {
    setIsRunning(false)
    setIsBreak(false)
    setSeconds(POMODORO_WORK)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-slide-up">
      <div>
        <h2 className="text-xl font-bold text-foreground">Today&apos;s Focus</h2>
        <p className="text-sm text-muted-foreground">Pomodoro + filter by project. Only tasks for the selected project are shown.</p>
      </div>

      {/* Project filter */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-foreground">Filter by project</span>
        </div>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full max-w-xs bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-accent/50"
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {/* Pomodoro timer */}
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center">
        <div className={cn(
          'w-40 h-40 rounded-full flex items-center justify-center text-4xl font-mono font-bold border-4 transition-colors',
          isBreak ? 'border-amber-500/50 text-amber-600 dark:text-amber-400' : 'border-accent/50 text-accent'
        )}>
          {formatTime(seconds)}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{isBreak ? 'Break' : 'Focus'}</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-accent hover:bg-accent/90 text-foreground"
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} />}
            {isRunning ? 'Pause' : 'Start'}
          </button>
          <button
            onClick={resetTimer}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium border border-border hover:bg-muted text-foreground"
          >
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
      </div>

      {/* Tasks for selected project */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-foreground">
            {selectedProjectId === 'all' ? 'All tasks' : `Tasks for ${projects.find((p) => p.id === selectedProjectId)?.title ?? 'project'}`}
          </h3>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : filteredTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks. Add tasks in Kanban or select another project.</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto custom-scroll">
            {filteredTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted border border-border hover:border-blue-500/20 transition-all"
              >
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-foreground truncate flex-1">{task.title}</span>
                {task.domain && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">{task.domain}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
