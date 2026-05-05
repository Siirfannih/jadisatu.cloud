'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { BookOpen, FileText, Briefcase, HelpCircle, Swords, Wrench, Database, ChevronRight, Activity, Loader2 } from 'lucide-react'
import type { KnowledgeFile } from './types'

const CATEGORY_CONFIG: Record<string, { icon: typeof BookOpen; color: string; bg: string }> = {
 knowledge: { icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
 'skill/sales': { icon: Briefcase, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
 'skill/conversation': { icon: FileText, color: 'text-purple-500', bg: 'bg-purple-500/10' },
 'skill/admin': { icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-500/10' },
}

function getCategoryConfig(cat: string) {
 return CATEGORY_CONFIG[cat] || { icon: Database, color: 'text-[#0060E1]', bg: 'bg-[#0060E1]/10' }
}

export default function CockpitKnowledge() {
 const [files, setFiles] = useState<KnowledgeFile[]>([])
 const [loading, setLoading] = useState(true)
 const [expanded, setExpanded] = useState<string | null>(null)

 useEffect(() => {
 fetch('/api/mandala/knowledge')
 .then(res => res.ok ? res.json() : { data: [] })
 .then(json => setFiles(json.data || []))
 .catch(() => setFiles([]))
 .finally(() => setLoading(false))
 }, [])

 if (loading) {
 return (
 <div className="space-y-4">
 {[1, 2, 3].map(i => (
 <div key={i} className="bg-white rounded-2xl p-6 flex items-center gap-6 animate-pulse">
 <div className="w-12 h-12 rounded-2xl bg-slate-50 " />
 <div className="space-y-2 flex-1">
 <div className="h-4 bg-slate-50 rounded w-1/4" />
 <div className="h-2 bg-slate-50 rounded w-1/2" />
 </div>
 </div>
 ))}
 </div>
 )
 }

 const grouped = files.reduce<Record<string, KnowledgeFile[]>>((acc, file) => {
 const cat = file.category
 if (!acc[cat]) acc[cat] = []
 acc[cat].push(file)
 return acc
 }, {})

 return (
 <div className="space-y-6 pb-20">
 <div className="flex items-center justify-between px-2">
 <div className="space-y-1">
 <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-3">
 <Database size={18} className="text-[#0060E1]" />
 Database Pengetahuan
 </h3>
 <p className="text-xs text-slate-400">
 {files.length} dokumen tersimpan untuk AI Mandala
 </p>
 </div>
 </div>

 {Object.entries(grouped).map(([category, catFiles]) => {
 const config = getCategoryConfig(category)
 const Icon = config.icon
 return (
 <div key={category} className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,96,225,0.08)] transition-all duration-300 overflow-hidden group">
 <div className={cn("p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50")}>
 <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border border-current bg-current/5", config.color)}>
 <Icon className="w-5 h-5" />
 </div>
 <div>
 <h4 className="font-bold text-sm uppercase tracking-widest">{category.replace('skill/', 'Skills: ').replace('knowledge', 'Knowledge Base')}</h4>
 <p className="text-xs text-slate-400 font-mono">{catFiles.length} DOKUMEN</p>
 </div>
 </div>
 <div className="divide-y divide-slate-100">
 {catFiles.map((file) => {
 const isExpanded = expanded === `${category}/${file.name}`
 return (
 <div key={file.name} className="group/file">
 <button
 onClick={() => setExpanded(isExpanded ? null : `${category}/${file.name}`)}
 className={cn(
 "w-full p-6 text-left hover:bg-slate-50/60 transition-all flex items-center justify-between",
 isExpanded && "bg-slate-50"
 )}
 >
 <div className="flex items-center gap-3">
 <FileText className={cn("w-4 h-4 transition-colors", isExpanded ? "text-[#0060E1]" : "text-slate-300")} />
 <span className="text-sm font-bold tracking-tight group-hover/file:text-[#0060E1] transition-colors">{file.name}</span>
 </div>
 <div className="flex items-center gap-4">
 <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-50">
 {file.content.length > 0 ? `${Math.ceil(file.content.length / 4)} TOKENS` : 'EMPTY'}
 </span>
 <ChevronRight className={cn("w-4 h-4 text-slate-200 transition-all", isExpanded && "rotate-90 text-[#0060E1]")} />
 </div>
 </button>
 {isExpanded && (
 <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-2">
 <div className="relative">
 <div className="absolute top-4 right-4 text-[9px] font-black text-slate-300 uppercase tracking-widest pointer-events-none">ISI DOKUMEN</div>
 <pre className="text-xs font-mono bg-slate-50 text-slate-500 rounded-2xl p-6 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto shadow-sm leading-relaxed">
 {file.content || '(Dokumen kosong)'}
 </pre>
 </div>
 </div>
 )}
 </div>
 )
 })}
 </div>
 </div>
 )
 })}

 {files.length === 0 && (
 <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-16 text-center space-y-6 shadow-sm">
 <BookOpen className="w-16 h-16 text-slate-200 mx-auto opacity-50" />
 <div className="space-y-2">
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Belum Ada Dokumen</p>
 <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed italic">
 Tambahkan dokumen ke database pengetahuan supaya Mandala lebih paham tentang bisnis Anda.
 </p>
 </div>
 </div>
 )}
 </div>
 )
}
