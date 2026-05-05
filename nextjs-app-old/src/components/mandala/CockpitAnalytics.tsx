'use client'

import { cn } from '@/lib/utils'
import {
  MessageSquare, TrendingUp, Target, Search,
  Bot, UserCheck, ArrowDownRight, ArrowUpRight
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
  const ownerHandling = stats?.conversations?.by_handler?.['owner'] || 0
  const automationRate = activeConvs > 0 ? Math.round((mandalaHandling / activeConvs) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Conversations"
          value={totalConvs}
          icon={MessageSquare}
          iconColor="text-blue-500"
          iconBg="bg-blue-50"
        />
        <MetricCard
          label="Conversion Rate"
          value={`${stats?.conversations?.conversion_rate || 0}%`}
          icon={TrendingUp}
          iconColor="text-green-500"
          iconBg="bg-green-50"
        />
        <MetricCard
          label="Average Lead Score"
          value={`${stats?.leads?.avg_score || 0}/100`}
          icon={Target}
          iconColor="text-amber-500"
          iconBg="bg-amber-50"
        />
        <MetricCard
          label="Automation Rate"
          value={`${automationRate}%`}
          icon={Bot}
          iconColor="text-purple-500"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Phase Distribution */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-4">Phase Distribution</h3>
        <div className="space-y-3">
          {PHASES.map((phase) => {
            const count = stats?.conversations?.by_phase?.[phase.key] || 0
            const pct = totalConvs > 0 ? Math.round((count / totalConvs) * 100) : 0
            return (
              <div key={phase.key} className="flex items-center gap-3">
                <span className={cn("text-xs font-semibold w-28 shrink-0", phase.text)}>{phase.label}</span>
                <div className="flex-1 h-6 bg-muted rounded-lg overflow-hidden relative">
                  <div
                    className={cn("h-full rounded-lg transition-all", phase.color)}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                    {count} ({pct}%)
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Temperature Distribution */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-4">Lead Temperature Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEMPERATURE_CONFIG.map((temp) => {
            const count = stats?.leads?.by_temperature?.[temp.key] || 0
            const total = stats?.leads?.total || 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={temp.key} className={cn("rounded-xl p-4 border text-center", temp.color)}>
                <p className="text-3xl font-bold">{count}</p>
                <p className="text-sm font-medium mt-1">{temp.label}</p>
                <p className="text-xs opacity-60">{pct}% of total</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Hunter Performance */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-4">Hunter Performance</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold">{stats?.hunter?.total_prospects || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Discovered</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-600">{stats?.hunter?.contact_now || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Contact Now</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{stats?.hunter?.contacted || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Contacted</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, iconColor, iconBg }: {
  label: string
  value: string | number
  icon: typeof MessageSquare
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}
