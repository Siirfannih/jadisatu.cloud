'use client'

import { useEffect, useState } from "react"
import { History, Activity, BarChart3, Clock, Loader2, Search, ChevronRight } from "lucide-react"

type ActivityItem = {
  id: string
  type?: string
  action?: string
  description?: string
  created_at: string
}

const brand = {
  primary: '#0060E1',
  primaryLight: '#3B82F6',
  primarySoft: '#EFF6FF',
  accent: '#6366F1',
  success: '#10B981',
  warning: '#F59E0B',
}

const card = 'bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,96,225,0.08)] transition-all duration-300'
const cardStatic = 'bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)]'

export default function HistoryPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => { loadActivities() }, [])

  async function loadActivities() {
    setLoading(true)
    try {
      const res = await fetch('/api/activities?limit=200')
      if (res.ok) {
        const data = await res.json()
        setActivities(Array.isArray(data) ? data : [])
      } else {
        setActivities([])
      }
    } catch {
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = activities.filter(a =>
    !searchTerm ||
    (a.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const grouped = filtered.reduce((acc: Record<string, ActivityItem[]>, a) => {
    const date = new Date(a.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
    if (!acc[date]) acc[date] = []
    acc[date].push(a)
    return acc
  }, {})

  const totalActivities = activities.length
  const systemEvents = activities.filter(a => (a.type || '').length > 0).length
  const last24h = activities.filter(a => (Date.now() - new Date(a.created_at).getTime()) < 24 * 60 * 60 * 1000).length

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: brand.primary }} />
        <p className="text-sm text-slate-400">Memuat log aktivitas...</p>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-7 p-4 sm:p-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationFillMode: 'both' }}>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Activity className="w-7 h-7" style={{ color: brand.primary }} />
            Log Aktivitas
          </h1>
          <p className="text-sm text-slate-400 mt-1">Pantau jejak kerja AI dan aktivitas sistem secara real-time</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari aktivitas..."
            className="w-full bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-5" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.1s', animationFillMode: 'both' }}>
        {[
          { label: 'Total Aktivitas', value: totalActivities, icon: History, color: brand.primary },
          { label: 'Event Sistem', value: systemEvents, icon: BarChart3, color: brand.success },
          { label: 'Aktif 24 Jam', value: last24h, icon: Clock, color: brand.primaryLight },
        ].map((s, i) => (
          <div key={i} className={card + ' p-5 relative overflow-hidden'}>
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-1/2 translate-x-1/2 opacity-10" style={{ backgroundColor: s.color }} />
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <s.icon className="w-4 h-4 opacity-40" style={{ color: s.color }} />
            </div>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className={cardStatic + ' p-6'} style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.2s', animationFillMode: 'both' }}>
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-[15px] font-semibold text-slate-800">Timeline Aktivitas</h3>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: brand.primarySoft }}>
              <History className="w-6 h-6" style={{ color: brand.primary }} />
            </div>
            <p className="text-sm font-medium text-slate-700">Belum ada aktivitas</p>
            <p className="text-xs text-slate-400 mt-1">Jejak kerja AI akan muncul di sini setelah sistem aktif.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([date, events]) => (
              <div key={date} className="space-y-3">
                <div className="sticky top-2 z-10">
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: brand.primarySoft, color: brand.primary }}>
                    {date}
                  </span>
                </div>

                <div className="relative border-l-2 border-slate-100 ml-3 space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="pl-7 relative group">
                      <div className="absolute left-[-5px] top-4 w-2 h-2 rounded-full bg-slate-200 group-hover:bg-blue-500 transition-colors" />

                      <div className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(event.created_at).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[13px] font-semibold text-slate-800">{event.action || 'Aktivitas'}</span>
                              {event.type && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ backgroundColor: brand.primarySoft, color: brand.primary }}>
                                  {event.type}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              {event.description || "Menjalankan tugas sistem rutin secara otonom."}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
