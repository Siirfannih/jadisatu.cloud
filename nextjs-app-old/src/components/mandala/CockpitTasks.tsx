'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  AlertTriangle, ArrowUpCircle, Clock, Sparkles, CheckCircle2,
  Plus, X, Loader2, Phone, MessageSquare, UserSearch, LifeBuoy, Target,
  Eye, Send, ChevronDown, ChevronUp, RotateCcw
} from 'lucide-react'
import type { MandalaStats, Conversation } from './types'

interface Props {
  stats: MandalaStats | null
  conversations: Conversation[]
  onNavigate: (section: string) => void
}

interface TaskGroup {
  title: string
  icon: typeof AlertTriangle
  iconColor: string
  bgColor: string
  items: { label: string; detail: string }[]
  priority: 'urgent' | 'high' | 'medium' | 'low'
}

interface MandalaTask {
  id: string
  type: string
  objective: string
  target: { customer_number: string; customer_name?: string; channel?: string }
  context: string
  status: string
  approval_mode: string
  created_by: string
  created_at: string
  executed_at?: string
  error?: string
}

interface TaskDraft {
  content: string
  delay_ms: number
  confidence: number
}

const TASK_TYPES = [
  { value: 'outreach', label: 'Outreach', desc: 'Hubungi prospek baru', icon: Phone },
  { value: 'follow_up', label: 'Follow Up', desc: 'Tindak lanjut percakapan', icon: MessageSquare },
  { value: 'rescue', label: 'Rescue', desc: 'Selamatkan lead yang dingin', icon: LifeBuoy },
  { value: 'qualification', label: 'Qualification', desc: 'Kualifikasi lead potensial', icon: UserSearch },
]

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-600' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-600' },
  awaiting_review: { bg: 'bg-amber-100', text: 'text-amber-600' },
  approved: { bg: 'bg-green-100', text: 'text-green-600' },
  executed: { bg: 'bg-green-100', text: 'text-green-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-600' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
}

export default function CockpitTasks({ stats, conversations, onNavigate }: Props) {
  const [tasks, setTasks] = useState<MandalaTask[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    type: 'outreach',
    target_number: '',
    target_name: '',
    objective: '',
    context: '',
  })
  const [reviewTaskId, setReviewTaskId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<TaskDraft[]>([])
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [approveLoading, setApproveLoading] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/mandala/tasks?limit=30')
      if (!res.ok) return
      const data = await res.json()
      if (data.data) setTasks(data.data)
    } catch {
      // Table may not exist yet
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleCreate = async () => {
    if (!form.objective.trim() || !form.target_number.trim()) {
      setFormError('Objective dan nomor target harus diisi')
      return
    }

    setFormLoading(true)
    setFormError(null)

    try {
      const res = await fetch('/api/mandala/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setFormError(data.error || 'Gagal membuat task')
        return
      }
      setShowForm(false)
      setForm({ type: 'outreach', target_number: '', target_name: '', objective: '', context: '' })
      fetchTasks()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setFormLoading(false)
    }
  }

  const handleAction = async (id: string, action: string) => {
    try {
      await fetch('/api/mandala/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (reviewTaskId === id) {
        setReviewTaskId(null)
        setDrafts([])
      }
      fetchTasks()
    } catch {
      // ignore
    }
  }

  const fetchDrafts = async (taskId: string) => {
    if (reviewTaskId === taskId) {
      setReviewTaskId(null)
      setDrafts([])
      return
    }
    setReviewTaskId(taskId)
    setDraftsLoading(true)
    try {
      const res = await fetch(`/api/mandala/tasks/${taskId}?view=drafts`)
      if (!res.ok) return
      const data = await res.json()
      setDrafts(data.drafts || [])
    } catch {
      setDrafts([])
    } finally {
      setDraftsLoading(false)
    }
  }

  const handleApprove = async (taskId: string) => {
    setApproveLoading(true)
    try {
      await fetch('/api/mandala/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, action: 'approve' }),
      })
      setReviewTaskId(null)
      setDrafts([])
      fetchTasks()
    } catch {
      // ignore
    } finally {
      setApproveLoading(false)
    }
  }

  const groups = buildTaskGroups(stats, conversations)
  const totalDerived = groups.reduce((sum, g) => sum + g.items.length, 0)
  const activeTasks = tasks.filter(t => !['cancelled', 'executed', 'failed'].includes(t.status))

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalDerived + activeTasks.length} task{(totalDerived + activeTasks.length) !== 1 ? 's' : ''} memerlukan perhatian
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            showForm
              ? "bg-muted text-muted-foreground"
              : "bg-orange-500 text-white hover:bg-orange-600"
          )}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Batal' : 'Buat Task'}
        </button>
      </div>

      {/* Create Task Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-500" />
            Buat Task Baru
          </h3>

          {/* Task Type */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TASK_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setForm(f => ({ ...f, type: t.value }))}
                className={cn(
                  "p-3 rounded-lg border text-left transition-colors",
                  form.type === t.value
                    ? "border-orange-400 bg-orange-50"
                    : "border-border hover:bg-muted"
                )}
              >
                <t.icon className={cn("w-4 h-4 mb-1", form.type === t.value ? "text-orange-500" : "text-muted-foreground")} />
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>

          {/* Target */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nomor WhatsApp Target *</label>
              <input
                type="text"
                value={form.target_number}
                onChange={(e) => setForm(f => ({ ...f, target_number: e.target.value }))}
                placeholder="628xxxxxxxxxx"
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Nama (opsional)</label>
              <input
                type="text"
                value={form.target_name}
                onChange={(e) => setForm(f => ({ ...f, target_name: e.target.value }))}
                placeholder="Nama kontak"
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Objective */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Objective / Goals *</label>
            <textarea
              value={form.objective}
              onChange={(e) => setForm(f => ({ ...f, objective: e.target.value }))}
              placeholder="Contoh: Hubungi untuk menawarkan jasa setup AI automation untuk bisnis klinik kecantikannya"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          {/* Context */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Konteks tambahan (opsional)</label>
            <textarea
              value={form.context}
              onChange={(e) => setForm(f => ({ ...f, context: e.target.value }))}
              placeholder="Info tambahan yang perlu Mandala ketahui..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={formLoading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Buat Task
          </button>
        </div>
      )}

      {/* User-Created Tasks */}
      {tasks.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Task yang Dibuat</h3>
            <span className="text-xs text-muted-foreground">{tasks.length} task</span>
          </div>
          <div className="divide-y divide-border">
            {tasks.map((task) => {
              const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS.pending
              const TypeIcon = TASK_TYPES.find(t => t.value === task.type)?.icon || Target
              const isReviewing = reviewTaskId === task.id
              return (
                <div key={task.id}>
                  <div className={cn("p-4 transition-colors", isReviewing ? "bg-amber-50/50" : "hover:bg-muted/30")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <TypeIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <p className="font-medium text-sm truncate">{task.objective}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {task.target.customer_name || task.target.customer_number} &middot; {task.type.replace('_', ' ')}
                        </p>
                        {task.error && (
                          <p className="text-xs text-red-500 mt-1">{task.error}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusStyle.bg, statusStyle.text)}>
                          {task.status.replace('_', ' ')}
                        </span>
                        {task.status === 'awaiting_review' && (
                          <button
                            onClick={() => fetchDrafts(task.id)}
                            className={cn(
                              "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors",
                              isReviewing
                                ? "bg-amber-100 text-amber-700"
                                : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                            )}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Review
                            {isReviewing ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                        {task.status === 'failed' && (
                          <button
                            onClick={() => handleAction(task.id, 'retry')}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Retry
                          </button>
                        )}
                        {(task.status === 'pending' || task.status === 'awaiting_review') && (
                          <button
                            onClick={() => handleAction(task.id, 'cancel')}
                            className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Draft Review Panel */}
                  {isReviewing && (
                    <div className="px-4 pb-4 bg-amber-50/30 border-t border-amber-100">
                      {draftsLoading ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Memuat draft pesan...
                        </div>
                      ) : drafts.length === 0 ? (
                        <div className="py-4 space-y-3">
                          <p className="text-sm text-muted-foreground">Tidak ada draft pesan — Mandala belum berhasil generate pesan untuk task ini.</p>
                          <button
                            onClick={() => handleAction(task.id, 'retry')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm font-medium"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Jalankan Ulang
                          </button>
                        </div>
                      ) : (
                        <div className="pt-3 space-y-3">
                          <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                            Draft Pesan dari Mandala ({drafts.length} pesan)
                          </p>
                          {drafts.map((draft, i) => (
                            <div key={i} className="bg-white rounded-lg border border-amber-200 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-xs font-medium text-amber-600">Pesan {i + 1}</span>
                                {draft.delay_ms > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    (delay {Math.round(draft.delay_ms / 1000)}s)
                                  </span>
                                )}
                              </div>
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{draft.content}</p>
                            </div>
                          ))}
                          <div className="flex items-center gap-3 pt-2">
                            <button
                              onClick={() => handleApprove(task.id)}
                              disabled={approveLoading}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                              {approveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              Kirim Sekarang
                            </button>
                            <button
                              onClick={() => handleAction(task.id, 'cancel')}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors text-sm font-medium"
                            >
                              <X className="w-4 h-4" />
                              Batalkan
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Derived Task Groups (from conversations) */}
      {totalDerived === 0 && tasks.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Semua beres</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Tidak ada task yang memerlukan perhatian saat ini.</p>
        </div>
      ) : (
        groups.filter(g => g.items.length > 0).map((group) => (
          <div key={group.title} className={cn("border rounded-xl shadow-sm overflow-hidden", group.bgColor)}>
            <div className="p-4 flex items-center gap-3">
              <group.icon className={cn("w-5 h-5", group.iconColor)} />
              <h3 className="font-semibold text-sm">{group.title}</h3>
              <span className="ml-auto text-xs bg-white/60 px-2 py-0.5 rounded-full font-medium">
                {group.items.length}
              </span>
            </div>
            <div className="bg-card/80 divide-y divide-border">
              {group.items.map((item, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function buildTaskGroups(stats: MandalaStats | null, conversations: Conversation[]): TaskGroup[] {
  const rescueConvs = conversations.filter(c => c.phase === 'rescue')
  const closingConvs = conversations.filter(c => c.phase === 'closing')
  const hotLeads = conversations.filter(c => c.score >= 70 && c.phase !== 'closing')
  const contactNow = stats?.hunter?.contact_now || 0

  const groups: TaskGroup[] = []

  if (rescueConvs.length > 0) {
    groups.push({
      title: 'Needs Rescue',
      icon: AlertTriangle,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50 border-red-200',
      priority: 'urgent',
      items: rescueConvs.map(c => ({
        label: c.customer_name || c.customer_number,
        detail: `Score ${c.score}/100 — resistance detected, needs intervention`,
      })),
    })
  }

  if (closingConvs.length > 0) {
    groups.push({
      title: 'Ready to Close',
      icon: ArrowUpCircle,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50 border-green-200',
      priority: 'high',
      items: closingConvs.map(c => ({
        label: c.customer_name || c.customer_number,
        detail: `Score ${c.score}/100 — in closing phase`,
      })),
    })
  }

  if (hotLeads.length > 0) {
    groups.push({
      title: 'Hot Leads to Push',
      icon: Sparkles,
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-50 border-orange-200',
      priority: 'medium',
      items: hotLeads.map(c => ({
        label: c.customer_name || c.customer_number,
        detail: `Score ${c.score}/100 — high interest, phase: ${c.phase}`,
      })),
    })
  }

  if (contactNow > 0) {
    groups.push({
      title: 'Hunter: Contact Now',
      icon: Clock,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50 border-amber-200',
      priority: 'medium',
      items: [{
        label: `${contactNow} prospect${contactNow > 1 ? 's' : ''} flagged for immediate contact`,
        detail: 'Review in Outreach section',
      }],
    })
  }

  return groups
}
