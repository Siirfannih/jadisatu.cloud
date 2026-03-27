'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  MessageSquare, Users, Target, TrendingUp,
  Search, Phone, Globe, Star, ChevronRight,
  RefreshCw, Zap, UserCheck, Bot, ArrowRight,
  MapPin, ExternalLink, Send, Play, X as XIcon,
  CheckCircle
} from 'lucide-react'
import {
  COMMAND_LABELS, STATUS_CONFIG, PRIORITY_CONFIG, SOURCE_LABELS,
  type OutreachQueueItem, type OutreachStatus
} from '@/lib/mandala-outreach'

// Types
interface MandalaStats {
  conversations: {
    total: number
    active: number
    by_phase: Record<string, number>
    by_handler: Record<string, number>
    conversion_rate: number
  }
  leads: {
    total: number
    avg_score: number
    by_temperature: Record<string, number>
  }
  hunter: {
    total_prospects: number
    contacted: number
    contact_now: number
  }
  outreach?: {
    total: number
    actionable: number
    by_status: Record<string, number>
  }
}

interface Conversation {
  id: string
  tenant_id: string
  customer_name: string
  customer_number: string
  channel: string
  status: string
  phase: string
  current_handler: string
  owner_active: boolean
  score: number
  updated_at: string
}

interface Prospect {
  id: string
  business_name: string
  address: string
  phone: string
  website: string
  rating: number
  review_count: number
  status: string
  decision: string
  pain_type: string
  pain_score: number
  maps_url: string
  created_at: string
}

// Phase config
const PHASES = [
  { key: 'kenalan', label: 'Kenalan', color: 'bg-blue-500', lightBg: 'bg-blue-50', text: 'text-blue-600', range: '0-30' },
  { key: 'gali_masalah', label: 'Gali Masalah', color: 'bg-amber-500', lightBg: 'bg-amber-50', text: 'text-amber-600', range: '31-50' },
  { key: 'tawarkan_solusi', label: 'Tawarkan Solusi', color: 'bg-purple-500', lightBg: 'bg-purple-50', text: 'text-purple-600', range: '51-79' },
  { key: 'closing', label: 'Closing', color: 'bg-green-500', lightBg: 'bg-green-50', text: 'text-green-600', range: '80+' },
  { key: 'rescue', label: 'Rescue', color: 'bg-red-500', lightBg: 'bg-red-50', text: 'text-red-600', range: 'resistance' },
]

const PROSPECT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  discovered: { bg: 'bg-slate-100', text: 'text-slate-600' },
  enriched: { bg: 'bg-blue-100', text: 'text-blue-600' },
  qualified: { bg: 'bg-amber-100', text: 'text-amber-600' },
  contacted: { bg: 'bg-green-100', text: 'text-green-600' },
}

const DECISION_COLORS: Record<string, { bg: string; text: string }> = {
  contact_now: { bg: 'bg-red-100', text: 'text-red-700' },
  high_priority: { bg: 'bg-orange-100', text: 'text-orange-700' },
  low_priority: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  skip: { bg: 'bg-gray-100', text: 'text-gray-500' },
}

export default function MandalaPage() {
  const [stats, setStats] = useState<MandalaStats | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [outreachQueue, setOutreachQueue] = useState<OutreachQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [activeTab, setActiveTab] = useState<'pipeline' | 'conversations' | 'hunter' | 'outreach'>('pipeline')
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
        fetch('/api/mandala/conversations?status=active&limit=20'),
        fetch('/api/mandala/hunter?limit=20'),
        fetch('/api/mandala/outreach?limit=30'),
        fetch('/api/mandala/outreach?stats=true'),
      ])

      // Check for forbidden (owner-only access)
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
    // Auto-refresh every 30s
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
      // Refresh prospects after a short delay (pipeline runs async)
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
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Mandala AI dashboard is only available for the owner account.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse h-28" />
          ))}
        </div>
        <div className="bg-card border border-border rounded-xl p-6 animate-pulse h-96" />
      </div>
    )
  }

  const phaseTotal = PHASES.reduce((sum, p) => sum + (stats?.conversations?.by_phase?.[p.key] || 0), 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Zap className="w-7 h-7 text-orange-500" />
            Mandala
          </h1>
          <p className="text-muted-foreground mt-1">Autonomous B2B sales agent dashboard</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">Conversations</span>
          </div>
          <p className="text-2xl font-bold">{stats?.conversations?.total || 0}</p>
          <p className="text-xs text-muted-foreground">{stats?.conversations?.active || 0} active</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Conversion</span>
          </div>
          <p className="text-2xl font-bold">{stats?.conversations?.conversion_rate || 0}%</p>
          <p className="text-xs text-muted-foreground">reached closing phase</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Target className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm text-muted-foreground">Avg Score</span>
          </div>
          <p className="text-2xl font-bold">{stats?.leads?.avg_score || 0}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
          <p className="text-xs text-muted-foreground">{stats?.leads?.total || 0} leads scored</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Search className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-sm text-muted-foreground">Hunter</span>
          </div>
          <p className="text-2xl font-bold">{stats?.hunter?.total_prospects || 0}</p>
          <p className="text-xs text-muted-foreground">{stats?.hunter?.contacted || 0} contacted</p>
        </div>
      </div>

      {/* Phase Pipeline */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Lead Pipeline</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {PHASES.map((phase) => {
            const count = stats?.conversations?.by_phase?.[phase.key] || 0
            const pct = phaseTotal > 0 ? Math.round((count / phaseTotal) * 100) : 0
            return (
              <div
                key={phase.key}
                className={cn("flex-1 min-w-[140px] rounded-xl p-4 border border-border", phase.lightBg)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("text-xs font-semibold uppercase tracking-wider", phase.text)}>
                    {phase.label}
                  </span>
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

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
        {[
          { key: 'pipeline' as const, label: 'Lead Scores', icon: Target },
          { key: 'conversations' as const, label: 'Conversations', icon: MessageSquare },
          { key: 'hunter' as const, label: 'Hunter Prospects', icon: Search },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'pipeline' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold">Lead Temperature</h3>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'hot', label: 'Hot', emoji: '70+', color: 'bg-red-50 border-red-200 text-red-700' },
              { key: 'warm', label: 'Warm', emoji: '50-69', color: 'bg-orange-50 border-orange-200 text-orange-700' },
              { key: 'lukewarm', label: 'Lukewarm', emoji: '30-49', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
              { key: 'cold', label: 'Cold', emoji: '0-29', color: 'bg-blue-50 border-blue-200 text-blue-700' },
            ].map((temp) => (
              <div key={temp.key} className={cn("rounded-xl p-4 border text-center", temp.color)}>
                <p className="text-2xl font-bold">{stats?.leads?.by_temperature?.[temp.key] || 0}</p>
                <p className="text-sm font-medium mt-1">{temp.label}</p>
                <p className="text-xs opacity-60">Score {temp.emoji}</p>
              </div>
            ))}
          </div>

          {/* Handler breakdown */}
          <div className="p-4 border-t border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Active Handler</h4>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">{stats?.conversations?.by_handler?.['mandala'] || 0} Mandala</span>
              </div>
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">{stats?.conversations?.by_handler?.['owner'] || 0} Owner</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'conversations' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Active Conversations</h3>
            <span className="text-sm text-muted-foreground">{conversations.length} active</span>
          </div>
          {conversations.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No active conversations yet.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Conversations will appear here when customers message via WhatsApp.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((conv) => {
                const phaseConfig = PHASES.find(p => p.key === conv.phase) || PHASES[0]
                return (
                  <div key={conv.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", phaseConfig.lightBg)}>
                          <Users className={cn("w-5 h-5", phaseConfig.text)} />
                        </div>
                        <div>
                          <p className="font-medium">{conv.customer_name || conv.customer_number}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", phaseConfig.lightBg, phaseConfig.text)}>
                              {phaseConfig.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Score: {conv.score || 0}/100
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {conv.channel}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1",
                          conv.current_handler === 'owner'
                            ? "bg-blue-50 text-blue-600"
                            : "bg-purple-50 text-purple-600"
                        )}>
                          {conv.current_handler === 'owner' ? (
                            <><UserCheck className="w-3 h-3" /> Owner</>
                          ) : (
                            <><Bot className="w-3 h-3" /> Mandala</>
                          )}
                        </span>
                        {conv.current_handler === 'mandala' ? (
                          <button
                            onClick={() => handleTakeover(conv.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
                          >
                            Take Over
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRelease(conv.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors font-medium"
                          >
                            Let Mandala
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'hunter' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Hunter Prospects</h3>
              <span className="text-sm text-muted-foreground">{prospects.length} prospects</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={hunterQuery}
                onChange={(e) => setHunterQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHunterRun()}
                placeholder="Search query, e.g. hotel bali, klinik denpasar..."
                className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button
                onClick={handleHunterRun}
                disabled={hunterRunning || !hunterQuery.trim()}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  hunterRunning || !hunterQuery.trim()
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-orange-500 text-white hover:bg-orange-600"
                )}
              >
                {hunterRunning ? 'Running...' : 'Run Hunter'}
              </button>
            </div>
          </div>
          {prospects.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No prospects yet.</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Enable hunter in mandala-engine to start discovering businesses.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {prospects.map((prospect) => {
                const statusColor = PROSPECT_STATUS_COLORS[prospect.status] || PROSPECT_STATUS_COLORS.discovered
                const decisionColor = DECISION_COLORS[prospect.decision] || DECISION_COLORS.skip
                return (
                  <div key={prospect.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{prospect.business_name}</p>
                          {prospect.maps_url && (
                            <a href={prospect.maps_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          {prospect.address && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {prospect.address}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColor.bg, statusColor.text)}>
                            {prospect.status}
                          </span>
                          {prospect.decision && (
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", decisionColor.bg, decisionColor.text)}>
                              {prospect.decision.replace('_', ' ')}
                            </span>
                          )}
                          {prospect.pain_type && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                              {prospect.pain_type.replace('_', ' ')}
                            </span>
                          )}
                          {prospect.rating && (
                            <span className="text-xs flex items-center gap-0.5 text-amber-600">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {prospect.rating} ({prospect.review_count})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {prospect.pain_score > 0 && (
                          <div className={cn(
                            "text-lg font-bold",
                            prospect.pain_score >= 80 ? "text-red-600" :
                            prospect.pain_score >= 50 ? "text-orange-600" :
                            "text-slate-500"
                          )}>
                            {prospect.pain_score}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {prospect.phone && (
                            <Phone className="w-3.5 h-3.5 text-green-500" />
                          )}
                          {prospect.website && (
                            <Globe className="w-3.5 h-3.5 text-blue-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
