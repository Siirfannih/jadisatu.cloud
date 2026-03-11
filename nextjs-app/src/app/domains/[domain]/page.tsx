'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { CheckCircle2, Clock, Target, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const DOMAIN_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  work: { label: 'Work & Career', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', emoji: '💼' },
  learn: { label: 'Learning', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', emoji: '📚' },
  business: { label: 'Business', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', emoji: '🚀' },
  personal: { label: 'Personal', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/10', emoji: '🌟' },
}

interface Task { id: string; title: string; status: string; priority: string; domain: string; created_at: string }
interface Content { id: string; title: string; status: string; platform: string; created_at: string }

export default function DomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const [domain, setDomain] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    params.then(p => {
      setDomain(p.domain)
      loadData(p.domain)
    })
  }, [])

  async function loadData(d: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [taskRes, contentRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user.id).eq('domain', d).order('created_at', { ascending: false }).limit(20),
      supabase.from('contents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ])

    if (taskRes.data) setTasks(taskRes.data)
    if (contentRes.data) setContents(contentRes.data)
    setLoading(false)
  }

  const config = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.work
  const activeTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'completed')
  const completedTasks = tasks.filter(t => t.status === 'done' || t.status === 'completed')

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className={cn('rounded-2xl p-6', config.bg)}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{config.emoji}</span>
          <div>
            <h1 className={cn('text-2xl font-bold', config.color)}>{config.label}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTasks.length} active tasks · {completedTasks.length} completed
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Tasks */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Target className="w-5 h-5" /> Active Tasks
            </h2>
            <span className="text-sm text-muted-foreground">{activeTasks.length} items</span>
          </div>
          {activeTasks.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border">
              <p className="text-muted-foreground">No active tasks in this domain</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeTasks.map(task => (
                <div key={task.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/20 transition-colors">
                  <div className={cn('w-2 h-2 rounded-full shrink-0',
                    task.priority === 'urgent' ? 'bg-red-500' :
                    task.priority === 'high' ? 'bg-orange-500' :
                    task.priority === 'medium' ? 'bg-blue-500' : 'bg-gray-400'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{task.status} · {task.priority}</p>
                  </div>
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* Completed */}
          {completedTasks.length > 0 && (
            <>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mt-6">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Completed
              </h2>
              <div className="space-y-2 opacity-60">
                {completedTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-sm text-foreground line-through truncate">{task.title}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Recent Content */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> Recent Content
          </h2>
          {contents.length === 0 ? (
            <div className="text-center py-8 bg-card rounded-2xl border border-border">
              <p className="text-sm text-muted-foreground">No content yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contents.slice(0, 6).map(c => (
                <div key={c.id} className="bg-card border border-border rounded-xl p-3 hover:border-primary/20 transition-colors">
                  <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{c.platform}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
