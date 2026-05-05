'use client'

import { cn } from '@/lib/utils'
import {
  MessageSquare, TrendingUp, Target, Search,
  Bot, UserCheck, ArrowRight
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
      icon: MessageSquare, iconBg: 'bg-blue-50', iconColor: 'text-blue-500',
      label: 'Conversations', value: stats?.conversations?.total || 0,
      sub: `${stats?.conversations?.active || 0} active`, section: 'conversations',
    },
    {
      icon: TrendingUp, iconBg: 'bg-green-50', iconColor: 'text-green-500',
      label: 'Conversion', value: `${stats?.conversations?.conversion_rate || 0}%`,
      sub: 'reached closing phase', section: 'analytics',
    },
    {
      icon: Target, iconBg: 'bg-amber-50', iconColor: 'text-amber-500',
      label: 'Avg Score', value: stats?.leads?.avg_score || 0,
      sub: `${stats?.leads?.total || 0} leads scored`, section: 'pipeline',
    },
    {
      icon: Search, iconBg: 'bg-purple-50', iconColor: 'text-purple-500',
      label: 'Prospects', value: stats?.hunter?.total_prospects || 0,
      sub: `${stats?.hunter?.contacted || 0} contacted`, section: 'outreach',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <button
            key={card.label}
            onClick={() => onNavigate(card.section)}
            className="bg-card border border-border rounded-xl p-4 shadow-sm text-left hover:border-orange-200 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.iconBg)}>
                <card.icon className={cn("w-5 h-5", card.iconColor)} />
              </div>
              <span className="text-sm text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{card.sub}</p>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
            </div>
          </button>
        ))}
      </div>

      {/* Phase Pipeline */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Sales Pipeline</h2>
          <button
            onClick={() => onNavigate('pipeline')}
            className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
          >
            View details <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {PHASES.map((phase) => {
            const count = stats?.conversations?.by_phase?.[phase.key] || 0
            const pct = phaseTotal > 0 ? Math.round((count / phaseTotal) * 100) : 0
            return (
              <div key={phase.key} className={cn("flex-1 min-w-[130px] rounded-xl p-4 border border-border", phase.lightBg)}>
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("text-xs font-semibold uppercase tracking-wider", phase.text)}>{phase.label}</span>
                  <span className="text-xs text-muted-foreground">{phase.range}</span>
                </div>
                <p className={cn("text-3xl font-bold", phase.text)}>{count}</p>
                <div className="mt-2 h-1.5 bg-white/50 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", phase.color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Handler Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Bot className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium">Mandala Handling</span>
          </div>
          <p className="text-3xl font-bold text-purple-600">{stats?.conversations?.by_handler?.['mandala'] || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">conversations on autopilot</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <UserCheck className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium">Owner Handling</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats?.conversations?.by_handler?.['owner'] || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">conversations taken over</p>
        </div>
      </div>
    </div>
  )
}
