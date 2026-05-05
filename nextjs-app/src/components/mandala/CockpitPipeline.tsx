'use client'

import { cn } from '@/lib/utils'
import { Bot, UserCheck, Flame, Thermometer, Activity, Target, Zap } from 'lucide-react'
import type { MandalaStats } from './types'
import { TEMPERATURE_CONFIG } from './types'

interface Props {
  stats: MandalaStats | null
}

export default function CockpitPipeline({ stats }: Props) {
  return (
    <div className="space-y-8 pb-10">
      {/* Temperature Bands - Premium Analysis Grid */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-lg overflow-hidden p-8 space-y-8">
        <div className="flex items-center justify-between">
           <div className="space-y-1">
              <h3 className="font-bold tracking-tight uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
                 <Thermometer size={18} className="text-[#0060E1]" />
                 Tingkat Minat Lead
              </h3>
              <p className="text-[10px] text-slate-400 font-light uppercase tracking-widest">
                 Seberapa tertarik lead berdasarkan interaksi mereka
              </p>
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TEMPERATURE_CONFIG.map((temp) => (
            <div key={temp.key} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 transition-all hover:bg-slate-50 group">
              <div className="flex items-center justify-between mb-4">
                 <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border opacity-50", temp.color, "border-current bg-current/5")}>
                    {temp.label}
                 </span>
                 <Flame size={12} className={cn("opacity-30 group-hover:opacity-100 transition-opacity", temp.color)} />
              </div>
              <p className={cn("text-3xl font-bold tracking-tight mb-1", temp.color)}>
                {stats?.leads?.by_temperature?.[temp.key] || 0}
              </p>
              <div className="flex items-center justify-between">
                 <span className="text-[9px] font-mono text-slate-400">SKOR {temp.range}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl hover:border-slate-300 transition-all relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Lead Terdata</p>
          <div className="flex items-end gap-3">
             <p className="text-4xl font-bold tracking-tighter">{stats?.leads?.total || 0}</p>
             <span className="text-[10px] text-[#0060E1] font-black uppercase tracking-widest mb-1 shadow-sm px-2 py-0.5 bg-[#0060E1]/10 rounded">Global</span>
          </div>
          <Activity size={80} className="absolute -bottom-4 -right-4 text-[#0060E1]/[0.03] group-hover:text-[#0060E1]/[0.05] transition-all" />
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl hover:border-slate-300 transition-all relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Rata-rata Skor</p>
          <div className="flex items-end gap-1">
             <p className="text-4xl font-bold tracking-tighter">{stats?.leads?.avg_score || 0}</p>
             <span className="text-lg font-light text-slate-300 tracking-tighter mb-1">/100</span>
          </div>
          <Target size={80} className="absolute -bottom-4 -right-4 text-[#0060E1]/[0.03] group-hover:text-amber-500/[0.05] transition-all" />
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl hover:border-slate-300 transition-all relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Tingkat Konversi</p>
          <div className="flex items-end gap-1">
             <p className="text-4xl font-bold tracking-tighter text-emerald-500">{stats?.conversations?.conversion_rate || 0}%</p>
          </div>
          <Zap size={80} className="absolute -bottom-4 -right-4 text-[#0060E1]/[0.03] group-hover:text-emerald-500/[0.05] transition-all" />
        </div>
      </div>

      {/* Handler Performance Split */}
      <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-lg space-y-8">
        <h3 className="font-bold text-sm uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
           <Activity size={18} className="text-emerald-500" />
           Siapa yang Menangani
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="flex items-center gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-200 group hover:border-[#0060E1]/50 transition-all">
            <div className="w-16 h-16 rounded-2xl bg-[#0060E1]/10 flex items-center justify-center text-[#0060E1] group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/5">
              <Bot size={32} />
            </div>
            <div>
              <p className="text-4xl font-bold tracking-tighter mb-1">{stats?.conversations?.by_handler?.['mandala'] || 0}</p>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-[#0060E1] rounded-full animate-pulse" />
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Mandala</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-200 group hover:border-emerald-500/50 transition-all">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/5">
              <UserCheck size={32} />
            </div>
            <div>
              <p className="text-4xl font-bold tracking-tighter mb-1">{stats?.conversations?.by_handler?.['owner'] || 0}</p>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ditangani Manual</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
