'use client'

import { cn } from '@/lib/utils'
import {
 MessageSquare, TrendingUp, Target, Search,
 Bot, UserCheck, ArrowDownRight, ArrowUpRight,
 Activity, Zap, BarChart3, PieChart
} from 'lucide-react'
import type { MandalaStats } from './types'
import { PHASES, TEMPERATURE_CONFIG } from './types'

interface Props {
 stats: MandalaStats | null
}

export default function CockpitAnalytics({ stats }: Props) {
 const totalConvs = stats?.conversations?.total || 0
 const activeConvs = stats?.conversations?.active || 0
 const mandalaHandling = stats?.conversations?.by_handler?.['mandala'] || 0
 const automationRate = activeConvs > 0 ? Math.round((mandalaHandling / activeConvs) * 100) : 0

 return (
 <div className="space-y-5 pb-20">
 {/* Strategic Key Metrics Grid */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
 <MetricCard
 label="Total Percakapan"
 value={totalConvs}
 icon={MessageSquare}
 color="text-[#0060E1]"
 />
 <MetricCard
 label="Tingkat Konversi"
 value={`${stats?.conversations?.conversion_rate || 0}%`}
 icon={TrendingUp}
 color="text-emerald-500"
 />
 <MetricCard
 label="Rata-rata Skor Lead"
 value={`${stats?.leads?.avg_score || 0}/100`}
 icon={Target}
 color="text-amber-500"
 />
 <MetricCard
 label="Tingkat Otomatisasi"
 value={`${automationRate}%`}
 icon={Bot}
 color="text-purple-500"
 />
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Phase Distribution Analysis */}
 <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-6 space-y-5">
 <div className="flex items-center justify-between">
 <div className="space-y-1">
 <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-3">
 <PieChart size={18} className="text-[#0060E1]" />
 Distribusi Tahap Penjualan
 </h3>
 </div>
 </div>
 
 <div className="space-y-6">
 {PHASES.map((phase) => {
 const count = stats?.conversations?.by_phase?.[phase.key] || 0
 const pct = totalConvs > 0 ? Math.round((count / totalConvs) * 100) : 0
 return (
 <div key={phase.key} className="space-y-2 group">
 <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
 <span className={cn("transition-colors", phase.text)}>{phase.label}</span>
 <span className="text-slate-400 group-hover:text-slate-900 transition-colors">{count} ({pct}%)</span>
 </div>
 <div className="h-2 bg-slate-50 rounded-full overflow-hidden ">
 <div
 className={cn("h-full rounded-full transition-all duration-1000 ease-out shadow-sm shadow-current/20", phase.color)}
 style={{ width: `${Math.max(pct, 2)}%` }}
 />
 </div>
 </div>
 )
 })}
 </div>
 </div>

 {/* Temperature Distribution Grid */}
 <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-6 space-y-5">
 <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-3">
 <BarChart3 size={18} className="text-orange-500" />
 Tingkat Minat Lead
 </h3>
 <div className="grid grid-cols-2 gap-4">
 {TEMPERATURE_CONFIG.map((temp) => {
 const count = stats?.leads?.by_temperature?.[temp.key] || 0
 const total = stats?.leads?.total || 0
 const pct = total > 0 ? Math.round((count / total) * 100) : 0
 return (
 <div key={temp.key} className={cn("rounded-2xl p-6 border transition-all hover:bg-slate-50/60 group", temp.border, "bg-slate-50")}>
 <p className={cn("text-3xl font-bold mb-1", temp.color)}>{count}</p>
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{temp.label}</p>
 <div className="flex items-baseline gap-1">
 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{pct}% DARI TOTAL</p>
 </div>
 </div>
 )
 })}
 </div>
 </div>
 </div>

 {/* Hunter Strategic Performance */}
 <div className="bg-white rounded-2xl p-6 shadow-sm overflow-hidden relative group">
 <div className="flex items-center justify-between mb-5 relative z-10">
 <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-3">
 <Search size={18} className="text-emerald-500" />
 Performa Pencarian Prospek
 </h3>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
 <div className="bg-slate-50 p-6 rounded-2xl group/stat hover:border-[#0060E1]/50 transition-all">
 <p className="text-3xl font-bold mb-2 group-hover/stat:scale-105 transition-transform origin-left">{stats?.hunter?.total_prospects || 0}</p>
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Ditemukan</p>
 </div>
 </div>
 
 <div className="bg-slate-50 p-6 rounded-2xl group/stat hover:border-orange-500/50 transition-all">
 <p className="text-3xl font-bold text-orange-500 mb-2 group-hover/stat:scale-105 transition-transform origin-left">{stats?.hunter?.contact_now || 0}</p>
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Perlu Dihubungi Segera</p>
 </div>
 </div>

 <div className="bg-slate-50 p-6 rounded-2xl group/stat hover:border-emerald-500/50 transition-all">
 <p className="text-3xl font-bold text-emerald-500 mb-2 group-hover/stat:scale-105 transition-transform origin-left">{stats?.hunter?.contacted || 0}</p>
 <div className="flex items-center gap-2">
 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sudah Dihubungi</p>
 </div>
 </div>
 </div>

 <Activity size={150} className="absolute -bottom-10 -right-10 text-[#0060E1]/[0.03] group-hover:text-[#0060E1]/[0.05] transition-all" />
 </div>
 </div>
 )
}

function MetricCard({ label, value, icon: Icon, color }: {
 label: string
 value: string | number
 icon: any
 color: string
}) {
 return (
 <div className="bg-white rounded-2xl p-6 shadow-sm hover:border-slate-300 transition-all group relative overflow-hidden">
 <div className="flex items-center justify-between mb-3">
 <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border border-current bg-current/5", color)}>
 <Icon className="w-6 h-6" />
 </div>
 </div>
 <p className="text-3xl font-bold group-hover:scale-105 transition-transform origin-left">{value}</p>
 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2">{label}</p>
 
 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
 <ArrowUpRight size={16} className={color} />
 </div>
 </div>
 )
}
