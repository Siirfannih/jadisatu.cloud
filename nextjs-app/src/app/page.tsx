'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp, Target, AlertTriangle, Eye, Clock,
  ChevronRight, ArrowUpRight, Sparkles, CheckCircle,
  Users, Zap, Bot, Palette, MessageCircle,
  FileText, Activity, X, DollarSign,
} from 'lucide-react'


/* ================================================================
   BRAND TOKENS — Restrained palette: 2 core + 1 semantic
   Primary:  #0060E1 (blue)     — actions, emphasis, links
   Slate:    slate-600/500/400  — text hierarchy
   Success:  #10B981 (green)    — positive signals only
   ================================================================ */
const brand = {
  primary: '#0060E1',
  primaryLight: '#93C5FD',
  primarySoft: '#EFF6FF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
}

/* ================================================================
   TYPES
   ================================================================ */
interface MandalaStats {
  total_conversations: number; active_conversations: number; total_leads: number; success_rate: number
  avg_response_time?: string; deals_closed?: number
  phases?: { kenalan: number; gali_masalah: number; tawarkan_solusi: number; closing: number; rescue: number }
  top_prospect?: { name: string; score: number; phase: string; last_message: string; time_ago: string } | null
}
interface AlertItem { id: string; type: string; title: string; desc: string; time: string; priority: 'high' | 'medium' | 'low'; link?: string }
interface TimelineEvent { text: string; sub?: string; time: string; type?: 'success' | 'warning' | 'info'; icon?: string }

/* ================================================================
   CARD — off-white page, white cards with subtle shadow
   ================================================================ */
const card = 'bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,96,225,0.06)] transition-all duration-300'

/* ================================================================
   SUB-COMPONENTS
   ================================================================ */

function AiSummaryBanner({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-slate-800">
      <div className="relative flex items-start gap-3 p-5 pr-12">
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-blue-300" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-1.5">Ringkasan AI</p>
          <p className="text-[13px] text-slate-200 leading-relaxed">{text}</p>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
          <X className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </div>
  )
}

function InsightBubble({ text }: { text: string }) {
  return (
    <div className="flex gap-3 mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-slate-200">
          <Sparkles className="w-3 h-3 text-slate-500" />
        </div>
      </div>
      <p className="text-[13px] text-slate-500 leading-relaxed">{text}</p>
    </div>
  )
}

function PhaseDot({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[13px] text-slate-500">{label}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%`, backgroundColor: color }} />
        </div>
        <span className="text-[13px] font-semibold text-slate-600 w-5 text-right">{count}</span>
      </div>
    </div>
  )
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const cfg: Record<string, { border: string; icon: React.ReactNode }> = {
    high: { border: 'border-red-200 bg-red-50/50', icon: <AlertTriangle className="w-4 h-4 text-red-400" /> },
    medium: { border: 'border-amber-200 bg-amber-50/50', icon: <Eye className="w-4 h-4 text-amber-400" /> },
    low: { border: 'border-slate-200 bg-slate-50/50', icon: <Clock className="w-4 h-4 text-slate-400" /> },
  }
  const s = cfg[alert.priority] || cfg.low
  return (
    <Link href={alert.link || '/mandala'} className={`block p-3.5 rounded-xl border ${s.border} transition-all hover:translate-x-0.5`}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex-shrink-0">{s.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[13px] font-semibold text-slate-700 truncate">{alert.title}</h4>
            <span className="text-[10px] text-slate-400 flex-shrink-0">{alert.time}</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">{alert.desc}</p>
        </div>
      </div>
    </Link>
  )
}

function TimelineItem({ item, isLast }: { item: TimelineEvent; isLast: boolean }) {
  const dotColor = item.type === 'success' ? brand.success : item.type === 'warning' ? brand.warning : brand.primary
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: dotColor }} />
        {!isLast && <div className="w-px flex-1 my-1 bg-slate-100" />}
      </div>
      <div className="pb-4">
        <p className="text-[13px] text-slate-600">{item.text}</p>
        {item.sub && <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>}
        <span className="text-[10px] text-slate-400">{item.time}</span>
      </div>
    </div>
  )
}

/* ================================================================
   HELPERS
   ================================================================ */

/* ================================================================
   MAIN DASHBOARD
   ================================================================ */
export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showSummary, setShowSummary] = useState(true)
  const [mandalaStats, setMandalaStats] = useState<MandalaStats>({
    total_conversations: 0, active_conversations: 0, total_leads: 0, success_rate: 0,
    avg_response_time: '< 8 dtk', deals_closed: 0,
    phases: { kenalan: 0, gali_masalah: 0, tawarkan_solusi: 0, closing: 0, rescue: 0 },
    top_prospect: null,
  })
  const [totalLeads, setTotalLeads] = useState(0)
  const [hotLeads, setHotLeads] = useState(0)
  const [pipelineCounts, setPipelineCounts] = useState({ lead: 0, prospect: 0, contacted: 0, closing: 0 })
  const [contentCount, setContentCount] = useState(0)
  const [recentActivities, setRecentActivities] = useState<TimelineEvent[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])

  // Revenue data — belum terhubung ke payment gateway
  const revenueConnected = false

  useEffect(() => { checkUser() }, [])

  async function checkUser() {
    const { data: { user: u }, error } = await supabase.auth.getUser()
    if (error || !u) { router.push('/login'); return }
    setUser(u)
    await loadData()
  }

  async function loadData() {
    setLoading(true)
    try {
      const [mandalaRes, leadsRes, contentsRes, conversationsRes, historyRes] = await Promise.all([
        fetch('/api/mandala/stats'),
        supabase.from('leads').select('id, status, name, score, last_message, updated_at', { count: 'exact' }),
        supabase.from('contents').select('id', { count: 'exact' }),
        supabase.from('mandala_conversations').select('id, status', { count: 'exact' }),
        supabase.from('history').select('*').order('created_at', { ascending: false }).limit(8),
      ])
      if (mandalaRes.ok) { const d = await mandalaRes.json(); setMandalaStats(prev => ({ ...prev, ...d })) }

      const leads = leadsRes.data || []
      const pCounts = { lead: leads.filter(l => l.status === 'lead').length, prospect: leads.filter(l => l.status === 'prospect').length, contacted: leads.filter(l => l.status === 'contacted').length, closing: leads.filter(l => l.status === 'closing' || l.status === 'client').length }
      setPipelineCounts(pCounts)
      setTotalLeads(leadsRes.count || 0)
      setHotLeads(leads.filter(l => l.status === 'prospect' || l.status === 'closing').length)
      setContentCount(contentsRes.count || 0)
      if (mandalaStats.total_conversations === 0 && conversationsRes.count) setMandalaStats(prev => ({ ...prev, total_conversations: conversationsRes.count || 0 }))

      const newAlerts: AlertItem[] = []
      if (hotLeads > 0) newAlerts.push({ id: 'hot', type: 'escalation', priority: 'high', title: `${hotLeads} prospek siap di-follow up`, desc: `Ada ${hotLeads} leads dengan intent tinggi menunggu respon.`, time: 'Sekarang', link: '/mandala/pipeline' })
      if (pCounts.closing > 0) newAlerts.push({ id: 'close', type: 'deal_stuck', priority: 'medium', title: `${pCounts.closing} deal di tahap closing`, desc: 'Pastikan Mandala sudah push ke meeting.', time: 'Hari ini', link: '/mandala/pipeline' })
      if (contentCount > 0) newAlerts.push({ id: 'content', type: 'info', priority: 'low', title: `${contentCount} konten siap publish`, desc: 'Review dan publish konten yang dijadwalkan.', time: 'Minggu ini', link: '/content' })
      setAlerts(newAlerts)

      const hd = (historyRes.data || []).map((h: any): TimelineEvent => ({ text: h.action || h.description || 'Activity', sub: h.details, time: h.created_at ? new Date(h.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '', type: 'info', icon: 'report' }))
      setRecentActivities(hd.length > 0 ? hd : [
        { text: 'Mandala siap menerima percakapan', sub: 'Hubungkan WhatsApp untuk mulai', time: 'Baru saja', type: 'info', icon: 'chat' },
        { text: 'Dashboard terhubung ke Supabase', sub: 'Data real-time aktif', time: 'Baru saja', type: 'success', icon: 'report' },
      ])
    } catch (err) { console.error('Load error:', err) }
    setLoading(false)
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Irfan'
  const getGreeting = () => { const h = new Date().getHours(); return h >= 5 && h < 12 ? 'Selamat pagi' : h < 17 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam' }

  const totalPipeline = pipelineCounts.lead + pipelineCounts.prospect + pipelineCounts.contacted + pipelineCounts.closing
  const totalActive = mandalaStats.active_conversations || 0
  const phases = mandalaStats.phases || { kenalan: 0, gali_masalah: 0, tawarkan_solusi: 0, closing: 0, rescue: 0 }
  const healthScore = Math.min(100, Math.round(
    (mandalaStats.success_rate || 0) * 0.3 + (totalPipeline > 0 ? Math.min(100, (pipelineCounts.closing / totalPipeline) * 100) : 0) * 0.3 +
    (Math.min(100, contentCount * 10)) * 0.2 + (mandalaStats.total_conversations > 0 ? Math.min(100, (totalActive / mandalaStats.total_conversations) * 100) : 0) * 0.2
  ))

  const aiSummary = totalPipeline > 0 || mandalaStats.total_conversations > 0
    ? `Mandala sudah handle ${mandalaStats.total_conversations} percakapan dengan ${totalLeads} leads di pipeline. ${hotLeads > 0 ? `Ada ${hotLeads} prospek hot yang siap closing.` : 'Belum ada prospek hot, Mandala terus bekerja.'} ${contentCount > 0 ? `${contentCount} konten siap publish.` : ''}`
    : 'Dashboard aktif. Hubungkan WhatsApp ke Mandala untuk mulai menerima percakapan otomatis.'

  const mandalaInsight = mandalaStats.total_conversations > 0
    ? `Conversion rate ${mandalaStats.success_rate || 0}%. ${pipelineCounts.closing > 0 ? `${pipelineCounts.closing} deal di tahap closing.` : 'Belum ada deal closing.'}`
    : 'Mandala belum mulai percakapan. Setelah WhatsApp terhubung, pipeline real-time muncul di sini.'
  const contentInsight = contentCount > 0
    ? `${contentCount} konten di pipeline. Konsistensi posting membantu brand lebih terlihat.`
    : 'Belum ada konten. Mulai buat di Content Studio.'

  const healthLabel = healthScore >= 75 ? 'Sehat' : healthScore >= 50 ? 'Perlu Perhatian' : 'Perlu Aksi'

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-6 min-h-screen">
        <div className="h-10 w-72 bg-slate-200/60 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl shadow-sm animate-pulse" />)}</div>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 min-h-screen pb-10">

      {/* GREETING */}
      <div className="flex items-end justify-between" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-sm text-slate-400 mt-1">Ringkasan bisnis kamu hari ini</p>
        </div>
        <p className="text-xs text-slate-400 hidden sm:block">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* AI SUMMARY */}
      {showSummary && <AiSummaryBanner text={aiSummary} onClose={() => setShowSummary(false)} />}

      {/* 4 METRIC CARDS — unified color: all use primary blue for numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Business Health', value: `${healthScore}%`, sub: healthLabel },
          { label: 'Chat Aktif', value: totalActive, sub: `${mandalaStats.total_conversations} total percakapan` },
          { label: 'Leads Pipeline', value: totalLeads, sub: `${hotLeads} hot · ${pipelineCounts.closing} closing` },
          { label: 'Conversion Rate', value: `${mandalaStats.success_rate || 0}%`, sub: 'Mandala success rate' },
        ].map((m, i) => (
          <div key={i} className={card + ' p-5'} style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{m.label}</p>
            <span className="text-2xl font-bold text-slate-800">{m.value}</span>
            <p className="text-[12px] text-slate-400 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>

        {/* REVENUE */}
        <div className={card + ' lg:col-span-2 p-6'}>
          <h3 className="text-[15px] font-semibold text-slate-700 mb-4">Revenue</h3>
          {revenueConnected ? (
            <div>
              {/* Will render real revenue data when payment gateway connected */}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#F8FAFC' }}>
                <DollarSign className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-600 mb-1">Belum Terhubung</p>
              <p className="text-xs text-slate-400 max-w-[280px]">
                Data revenue akan muncul setelah integrasi payment gateway (Midtrans/Stripe) terhubung.
              </p>
            </div>
          )}
        </div>

        {/* PERLU PERHATIAN — dynamic: compact when "aman" */}
        <div className={card + ' p-5'}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-slate-700">Perlu Perhatian</h3>
            {alerts.length > 0 && (
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: brand.danger }}>{alerts.length}</span>
            )}
          </div>
          {alerts.length > 0 ? (
            <div className="flex flex-col gap-2.5">{alerts.map(a => <AlertCard key={a.id} alert={a} />)}</div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <CheckCircle className="w-5 h-5 text-slate-300 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-slate-600">Semua aman</p>
                <p className="text-xs text-slate-400">Tidak ada hal yang butuh perhatian kamu saat ini.</p>
              </div>
            </div>
          )}
        </div>

        {/* MANDALA AI */}
        <div className={card + ' lg:col-span-2 p-6'}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: brand.primary }}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-slate-700">Mandala AI</h3>
                <p className="text-[11px] text-slate-400">Agen penjualan otonom</p>
              </div>
            </div>
            <Link href="/mandala" className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-colors hover:opacity-90" style={{ backgroundColor: brand.primary }}>
              Buka Cockpit <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Metrics row — all slate, no competing colors */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Chat Aktif', value: totalActive },
              { label: 'Total Chat', value: mandalaStats.total_conversations },
              { label: 'Deal Closed', value: mandalaStats.deals_closed || 0 },
              { label: 'Avg Response', value: mandalaStats.avg_response_time || '< 8 dtk' },
            ].map((m, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">{m.label}</p>
                <p className="text-lg font-bold text-slate-700">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Pipeline — monochrome blue scale */}
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-3">Pipeline Percakapan</p>
          <div className="flex flex-col gap-3 mb-4">
            <PhaseDot label="Kenalan" count={phases.kenalan} color="#CBD5E1" total={totalActive || totalPipeline || 1} />
            <PhaseDot label="Gali Masalah" count={phases.gali_masalah} color="#93C5FD" total={totalActive || totalPipeline || 1} />
            <PhaseDot label="Tawarkan Solusi" count={phases.tawarkan_solusi} color="#60A5FA" total={totalActive || totalPipeline || 1} />
            <PhaseDot label="Closing" count={phases.closing} color={brand.primary} total={totalActive || totalPipeline || 1} />
            <PhaseDot label="Rescue" count={phases.rescue} color={brand.warning} total={totalActive || totalPipeline || 1} />
          </div>

          {mandalaStats.top_prospect && (
            <div className="p-3.5 rounded-xl flex items-center gap-3 mb-4 bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-200">
                <Target className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-700 truncate">{mandalaStats.top_prospect.name}</p>
                <p className="text-xs text-slate-400 truncate">&ldquo;{mandalaStats.top_prospect.last_message}&rdquo; — {mandalaStats.top_prospect.time_ago}</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: brand.primarySoft, color: brand.primary }}>{mandalaStats.top_prospect.phase}</span>
            </div>
          )}

          <InsightBubble text={mandalaInsight} />
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-5">
          {/* Content */}
          <div className={card + ' p-5'}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-slate-700">Konten & Brand</h3>
              <Link href="/content" className="text-[11px] font-semibold flex items-center gap-0.5 hover:underline" style={{ color: brand.primary }}>
                Studio <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-slate-800">{contentCount}</span>
              <span className="text-[12px] text-slate-400">konten di pipeline</span>
            </div>
            <InsightBubble text={contentInsight} />
          </div>

          {/* Leads */}
          <div className={card + ' p-5'}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-slate-700">Leads Tracker</h3>
              <Link href="/leads" className="text-[11px] font-semibold flex items-center gap-0.5 hover:underline" style={{ color: brand.primary }}>
                Semua <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { stage: 'Lead', count: pipelineCounts.lead, color: '#BFDBFE' },
                { stage: 'Prospect', count: pipelineCounts.prospect, color: '#93C5FD' },
                { stage: 'Contacted', count: pipelineCounts.contacted, color: '#60A5FA' },
                { stage: 'Closing', count: pipelineCounts.closing, color: brand.primary },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold w-20">{item.stage}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: totalPipeline > 0 ? `${(item.count / totalPipeline) * 100}%` : '0%', minWidth: item.count > 0 ? '8px' : '0', backgroundColor: item.color }} />
                  </div>
                  <span className="text-[13px] font-semibold text-slate-600 w-5 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TIMELINE */}
        <div className={card + ' lg:col-span-3 p-5'}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-slate-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              Aktivitas Hari Ini
            </h3>
            <Link href="/history" className="text-[11px] font-semibold flex items-center gap-0.5 hover:underline" style={{ color: brand.primary }}>
              Semua <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div>{recentActivities.slice(0, Math.ceil(recentActivities.length / 2)).map((item, i, arr) => <TimelineItem key={i} item={item} isLast={i === arr.length - 1} />)}</div>
            <div>{recentActivities.slice(Math.ceil(recentActivities.length / 2)).map((item, i, arr) => <TimelineItem key={i} item={item} isLast={i === arr.length - 1} />)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
