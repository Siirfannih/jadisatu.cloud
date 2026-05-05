'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, MessageSquare, ListChecks, Target,
  Radar, BookOpen, Shield, BarChart3,
  RefreshCw, Zap, Smartphone
} from 'lucide-react'
import {
  COMMAND_LABELS, STATUS_CONFIG, PRIORITY_CONFIG, SOURCE_LABELS,
  type OutreachQueueItem, type OutreachStatus
} from '@/lib/mandala-outreach'

import type { MandalaStats, Conversation, Prospect } from '@/components/mandala/types'
import CockpitOverview from '@/components/mandala/CockpitOverview'
import CockpitConversations from '@/components/mandala/CockpitConversations'
import CockpitTasks from '@/components/mandala/CockpitTasks'
import CockpitPipeline from '@/components/mandala/CockpitPipeline'
import CockpitOutreach from '@/components/mandala/CockpitOutreach'
import CockpitKnowledge from '@/components/mandala/CockpitKnowledge'
import CockpitPolicies from '@/components/mandala/CockpitPolicies'
import CockpitAnalytics from '@/components/mandala/CockpitAnalytics'
import CockpitWhatsApp from '@/components/mandala/CockpitWhatsApp'

type Section = 'overview' | 'whatsapp' | 'conversations' | 'tasks' | 'pipeline' | 'outreach' | 'knowledge' | 'policies' | 'analytics'

const SECTIONS: { key: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
  { key: 'conversations', label: 'Conversations', icon: MessageSquare },
  { key: 'tasks', label: 'Tasks', icon: ListChecks },
  { key: 'pipeline', label: 'Pipeline', icon: Target },
  { key: 'outreach', label: 'Outreach', icon: Radar },
  { key: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { key: 'policies', label: 'Policies', icon: Shield },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export default function MandalaCockpit() {
  const [stats, setStats] = useState<MandalaStats | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [outreachQueue, setOutreachQueue] = useState<OutreachQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [refreshing, setRefreshing] = useState(false)
  const [hunterQuery, setHunterQuery] = useState('')
  const [hunterRunning, setHunterRunning] = useState(false)

  const safeJson = async (res: Response) => {
    const ct = res.headers.get('content-type') || ''
    if (!res.ok || !ct.includes('application/json')) return null
    try { return await res.json() } catch { return null }
  }

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, convsRes, hunterRes, outreachRes, outreachStatsRes] = await Promise.all([
        fetch('/api/mandala/stats'),
        fetch('/api/mandala/conversations?status=active&limit=50'),
        fetch('/api/mandala/hunter?limit=50'),
        fetch('/api/mandala/outreach?limit=30'),
        fetch('/api/mandala/outreach?stats=true'),
      ])

      if (statsRes.status === 403) {
        setForbidden(true)
        return
      }

      const statsData = await safeJson(statsRes)
      const outreachStatsData = await safeJson(outreachStatsRes)
      if (statsData) {
        if (outreachStatsData) statsData.outreach = outreachStatsData
        setStats(statsData)
      }

      const convsData = await safeJson(convsRes)
      if (convsData) setConversations(convsData.data || [])

      const hunterData = await safeJson(hunterRes)
      if (hunterData) setProspects(hunterData.data || [])

      const outreachData = await safeJson(outreachRes)
      if (outreachData) setOutreachQueue(outreachData.data || [])
    } catch (err) {
      console.error('Failed to fetch mandala data:', err)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleTakeover = async (id: string) => {
    await fetch('/api/mandala/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'takeover' }),
    })
    fetchData()
  }

  const handleRelease = async (id: string) => {
    await fetch('/api/mandala/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'release' }),
    })
    fetchData()
  }

  const handleHunterRun = async () => {
    if (!hunterQuery.trim()) return
    setHunterRunning(true)
    try {
      await fetch('/api/mandala/hunter/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: hunterQuery.trim() }),
      })
      setHunterQuery('')
      setTimeout(fetchData, 5000)
    } catch (err) {
      console.error('Hunter run failed:', err)
    }
    setHunterRunning(false)
  }

  if (forbidden) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Zap className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Mandala Not Activated</h2>
          <p className="text-muted-foreground">Contact your administrator to enable Mandala for your account.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="h-10 bg-muted rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse h-28" />
          ))}
        </div>
        <div className="bg-card border border-border rounded-xl p-6 animate-pulse h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Zap className="w-7 h-7 text-orange-500" />
            Mandala Cockpit
          </h1>
          <p className="text-muted-foreground mt-1">
            Autonomous sales agent — conversations, pipeline, outreach, and training
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border hover:bg-muted transition-colors text-sm"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Section Navigation */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 overflow-x-auto">
        {SECTIONS.map((section) => (
          <button
            key={section.key}
            onClick={() => setActiveSection(section.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
              activeSection === section.key
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <section.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{section.label}</span>
          </button>
        ))}
      </div>

      {/* Section Content */}
      {activeSection === 'overview' && (
        <CockpitOverview stats={stats} onNavigate={(s) => setActiveSection(s as Section)} />
      )}

      {activeSection === 'whatsapp' && (
        <CockpitWhatsApp />
      )}

      {activeSection === 'conversations' && (
        <CockpitConversations
          conversations={conversations}
          onTakeover={handleTakeover}
          onRelease={handleRelease}
        />
      )}

      {activeSection === 'tasks' && (
        <CockpitTasks
          stats={stats}
          conversations={conversations}
          onNavigate={(s) => setActiveSection(s as Section)}
        />
      )}

      {activeSection === 'pipeline' && (
        <CockpitPipeline stats={stats} />
      )}

      {activeSection === 'outreach' && (
        <CockpitOutreach
          prospects={prospects}
          hunterQuery={hunterQuery}
          hunterRunning={hunterRunning}
          onQueryChange={setHunterQuery}
          onRunHunter={handleHunterRun}
        />
      )}

      {activeSection === 'knowledge' && (
        <CockpitKnowledge />
      )}

      {activeSection === 'policies' && (
        <CockpitPolicies />
      )}

      {activeSection === 'analytics' && (
        <CockpitAnalytics stats={stats} />
      )}
    </div>
  )
}
