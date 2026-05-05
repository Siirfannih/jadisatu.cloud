'use client'

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Edit3, Save, Shield, Brain, Target, History, Sparkles, ChevronRight, Loader2, X } from "lucide-react"

const brand = {
  primary: '#0060E1',
  primarySoft: '#EFF6FF',
  accent: '#6366F1',
  success: '#10B981',
  warning: '#F59E0B',
}

const card = 'bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)]'

export default function BusinessProfilePage() {
  const [profile, setProfile] = useState<any[]>([])
  const [decisions, setDecisions] = useState<any[]>([])
  const [memory, setMemory] = useState<any[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [pRes, dRes, mRes] = await Promise.all([
        supabase.from("context_profile").select("*").order("category"),
        supabase.from("decisions").select("*").order("created_at", { ascending: false }),
        supabase.from("shared_memory").select("*").order("key"),
      ])
      if (pRes.data) setProfile(pRes.data)
      if (dRes.data) setDecisions(dRes.data)
      if (mRes.data) setMemory(mRes.data)
    } finally {
      setLoading(false)
    }
  }

  async function saveMemory(key: string) {
    await supabase.from("shared_memory").update({ value: editValue, updated_at: new Date().toISOString() }).eq("key", key)
    setEditingKey(null)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: brand.primary }} />
        <p className="text-sm text-slate-400">Memuat profil bisnis...</p>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-7 p-4 sm:p-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationFillMode: 'both' as const }}>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Brain className="w-7 h-7" style={{ color: brand.primary }} />
            Profil Bisnis
          </h1>
          <p className="text-sm text-slate-400 mt-1">Pusat konteks dan memori untuk semua AI Agent Jadisatu</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${brand.success}15`, color: brand.success }}>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: brand.success }} />
          Tersinkronisasi
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Shared Memory */}
        <div className="lg:col-span-4 space-y-5" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.1s', animationFillMode: 'both' as const }}>
          <div className={card + ' p-5'}>
            <div className="flex items-center gap-2 mb-5">
              <Target className="w-4 h-4" style={{ color: brand.primary }} />
              <h3 className="text-[15px] font-semibold text-slate-800">Shared Memory</h3>
            </div>
            <div className="space-y-3">
              {memory.map(m => (
                <div key={m.key} className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all group">
                  {editingKey === m.key ? (
                    <div className="flex gap-2 items-center">
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 bg-white rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Update memory..."
                        autoFocus
                      />
                      <button onClick={() => saveMemory(m.key)} className="p-2 rounded-lg hover:bg-blue-50 transition-colors" style={{ color: brand.primary }}>
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingKey(null)} className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start cursor-pointer" onClick={() => { setEditingKey(m.key); setEditValue(m.value) }}>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.key}</p>
                        <p className="text-[13px] font-medium text-slate-700">&quot;{m.value}&quot;</p>
                      </div>
                      <Edit3 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                    </div>
                  )}
                </div>
              ))}
              {memory.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Belum ada data memory.</p>
              )}
            </div>
            <button className="w-full mt-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:border-blue-300 hover:text-blue-500 transition-all">
              + Tambah Memory Baru
            </button>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: brand.primarySoft }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4" style={{ color: brand.primary }} />
              <h4 className="text-xs font-bold text-slate-700">Perlindungan Data</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Semua data di Profil Bisnis dienkripsi dan hanya dapat diakses oleh AI Agent internal yang telah diotorisasi.
            </p>
          </div>
        </div>

        {/* Right: Profile + Decisions */}
        <div className="lg:col-span-8 space-y-6" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.2s', animationFillMode: 'both' as const }}>
          {/* Business Profile */}
          <div className={card + ' p-6'}>
            <h3 className="text-[15px] font-semibold text-slate-800 mb-5">Informasi Bisnis & Goals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {profile.map(p => (
                <div key={p.key} className="group cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors">
                      {p.key.replace(/_/g, " ")}
                    </p>
                    <Edit3 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[15px] font-medium text-slate-800 pb-2 border-b border-slate-100 group-hover:border-blue-100 transition-colors">
                    {p.value || "-"}
                  </p>
                </div>
              ))}
              {profile.length === 0 && (
                <div className="col-span-2 flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: brand.primarySoft }}>
                    <Brain className="w-6 h-6" style={{ color: brand.primary }} />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Belum ada data profil</p>
                  <p className="text-xs text-slate-400 mt-1">Tambahkan informasi bisnis untuk konteks AI yang lebih baik.</p>
                </div>
              )}
            </div>
          </div>

          {/* Decision Log */}
          <div className={card + ' p-6'}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-semibold text-slate-800">Riwayat Keputusan</h3>
              {decisions.length > 5 && (
                <button className="text-[11px] font-semibold flex items-center gap-0.5 hover:underline" style={{ color: brand.primary }}>
                  Lihat Semua <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {decisions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: brand.primarySoft }}>
                  <History className="w-6 h-6" style={{ color: brand.primary }} />
                </div>
                <p className="text-sm font-medium text-slate-700">Belum ada keputusan</p>
                <p className="text-xs text-slate-400 mt-1">Riwayat keputusan bisnis akan muncul di sini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {decisions.slice(0, 8).map((d, index) => (
                  <div key={d.id} className="relative pl-7 group">
                    {/* Timeline */}
                    {index !== Math.min(decisions.length, 8) - 1 && (
                      <div className="absolute left-[3px] top-6 bottom-0 w-px bg-slate-100" />
                    )}
                    <div className="absolute left-0 top-2 w-2 h-2 rounded-full bg-slate-200 group-hover:bg-blue-500 transition-colors" />

                    <div className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-[13px] font-semibold text-slate-800">{d.decision}</h4>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {new Date(d.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {d.reason && (
                        <p className="text-xs text-slate-500 leading-relaxed pl-3 border-l-2 border-slate-200 italic">
                          &quot;{d.reason}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
