'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
 AlertTriangle, ArrowUpCircle, Clock, Sparkles, CheckCircle2,
 Plus, X, Loader2, Phone, MessageSquare, UserSearch, LifeBuoy, Target, ChevronRight, Activity, Brain, ListChecks,
 HelpCircle, Send, FileText, RefreshCw, Trash2,
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
 items: { label: string; detail: string }[]
 priority: 'urgent' | 'high' | 'medium' | 'low'
}

interface ClarificationRequest {
 task_id: string
 target: string
 question: string
 options: string[]
 context: string
}

interface TaskReport {
 task_id: string
 task_type: string
 target_number: string
 target_name?: string
 status: string
 messages_sent: string[]
 next_action: string
 reasoning_summary: string
}

interface MandalaTask {
 id: string
 type: string
 objective: string
 target: { customer_number: string; customer_name?: string; channel?: string }
 context: string
 status: string
 engine_task_id?: string
 engine_status?: string
 approval_mode: string
 created_by: string
 created_at: string
 executed_at?: string
 error?: string
 clarification?: ClarificationRequest | null
 reasoning?: { real_objective: string; hook: string; approach: string } | null
 report?: TaskReport | null
 escalation?: { situation: string; needed_from_owner: string; options: string[] } | null
}

const TASK_TYPES = [
 { value: 'outreach', label: 'Outreach', desc: 'Hubungi calon klien baru', icon: Phone },
 { value: 'follow_up', label: 'Follow Up', desc: 'Follow up percakapan', icon: MessageSquare },
 { value: 'rescue', label: 'Rescue', desc: 'Aktifkan ulang lead pasif', icon: LifeBuoy },
 { value: 'qualification', label: 'Qualification', desc: 'Nilai kelayakan lead', icon: UserSearch },
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
 pending: { label: 'MENUNGGU', color: 'text-amber-400 bg-amber-400/5 border-amber-400/20' },
 needs_clarification: { label: 'PERLU JAWABAN', color: 'text-purple-500 bg-purple-500/5 border-purple-500/20' },
 in_progress: { label: 'PROSES', color: 'text-blue-400 bg-blue-400/5 border-blue-400/20' },
 reasoning: { label: 'MENYUSUN STRATEGI', color: 'text-blue-400 bg-blue-400/5 border-blue-400/20' },
 drafting: { label: 'MENULIS PESAN', color: 'text-blue-400 bg-blue-400/5 border-blue-400/20' },
 executing: { label: 'MENGIRIM', color: 'text-blue-500 bg-blue-500/5 border-blue-500/20' },
 sent: { label: 'TERKIRIM', color: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/20' },
 awaiting_review: { label: 'REVIEW', color: 'text-purple-400 bg-purple-400/5 border-purple-400/20' },
 approved: { label: 'DISETUJUI', color: 'text-emerald-400 bg-emerald-400/5 border-emerald-400/20' },
 executed: { label: 'BERHASIL', color: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/20' },
 escalated: { label: 'ESKALASI', color: 'text-orange-500 bg-orange-500/5 border-orange-500/20' },
 failed: { label: 'GAGAL', color: 'text-red-400 bg-red-400/5 border-red-400/20' },
 cancelled: { label: 'BATAL', color: 'text-slate-400 bg-slate-100 border-slate-200' },
}

export default function CockpitTasks({ stats, conversations, onNavigate }: Props) {
 const [tasks, setTasks] = useState<MandalaTask[]>([])
 const [showForm, setShowForm] = useState(false)
 const [formLoading, setFormLoading] = useState(false)
 const [formError, setFormError] = useState<string | null>(null)
 const [clarifyResponse, setClarifyResponse] = useState<Record<string, string>>({})
 const [clarifyLoading, setClarifyLoading] = useState<string | null>(null)
 const [expandedTask, setExpandedTask] = useState<string | null>(null)
 const [form, setForm] = useState({
   type: 'outreach',
   target_number: '',
   target_name: '',
   objective: '',
   context: '',
 })

 const fetchTasks = useCallback(async () => {
   try {
     const res = await fetch('/api/mandala/tasks?limit=30')
     if (!res.ok) return
     const data = await res.json()
     if (data.data) setTasks(data.data)
   } catch {
     // ignore
   }
 }, [])

 useEffect(() => {
   fetchTasks()
   // Poll for updates every 10 seconds
   const interval = setInterval(fetchTasks, 10000)
   return () => clearInterval(interval)
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
     fetchTasks()
   } catch {
     // ignore
   }
 }

 const [clarifyError, setClarifyError] = useState<Record<string, string>>({})

 const handleClarifyResponse = async (task: MandalaTask) => {
   const response = clarifyResponse[task.id]
   if (!response?.trim() || !task.engine_task_id) return

   setClarifyLoading(task.id)
   setClarifyError(prev => ({ ...prev, [task.id]: '' }))
   try {
     const res = await fetch('/api/mandala/tasks', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         id: task.id,
         action: 'respond_clarification',
         engine_task_id: task.engine_task_id,
         response,
         field: task.clarification?.task_id ? 'user_response' : 'user_response',
       }),
     })
     const data = await res.json()
     if (!res.ok || !data.success) {
       setClarifyError(prev => ({ ...prev, [task.id]: data.error || 'Gagal mengirim jawaban' }))
       return
     }
     setClarifyResponse(prev => ({ ...prev, [task.id]: '' }))
     fetchTasks()
   } catch {
     setClarifyError(prev => ({ ...prev, [task.id]: 'Network error' }))
   } finally {
     setClarifyLoading(null)
   }
 }

 const [retryLoading, setRetryLoading] = useState<string | null>(null)

 const handleRetry = async (task: MandalaTask) => {
   setRetryLoading(task.id)
   try {
     // Cancel old task
     await fetch('/api/mandala/tasks', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ id: task.id, action: 'cancel' }),
     })
     // Create new task with same params
     const res = await fetch('/api/mandala/tasks', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         type: task.type,
         target_number: task.target.customer_number,
         target_name: task.target.customer_name || '',
         objective: task.objective,
         context: task.context || '',
       }),
     })
     const data = await res.json()
     if (!res.ok || !data.success) {
       setClarifyError(prev => ({ ...prev, [task.id]: data.error || 'Gagal mengulang task' }))
     }
     fetchTasks()
   } catch {
     setClarifyError(prev => ({ ...prev, [task.id]: 'Network error' }))
   } finally {
     setRetryLoading(null)
   }
 }

 const groups = buildTaskGroups(stats, conversations)
 const totalDerived = groups.reduce((sum, g) => sum + g.items.length, 0)
 const activeTasks = tasks.filter(t => !['cancelled', 'executed', 'failed', 'sent'].includes(t.status))

 return (
   <div className="space-y-5 pb-20">
     {/* Dynamic Header */}
     <div className="flex items-center justify-between">
       <div className="space-y-1">
         <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-3">
           <ListChecks size={20} className="text-[#0060E1]" />
           Tugas AI Mandala
         </h3>
         <p className="text-xs text-slate-400 uppercase tracking-widest">
           {totalDerived + activeTasks.length} tugas aktif saat ini
         </p>
       </div>
       <button
         onClick={() => setShowForm(!showForm)}
         className={cn(
           "flex items-center gap-3 px-6 py-3.5 rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm shadow-blue-500/10",
           showForm
             ? "bg-white text-slate-500"
             : "bg-[#0060E1] text-white hover:bg-[#004FC0]"
         )}
       >
         {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
         {showForm ? 'Batal' : 'Tugas Baru'}
       </button>
     </div>

     {/* Task Form */}
     {showForm && (
       <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-6 space-y-5 animate-in slide-in-from-top-4">
         <div className="flex items-center gap-4">
           <div className="w-10 h-10 rounded-xl bg-[#0060E1]/10 flex items-center justify-center text-[#0060E1]">
             <Target size={20} />
           </div>
           <h3 className="text-[15px] font-semibold text-slate-800 uppercase tracking-widest">Buat Tugas Baru</h3>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           {TASK_TYPES.map((t) => (
             <button
               key={t.value}
               onClick={() => setForm(f => ({ ...f, type: t.value }))}
               className={cn(
                 "p-5 rounded-2xl border text-left transition-all group",
                 form.type === t.value
                   ? "border-[#0060E1] bg-[#0060E1]/5"
                   : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
               )}
             >
               <t.icon className={cn("w-5 h-5 mb-3", form.type === t.value ? "text-[#0060E1]" : "text-slate-400")} />
               <p className="text-xs font-black uppercase tracking-widest mb-1">{t.label}</p>
               <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
             </button>
           ))}
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-2">
             <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nomor WhatsApp Target *</label>
             <input
               type="text"
               value={form.target_number}
               onChange={(e) => setForm(f => ({ ...f, target_number: e.target.value }))}
               placeholder="628xxxxxxxxxx"
               className="w-full px-5 py-4 rounded-2xl bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0060E1] transition-all"
             />
           </div>
           <div className="space-y-2">
             <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nama Target (Opsional)</label>
             <input
               type="text"
               value={form.target_name}
               onChange={(e) => setForm(f => ({ ...f, target_name: e.target.value }))}
               placeholder="e.g. Budi Santoso"
               className="w-full px-5 py-4 rounded-2xl bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0060E1] transition-all"
             />
           </div>
         </div>

         <div className="space-y-2">
           <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Tujuan *</label>
           <textarea
             value={form.objective}
             onChange={(e) => setForm(f => ({ ...f, objective: e.target.value }))}
             placeholder="Contoh: Tawarkan paket SEO berdasarkan profil bisnis mereka..."
             rows={3}
             className="w-full px-5 py-4 rounded-2xl bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0060E1] transition-all resize-none"
           />
         </div>

         <div className="space-y-2">
           <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Informasi Tambahan</label>
           <textarea
             value={form.context}
             onChange={(e) => setForm(f => ({ ...f, context: e.target.value }))}
             placeholder="Tambahkan detail supaya Mandala bisa merespon lebih tepat..."
             rows={2}
             className="w-full px-5 py-4 rounded-2xl bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0060E1] transition-all resize-none"
           />
         </div>

         {formError && (
           <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-[11px] font-bold uppercase tracking-wider">
             <AlertTriangle size={14} />
             {formError}
           </div>
         )}

         <button
           onClick={handleCreate}
           disabled={formLoading}
           className="flex items-center justify-center gap-3 w-full sm:w-auto px-10 py-4 rounded-2xl bg-[#0060E1] hover:bg-[#004FC0] text-white text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50"
         >
           {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
           Kirim ke Mandala
         </button>
       </div>
     )}

     {/* Tasks List */}
     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
       {/* Manual Tasks Section */}
       <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,96,225,0.08)] transition-all duration-300 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex items-center justify-between">
           <h3 className="text-[15px] font-semibold text-slate-800">Tugas Manual</h3>
           <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 bg-slate-100 rounded-lg">{tasks.length} TUGAS</span>
         </div>
         <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto no-scrollbar">
           {tasks.length === 0 ? (
             <div className="p-12 text-center space-y-3 opacity-20">
               <Brain size={48} className="mx-auto" />
               <p className="text-[11px] font-bold uppercase tracking-wider">Belum ada tugas manual</p>
             </div>
           ) : tasks.map((task) => {
             const displayStatus = task.engine_status || task.status
             const status = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.pending
             const TypeIcon = TASK_TYPES.find(t => t.value === task.type)?.icon || Target
             const isExpanded = expandedTask === task.id
             const hasClarification = displayStatus === 'needs_clarification' && task.clarification
             const hasEscalation = displayStatus === 'escalated' && task.escalation
             const hasReport = (displayStatus === 'sent' || displayStatus === 'executed') && task.report

             return (
               <div key={task.id} className="hover:bg-slate-50/60 transition-all">
                 <div
                   className="p-6 cursor-pointer"
                   onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                 >
                   <div className="flex items-start justify-between gap-4">
                     <div className="space-y-2 flex-1">
                       <div className="flex items-center gap-3">
                         <div className="p-2 rounded-xl bg-slate-50 text-[#0060E1]">
                           <TypeIcon size={16} />
                         </div>
                         <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-lg border", status.color)}>
                           {status.label}
                         </span>
                         {hasClarification && (
                           <span className="flex items-center gap-1 text-[9px] font-bold text-purple-500 animate-pulse">
                             <HelpCircle size={12} /> Perlu jawaban
                           </span>
                         )}
                       </div>
                       <p className="font-bold text-sm tracking-tight leading-relaxed line-clamp-2">{task.objective}</p>
                       <div className="flex items-center gap-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">TARGET:</span>
                         <span className="text-[10px] font-bold text-slate-500">{task.target.customer_name || task.target.customer_number}</span>
                       </div>
                     </div>
                     <div className="flex items-center gap-1">
                       {['pending', 'escalated', 'failed', 'needs_clarification'].includes(displayStatus) && (
                         <button
                           onClick={(e) => { e.stopPropagation(); handleRetry(task) }}
                           disabled={retryLoading === task.id}
                           className="p-2 hover:bg-blue-500/10 hover:text-blue-500 text-slate-300 rounded-xl transition-all"
                           title="Ulangi Tugas"
                         >
                           {retryLoading === task.id ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                         </button>
                       )}
                       {!['cancelled', 'sent', 'executed'].includes(displayStatus) && (
                         <button
                           onClick={(e) => { e.stopPropagation(); handleAction(task.id, 'cancel') }}
                           className="p-2 hover:bg-red-500/10 hover:text-red-500 text-slate-200 rounded-xl transition-all"
                           title="Batalkan Tugas"
                         >
                           <X size={16} />
                         </button>
                       )}
                     </div>
                   </div>
                 </div>

                 {/* Expanded: Clarification UI */}
                 {isExpanded && hasClarification && task.clarification && (
                   <div className="px-6 pb-6">
                     <div className="bg-purple-50 rounded-2xl p-5 space-y-4 border border-purple-100">
                       <div className="flex items-start gap-3">
                         <div className="p-2 rounded-xl bg-purple-100 text-purple-600 flex-shrink-0">
                           <HelpCircle size={16} />
                         </div>
                         <div>
                           <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Mandala bertanya:</p>
                           <p className="text-sm font-medium text-slate-800">{task.clarification.question}</p>
                         </div>
                       </div>

                       {task.clarification.options && task.clarification.options.length > 0 && (
                         <div className="flex flex-wrap gap-2 ml-11">
                           {task.clarification.options.map((opt, i) => (
                             <button
                               key={i}
                               onClick={() => setClarifyResponse(prev => ({ ...prev, [task.id]: opt }))}
                               className={cn(
                                 "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                                 clarifyResponse[task.id] === opt
                                   ? "bg-purple-600 text-white border-purple-600"
                                   : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
                               )}
                             >
                               {opt}
                             </button>
                           ))}
                         </div>
                       )}

                       <div className="space-y-2 ml-11">
                         <div className="flex gap-2">
                           <input
                             type="text"
                             value={clarifyResponse[task.id] || ''}
                             onChange={(e) => setClarifyResponse(prev => ({ ...prev, [task.id]: e.target.value }))}
                             placeholder="Ketik jawaban..."
                             className="flex-1 px-4 py-2.5 rounded-xl bg-white text-sm border border-slate-200 focus:outline-none focus:border-purple-400"
                             onKeyDown={(e) => e.key === 'Enter' && handleClarifyResponse(task)}
                           />
                           <button
                             onClick={() => handleClarifyResponse(task)}
                             disabled={!clarifyResponse[task.id]?.trim() || clarifyLoading === task.id}
                             className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-purple-700 transition-all disabled:opacity-50"
                           >
                             {clarifyLoading === task.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                           </button>
                         </div>
                         {clarifyError[task.id] && (
                           <p className="text-xs text-red-500 font-medium px-1">{clarifyError[task.id]}</p>
                         )}
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Expanded: Escalation UI */}
                 {isExpanded && hasEscalation && task.escalation && (
                   <div className="px-6 pb-6">
                     <div className="bg-orange-50 rounded-2xl p-5 space-y-3 border border-orange-100">
                       <div className="flex items-start gap-3">
                         <div className="p-2 rounded-xl bg-orange-100 text-orange-600 flex-shrink-0">
                           <AlertTriangle size={16} />
                         </div>
                         <div>
                           <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">Eskalasi</p>
                           <p className="text-sm font-medium text-slate-800">{task.escalation.situation}</p>
                           <p className="text-xs text-slate-500 mt-1">{task.escalation.needed_from_owner}</p>
                         </div>
                       </div>
                       <div className="flex flex-wrap gap-2 ml-11">
                         <button
                           onClick={() => handleRetry(task)}
                           disabled={retryLoading === task.id}
                           className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0060E1] text-white hover:bg-[#004FC0] transition-all disabled:opacity-50 flex items-center gap-2"
                         >
                           {retryLoading === task.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                           Ulangi Tugas
                         </button>
                         <button
                           onClick={() => handleAction(task.id, 'cancel')}
                           className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:border-red-300 hover:text-red-500 transition-all"
                         >
                           Batalkan
                         </button>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Expanded: Report UI */}
                 {isExpanded && hasReport && task.report && (
                   <div className="px-6 pb-6">
                     <div className="bg-emerald-50 rounded-2xl p-5 space-y-3 border border-emerald-100">
                       <div className="flex items-start gap-3">
                         <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 flex-shrink-0">
                           <FileText size={16} />
                         </div>
                         <div className="flex-1">
                           <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Laporan Eksekusi</p>
                           <p className="text-sm font-medium text-slate-800 mb-2">{task.report.reasoning_summary}</p>
                           {task.report.messages_sent && task.report.messages_sent.length > 0 && (
                             <div className="space-y-1.5">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pesan terkirim:</p>
                               {task.report.messages_sent.map((msg, i) => (
                                 <div key={i} className="bg-white rounded-xl px-3 py-2 text-xs text-slate-600 border border-slate-100">
                                   {msg}
                                 </div>
                               ))}
                             </div>
                           )}
                           <p className="text-xs text-slate-500 mt-2">
                             <span className="font-semibold">Aksi selanjutnya:</span> {task.report.next_action}
                           </p>
                         </div>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Expanded: Reasoning info (for in_progress tasks) */}
                 {isExpanded && task.reasoning && !hasClarification && !hasReport && !hasEscalation && (
                   <div className="px-6 pb-6">
                     <div className="bg-blue-50 rounded-2xl p-5 space-y-2 border border-blue-100">
                       <div className="flex items-start gap-3">
                         <div className="p-2 rounded-xl bg-blue-100 text-blue-600 flex-shrink-0">
                           <Brain size={16} />
                         </div>
                         <div>
                           <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Strategi Mandala</p>
                           <p className="text-sm font-medium text-slate-800">{task.reasoning.real_objective}</p>
                           <p className="text-xs text-slate-500 mt-1">Pendekatan: {task.reasoning.approach} | Hook: {task.reasoning.hook}</p>
                         </div>
                       </div>
                     </div>
                   </div>
                 )}
               </div>
             )
           })}
         </div>
       </div>

       {/* System Suggested Tasks */}
       <div className="space-y-6">
         <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,96,225,0.08)] transition-all duration-300 p-6">
           <div className="flex items-center gap-3 mb-3">
             <Sparkles size={18} className="text-[#0060E1]" />
             <h3 className="text-[15px] font-semibold text-slate-800">Saran dari Mandala</h3>
           </div>

           {totalDerived === 0 ? (
             <div className="py-20 text-center space-y-4 opacity-30">
               <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto">
                 <CheckCircle2 size={32} />
               </div>
               <p className="text-[11px] font-bold uppercase tracking-wider">Tidak Ada Saran</p>
             </div>
           ) : (
             <div className="space-y-4">
               {groups.filter(g => g.items.length > 0).map((group) => (
                 <div key={group.title} className="bg-slate-50/70 rounded-xl overflow-hidden hover:border-[#0060E1]/30 transition-all">
                   <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <group.icon className={cn("w-4 h-4", group.iconColor)} />
                       <span className="text-[11px] font-bold uppercase tracking-wider">{group.title}</span>
                     </div>
                     <span className="bg-[#0060E1]/10 text-[#0060E1] text-[10px] font-black px-2 py-0.5 rounded">
                       {group.items.length}
                     </span>
                   </div>
                   <div className="divide-y divide-slate-100">
                     {group.items.map((item, i) => (
                       <div key={i} className="px-5 py-4 flex items-center justify-between group/item">
                         <div>
                           <p className="text-sm font-bold tracking-tight mb-1 group-hover/item:text-[#0060E1] transition-colors">{item.label}</p>
                           <p className="text-xs text-slate-400 leading-relaxed">{item.detail}</p>
                         </div>
                         <ChevronRight size={14} className="text-slate-200 group-hover/item:text-[#0060E1] group-hover/item:translate-x-1 transition-all" />
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
             </div>
           )}
         </div>
       </div>
     </div>
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
     title: 'PERLU PERHATIAN',
     icon: AlertTriangle,
     iconColor: 'text-red-500',
     priority: 'urgent',
     items: rescueConvs.map(c => ({
       label: c.customer_name || c.customer_number,
       detail: `Skor ${c.score}/100 — Ada kendala, perlu ditangani langsung.`,
     })),
   })
 }

 if (closingConvs.length > 0) {
   groups.push({
     title: 'SIAP CLOSING',
     icon: ArrowUpCircle,
     iconColor: 'text-emerald-500',
     priority: 'high',
     items: closingConvs.map(c => ({
       label: c.customer_name || c.customer_number,
       detail: `Skor ${c.score}/100 — Sudah di tahap akhir, siap closing.`,
     })),
   })
 }

 if (hotLeads.length > 0) {
   groups.push({
     title: 'LEAD POTENSIAL',
     icon: Sparkles,
     iconColor: 'text-[#0060E1]',
     priority: 'medium',
     items: hotLeads.map(c => ({
       label: c.customer_name || c.customer_number,
       detail: `Skor ${c.score}/100 — Minat tinggi, dorong ke closing.`,
     })),
   })
 }

 if (contactNow > 0) {
   groups.push({
     title: 'SEGERA HUBUNGI',
     icon: Clock,
     iconColor: 'text-amber-500',
     priority: 'medium',
     items: [{
       label: `${contactNow} prospek ditandai untuk dihubungi segera`,
       detail: 'Lihat detail di halaman Outreach.',
     }],
   })
 }

 return groups
}
