'use client'

import { cn } from '@/lib/utils'
import {
  MessageSquare, TrendingUp, Target, Search,
  Bot, UserCheck, ArrowRight, Activity, Zap, Users
} from 'lucide-react'
import type { MandalaStats } from './types'
import { PHASES } from './types'

interface Props {
  stats: MandalaStats | null
  onNavigate: (section: string) => void
}

export default function CockpitOverview({ stats, onNavigate }: Props) {
  const phaseTotal = PHASES.reduce(
    (sum, p) => sum + (stats?.conversations?.by_phase?.[p.key] || 0), 0
  )

  const statCards = [
    {
      icon: MessageSquare, iconColor: 'text-blue-400',
      label: 'PERCAKAPAN', value: stats?.conversations?.total || 0,
      sub: `${stats?.conversations?.active || 0} aktif saat ini`, section: 'conversations',
    },
    {
      icon: TrendingUp, iconColor: 'text-emerald-400',
      label: 'RATE KONVERSI', value: `${stats?.conversations?.conversion_rate || 0}%`,
      sub: 'lead berhasil closing', section: 'analytics',
    },
    {
      icon: Target, iconColor: 'text-amber-400',
      label: 'SKOR RATA-RATA', value: stats?.leads?.avg_score || 0,
      sub: `${stats?.leads?.total || 0} lead terdata`, section: 'pipeline',
    },
    {
      icon: Search, iconColor: 'text-[#0060E1]',
      label: 'TOTAL PROSPEK', value: stats?.hunter?.total_prospects || 0,
      sub: `${stats?.hunter?.contacted || 0} sudah dihubungi`, section: 'outreach',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Stat Cards - Premium Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <button
            key={card.label}
            onClick={() => onNavigate(card.section)}
            className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl text-left hover:border-slate-300 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <card.icon size={64} />
            </div>
            <div className="flex items-center justify-between mb-4">
               <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{card.label}</div>
               <card.icon className={cn("w-4 h-4", card.iconColor)} />
            </div>
            <p className="text-3xl font-bold tracking-tighter mb-1">{card.value}</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 font-light">{card.sub}</p>
              <ArrowRight className="w-4 h-4 text-[#0060E1] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </div>
          </button>
        ))}
      </div>

      {/* Sales Pipeline Visualization */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-lg space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-6 bg-[#0060E1] rounded-full" />
               <h2 className="text-xl font-bold tracking-tight uppercase tracking-widest">Pipeline Penjualan</h2>
            </div>
            <p className="text-xs text-slate-500 font-light uppercase tracking-widest ml-4">Status percakapan dari AI Mandala</p>
          </div>
          <button
            onClick={() => onNavigate('pipeline')}
            className="px-5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest hover:border-[#0060E1] hover:text-[#0060E1] transition-all flex items-center gap-2"
          >
            Lihat Detail <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PHASES.map((phase) => {
            const count = stats?.conversations?.by_phase?.[phase.key] || 0
            const pct = phaseTotal > 0 ? Math.round((count / phaseTotal) * 100) : 0
            return (
              <div key={phase.key} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 hover:border-slate-300 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{phase.label}</span>
                  <span className="text-[9px] font-mono text-slate-300">{phase.range}</span>
                </div>
                <div className="flex items-end justify-between">
                   <p className="text-3xl font-bold tracking-tight">{count}</p>
                   <span className="text-[10px] font-black text-[#0060E1] bg-[#0060E1]/10 px-1.5 py-0.5 rounded">{pct}%</span>
                </div>
                <div className="h-1 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-[#0060E1] rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Handling Distribution Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 relative overflow-hidden group hover:border-[#0060E1]/30 transition-all shadow-xl">
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-[#0060E1]/10 flex items-center justify-center text-[#0060E1]">
               <Bot size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ditangani Mandala</p>
              <p className="text-3xl font-bold tracking-tighter">{stats?.conversations?.by_handler?.['mandala'] || 0}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-light leading-relaxed mb-4">Percakapan yang ditangani AI Mandala secara otomatis.</p>
          <div className="absolute -bottom-6 -right-6 text-[#0060E1] opacity-5 group-hover:opacity-10 transition-opacity">
            <Bot size={120} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 relative overflow-hidden group hover:border-emerald-500/30 transition-all shadow-xl">
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
               <UserCheck size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ditangani Manual</p>
              <p className="text-3xl font-bold tracking-tighter text-emerald-500">{stats?.conversations?.by_handler?.['owner'] || 0}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-light leading-relaxed mb-4">Percakapan yang Anda tangani secara langsung untuk closing.</p>
          <div className="absolute -bottom-6 -right-6 text-emerald-500 opacity-5 group-hover:opacity-10 transition-opacity">
            <UserCheck size={120} />
          </div>
        </div>
      </div>
    </div>
  )
}
