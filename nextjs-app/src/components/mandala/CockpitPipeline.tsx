'use client'

import { cn } from '@/lib/utils'
import { Bot, UserCheck } from 'lucide-react'
import type { MandalaStats } from './types'
import { TEMPERATURE_CONFIG } from './types'

interface Props {
  stats: MandalaStats | null
}

export default function CockpitPipeline({ stats }: Props) {
  return (
    <div className="space-y-6">
      {/* Temperature Bands */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Lead Temperature</h3>
          <p className="text-xs text-muted-foreground mt-1">Leads scored by engagement signals and buying intent</p>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEMPERATURE_CONFIG.map((temp) => (
            <div key={temp.key} className={cn("rounded-xl p-4 border text-center", temp.color)}>
              <p className="text-3xl font-bold">{stats?.leads?.by_temperature?.[temp.key] || 0}</p>
              <p className="text-sm font-medium mt-1">{temp.label}</p>
              <p className="text-xs opacity-60">Score {temp.range}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">Total Leads Scored</p>
          <p className="text-3xl font-bold">{stats?.leads?.total || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">Average Score</p>
          <p className="text-3xl font-bold">{stats?.leads?.avg_score || 0}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">Conversion Rate</p>
          <p className="text-3xl font-bold">{stats?.conversations?.conversion_rate || 0}%</p>
        </div>
      </div>

      {/* Handler Breakdown */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-4">Active Handlers</h3>
        <div className="flex gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Bot className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.conversations?.by_handler?.['mandala'] || 0}</p>
              <p className="text-xs text-muted-foreground">Mandala (AI)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.conversations?.by_handler?.['owner'] || 0}</p>
              <p className="text-xs text-muted-foreground">Owner (manual)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
