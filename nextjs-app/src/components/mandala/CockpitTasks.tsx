'use client'

import { cn } from '@/lib/utils'
import {
  AlertTriangle, ArrowUpCircle, Clock, Sparkles, CheckCircle2
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

export default function CockpitTasks({ stats, conversations, onNavigate }: Props) {
  const groups = buildTaskGroups(stats, conversations)
  const totalTasks = groups.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalTasks} operational {totalTasks === 1 ? 'task' : 'tasks'} requiring attention
        </p>
      </div>

      {totalTasks === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">All clear</p>
          <p className="text-sm text-muted-foreground/60 mt-1">No tasks need attention right now.</p>
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
