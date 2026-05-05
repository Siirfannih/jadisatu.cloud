'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Shield, User, Crosshair, Headphones, ChevronRight, Activity, Loader2, Zap, Fingerprint } from 'lucide-react'

interface PolicyData {
 rules: string
 identity: string
 modes: {
 sales_shadow: string
 ceo_assistant: string
 }
}

const SECTIONS = [
 { key: 'identity', label: 'Identitas Mandala', icon: Fingerprint, description: 'Cara Mandala memperkenalkan diri kepada calon klien', color: 'text-[#0060E1]' },
 { key: 'rules', label: 'Aturan Komunikasi', icon: Shield, description: 'Aturan dasar yang mengontrol cara Mandala berkomunikasi', color: 'text-emerald-500' },
 { key: 'sales_shadow', label: 'Mode Penjualan Otomatis', icon: Crosshair, description: 'Cara Mandala menangani pesan secara otomatis', color: 'text-orange-500' },
 { key: 'ceo_assistant', label: 'Mode Asisten Pribadi', icon: Headphones, description: 'Pengaturan Mandala saat membantu Anda secara langsung', color: 'text-purple-500' },
] as const

export default function CockpitPolicies() {
 const [data, setData] = useState<PolicyData | null>(null)
 const [loading, setLoading] = useState(true)
 const [expanded, setExpanded] = useState<string | null>('identity')

 useEffect(() => {
 fetch('/api/mandala/policies')
 .then(res => res.ok ? res.json() : { data: null })
 .then(json => setData(json.data || null))
 .catch(() => setData(null))
 .finally(() => setLoading(false))
 }, [])

 if (loading) {
 return (
 <div className="space-y-4">
 {[1, 2, 3, 4].map(i => (
 <div key={i} className="bg-white rounded-2xl p-6 flex items-center gap-6 animate-pulse">
 <div className="w-12 h-12 rounded-2xl bg-slate-50" />
 <div className="space-y-2 flex-1">
 <div className="h-4 bg-slate-50 rounded w-1/3" />
 <div className="h-2 bg-slate-50 rounded w-1/2 opacity-50" />
 </div>
 </div>
 ))}
 </div>
 )
 }

 if (!data) {
 return (
 <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-16 text-center space-y-6 shadow-sm">
 <Shield className="w-16 h-16 text-slate-200 mx-auto opacity-50" />
 <div className="space-y-2">
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gagal Memuat</p>
 <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed italic">
 Gagal memuat pengaturan. Pastikan konfigurasi Mandala sudah tersedia.
 </p>
 </div>
 </div>
 )
 }

 function getContent(key: string): string {
 if (!data) return ''
 if (key === 'identity') return data.identity
 if (key === 'rules') return data.rules
 if (key === 'sales_shadow') return data.modes.sales_shadow
 if (key === 'ceo_assistant') return data.modes.ceo_assistant
 return ''
 }

 return (
 <div className="space-y-6 pb-20">
 <div className="px-2">
 <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-3">
 <Zap size={18} className="text-amber-500" />
 Pengaturan AI
 </h3>
 <p className="text-xs text-slate-400 mt-1">
 Aturan dan perilaku AI Mandala yang sedang aktif
 </p>
 </div>

 <div className="space-y-4">
 {SECTIONS.map((section) => {
 const content = getContent(section.key)
 const isExpanded = expanded === section.key
 const Icon = section.icon
 return (
 <div key={section.key} className={cn(
 "bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,96,225,0.08)] transition-all duration-300 overflow-hidden group",
 isExpanded && "border-[#0060E1]/30 bg-blue-50/50"
 )}>
 <button
 onClick={() => setExpanded(isExpanded ? null : section.key)}
 className="w-full p-6 text-left transition-all flex items-center gap-6"
 >
 <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-current bg-current/5 transition-transform group-hover:scale-110", section.color)}>
 <Icon size={24} />
 </div>
 <div className="flex-1 min-w-0">
 <h4 className="font-bold text-lg tracking-tight group-hover:text-slate-900 transition-colors">{section.label}</h4>
 <p className="text-xs text-slate-400 mt-1 leading-relaxed">{section.description}</p>
 </div>
 <div className="flex items-center gap-6 shrink-0">
 <div className="hidden sm:block text-right">
 <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Ukuran</p>
 <p className="text-[11px] font-mono text-slate-400">{content ? `${content.split('\n').length} BARIS` : 'EMPTY'}</p>
 </div>
 <ChevronRight className={cn("w-5 h-5 text-slate-200 transition-all", isExpanded && "rotate-90 text-[#0060E1]")} />
 </div>
 </button>
 
 {isExpanded && content && (
 <div className="px-8 pb-8 animate-in fade-in slide-in-from-top-4 duration-500">
 <div className="relative">
 <div className="absolute top-4 right-4 text-[9px] font-black text-slate-300 uppercase tracking-widest pointer-events-none">KONFIGURASI</div>
 <pre className="text-xs font-mono bg-slate-50 text-slate-500 rounded-2xl p-6 overflow-x-auto whitespace-pre-wrap max-h-[500px] overflow-y-auto leading-relaxed shadow-sm">
 {content}
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
}
