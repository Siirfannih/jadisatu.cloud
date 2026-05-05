'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3, TrendingUp, DollarSign, Users, Target,
  Sparkles, Bot, ArrowUpRight, ArrowDownRight,
  PenTool, MessageCircle, MessageSquare, Search,
  UserCheck, Activity, Zap, PieChart as PieChartIcon,
  Loader2, FileText, CheckCircle2, Lightbulb,
} from 'lucide-react'
import type { MandalaStats } from '@/components/mandala/types'
import { PHASES, TEMPERATURE_CONFIG } from '@/components/mandala/types'
import { cn } from '@/lib/utils'

const brand = {
  primary: '#0060E1',
  primarySoft: '#EFF6FF',
  accent: '#6366F1',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  orange: '#F97316',
}

const card = 'bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)]'

interface BusinessData {
  overview: {
    total_prospects: number
    total_conversations: number
    total_messages: number
    conversion_rate: number
    avg_lead_score: number
  }
  funnel: Array<{ stage: string; count: number; pct: number }>
  conversations_by_phase: Record<string, number>
  leads_temperature: { hot: number; warm: number; cold: number }
  hunter: {
    total: number
    contact_now: number
    high_priority: number
    categories: Array<{ name: string; count: number }>
  }
  content: {
    total: number
    published: number
    draft: number
    ideas: number
  }
  tasks: {
    total: number
    completed: number
    active: number
  }
}

type TabKey = 'bisnis' | 'mandala'

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('bisnis')
  const [mandalaStats, setMandalaStats] = useState<MandalaStats | null>(null)
  const [businessData, setBusinessData] = useState<BusinessData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [mandalaRes, businessRes] = await Promise.all([
          fetch('/api/mandala/stats'),
          fetch('/api/analytics'),
        ])

        if (mandalaRes.ok) {
          const data = await mandalaRes.json()
          setMandalaStats(data)
        }

        if (businessRes.ok) {
          const json = await businessRes.json()
          if (json.data) setBusinessData(json.data)
        }
      } catch (err) {
        console.error('Failed to load analytics:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const stats = mandalaStats || {
    conversations: { total: 0, active: 0, by_phase: {}, by_handler: {}, conversion_rate: 0 },
    leads: { total: 0, avg_score: 0, by_temperature: {} },
    hunter: { total_prospects: 0, contacted: 0, contact_now: 0 },
  }

  const biz = businessData

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7" style={{ color: brand.primary }} />
            Analitik
          </h1>
          <p className="text-sm text-slate-400 mt-1">Ringkasan performa bisnis dan AI Agent secara menyeluruh</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className={card + ' p-1.5 inline-flex gap-1'} style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.05s' }}>
        {([
          { key: 'bisnis' as TabKey, label: 'Performa Bisnis', icon: TrendingUp },
          { key: 'mandala' as TabKey, label: 'Mandala AI', icon: Bot },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
              activeTab === tab.key
                ? 'text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-50'
            )}
            style={activeTab === tab.key ? { backgroundColor: brand.primary } : {}}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: brand.primary }} />
          <p className="text-sm text-slate-400 mt-3">Memuat data analitik...</p>
        </div>
      )}

      {/* ===================== TAB: BISNIS ===================== */}
      {!loading && activeTab === 'bisnis' && biz && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
            {[
              { label: 'Total Prospek', value: biz.overview.total_prospects.toLocaleString('id-ID'), icon: Users, color: brand.primary },
              { label: 'Total Percakapan', value: biz.overview.total_conversations.toLocaleString('id-ID'), icon: MessageSquare, color: brand.accent },
              { label: 'Rasio Konversi', value: `${biz.overview.conversion_rate}%`, icon: Target, color: brand.success },
              { label: 'Avg. Skor Lead', value: `${biz.overview.avg_lead_score}/100`, icon: BarChart3, color: brand.orange },
            ].map((kpi, i) => (
              <div key={i} className={card + ' p-5 hover:shadow-[0_8px_24px_rgba(0,96,225,0.08)] transition-all duration-300'}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${kpi.color}15` }}>
                    <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">{kpi.label}</p>
                <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Funnel */}
          <div className={card + ' p-5'} style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
            <h3 className="text-[15px] font-semibold text-slate-800 mb-4">Funnel Konversi</h3>
            <div className="space-y-3">
              {biz.funnel.map((stage, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="w-32 text-xs text-slate-500 font-medium text-right shrink-0">{stage.stage}</span>
                  <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full rounded-lg flex items-center px-3 transition-all duration-500"
                      style={{ width: `${Math.max(stage.pct, 3)}%`, background: `linear-gradient(90deg, ${brand.primary}, #60A5FA)` }}
                    >
                      <span className="text-[10px] font-bold text-white">{stage.count}</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 w-12 text-right">{stage.pct}%</span>
                  {i > 0 && biz.funnel[i-1].count > 0 && (
                    <span className="text-[10px] text-red-500 w-16 text-right">
                      -{Math.round(((biz.funnel[i-1].count - stage.count) / biz.funnel[i-1].count) * 100)}% drop
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content + Tasks + Temperature */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
            {/* Content Stats */}
            <div className={card + ' p-5'}>
              <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-4">
                <PenTool className="w-4 h-4" style={{ color: brand.primary }} />
                Konten
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Konten', value: biz.content.total, color: brand.primary, icon: FileText },
                  { label: 'Terbit', value: biz.content.published, color: brand.success, icon: CheckCircle2 },
                  { label: 'Draft', value: biz.content.draft, color: brand.warning, icon: PenTool },
                  { label: 'Ide', value: biz.content.ideas, color: brand.accent, icon: Lightbulb },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                      <span className="text-[12px] text-slate-600">{s.label}</span>
                    </div>
                    <span className="text-[14px] font-bold text-slate-900">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks Stats */}
            <div className={card + ' p-5'}>
              <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4" style={{ color: brand.success }} />
                Tasks
              </h3>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-slate-900">{biz.tasks.total}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-1">Total Tasks</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-emerald-600">{biz.tasks.completed}</p>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Selesai</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-blue-600">{biz.tasks.active}</p>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Aktif</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lead Temperature */}
            <div className={card + ' p-5'}>
              <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4" style={{ color: brand.warning }} />
                Suhu Lead
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Panas (70+)', value: biz.leads_temperature.hot, color: brand.danger, bg: 'bg-red-50' },
                  { label: 'Hangat (50-69)', value: biz.leads_temperature.warm, color: brand.orange, bg: 'bg-orange-50' },
                  { label: 'Dingin (<50)', value: biz.leads_temperature.cold, color: '#94A3B8', bg: 'bg-slate-50' },
                ].map(t => (
                  <div key={t.label} className={`${t.bg} rounded-xl p-3 flex items-center justify-between`}>
                    <span className="text-[12px] font-medium text-slate-600">{t.label}</span>
                    <span className="text-lg font-bold" style={{ color: t.color }}>{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hunter Categories */}
          {biz.hunter.categories.length > 0 && (
            <div className={card + ' p-5'} style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
              <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-4">
                <Search className="w-4 h-4" style={{ color: brand.success }} />
                Top Kategori Prospek (Hunter)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {biz.hunter.categories.map((cat, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-4 text-center">
                    <p className="text-xl font-bold" style={{ color: brand.primary }}>{cat.count}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">{cat.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages Count */}
          <div className={card + ' p-5'} style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: brand.primarySoft }}>
                <MessageCircle className="w-7 h-7" style={{ color: brand.primary }} />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{biz.overview.total_messages.toLocaleString('id-ID')}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">Total Pesan WhatsApp Diproses</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bisnis tab - no data */}
      {!loading && activeTab === 'bisnis' && !biz && (
        <div className="flex flex-col items-center justify-center py-20">
          <BarChart3 className="w-10 h-10 text-slate-200 mb-3" />
          <p className="text-sm text-slate-400">Belum ada data analitik bisnis</p>
        </div>
      )}

      {/* ===================== TAB: MANDALA ===================== */}
      {!loading && activeTab === 'mandala' && (
        <div className="space-y-6">
          {/* Mandala KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
            {[
              { label: 'Total Percakapan', value: stats.conversations.total, icon: MessageSquare, color: brand.primary },
              { label: 'Tingkat Konversi', value: `${stats.conversations.conversion_rate}%`, icon: TrendingUp, color: brand.success },
              { label: 'Rata-rata Skor', value: `${stats.leads.avg_score}/100`, icon: Target, color: brand.warning },
              { label: 'Tingkat Otomatisasi', value: `${stats.conversations.active > 0 ? Math.round(((stats.conversations.by_handler?.['mandala'] || 0) / stats.conversations.active) * 100) : 0}%`, icon: Bot, color: brand.accent },
            ].map((m, i) => (
              <div key={i} className={card + ' p-5 hover:shadow-[0_8px_24px_rgba(0,96,225,0.08)] transition-all duration-300'}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${m.color}15` }}>
                    <m.icon className="w-5 h-5" style={{ color: m.color }} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">{m.label}</p>
                <p className="text-2xl font-bold text-slate-900">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Phase Distribution */}
            <div className={card + ' p-6'}>
              <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-5">
                <PieChartIcon className="w-4 h-4" style={{ color: brand.primary }} />
                Distribusi Tahap Penjualan
              </h3>
              <div className="space-y-5">
                {PHASES.map((phase) => {
                  const count = stats.conversations.by_phase?.[phase.key] || 0
                  const pct = stats.conversations.total > 0 ? Math.round((count / stats.conversations.total) * 100) : 0
                  return (
                    <div key={phase.key} className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                        <span className={phase.text}>{phase.label}</span>
                        <span className="text-slate-400">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-1000', phase.color)}
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Temperature Distribution */}
            <div className={card + ' p-6'}>
              <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-5">
                <BarChart3 className="w-4 h-4" style={{ color: brand.orange }} />
                Tingkat Minat Lead
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {TEMPERATURE_CONFIG.map((temp) => {
                  const count = stats.leads.by_temperature?.[temp.key] || 0
                  const total = stats.leads.total || 0
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={temp.key} className={cn('rounded-xl p-5 border transition-all hover:shadow-sm', temp.border, 'bg-slate-50')}>
                      <p className={cn('text-2xl font-bold mb-1', temp.color)}>{count}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{temp.label}</p>
                      <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{pct}% dari total</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Handler Distribution */}
          <div className={card + ' p-6'}>
            <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-5">
              <Activity className="w-4 h-4" style={{ color: brand.accent }} />
              Distribusi Penanganan
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl p-5 flex items-center gap-4" style={{ backgroundColor: `${brand.primary}08` }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brand.primary}15` }}>
                  <Bot className="w-6 h-6" style={{ color: brand.primary }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.conversations.by_handler?.['mandala'] || 0}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ditangani Mandala</p>
                </div>
              </div>
              <div className="rounded-xl p-5 flex items-center gap-4" style={{ backgroundColor: `${brand.success}08` }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brand.success}15` }}>
                  <UserCheck className="w-6 h-6" style={{ color: brand.success }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.conversations.by_handler?.['owner'] || 0}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Diambil Alih Owner</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hunter Performance */}
          <div className={card + ' p-6'}>
            <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-2 mb-5">
              <Search className="w-4 h-4" style={{ color: brand.success }} />
              Performa Pencarian Prospek
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Total Ditemukan', value: stats.hunter.total_prospects, color: brand.primary, dot: 'bg-slate-400' },
                { label: 'Perlu Dihubungi Segera', value: stats.hunter.contact_now, color: brand.orange, dot: 'bg-orange-500 animate-pulse' },
                { label: 'Sudah Dihubungi', value: stats.hunter.contacted, color: brand.success, dot: 'bg-emerald-500' },
              ].map(h => (
                <div key={h.label} className="bg-slate-50 rounded-xl p-5">
                  <p className="text-2xl font-bold mb-2" style={{ color: h.color }}>{h.value}</p>
                  <div className="flex items-center gap-2">
                    <div className={cn('w-1.5 h-1.5 rounded-full', h.dot)} />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
