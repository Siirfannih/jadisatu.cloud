'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Search, MapPin, ExternalLink, Phone, Globe, Star, Activity, Zap, Compass,
  Loader2, CheckCircle2, XCircle, MessageSquare, Eye, ChevronRight, Users,
  Clock, Ban, Send, Edit3, Sparkles,
} from 'lucide-react'
import type { Prospect } from './types'
import { PROSPECT_STATUS_COLORS } from './types'

type OutreachStatus = 'calon_leads' | 'proses_dihubungi' | 'ditolak'

interface Props {
  prospects: Prospect[]
  hunterQuery: string
  hunterRunning: boolean
  onQueryChange: (q: string) => void
  onRunHunter: () => void
  onApproveProspect: (id: string, draft: string) => Promise<void>
  onRejectProspect: (id: string) => Promise<void>
  onGenerateDraft: (prospect: Prospect) => Promise<string>
}

const STATUS_TABS: { key: OutreachStatus; label: string; icon: typeof Users; color: string }[] = [
  { key: 'calon_leads', label: 'Calon Leads', icon: Users, color: 'text-[#0060E1] border-[#0060E1]' },
  { key: 'proses_dihubungi', label: 'Proses Dihubungi', icon: MessageSquare, color: 'text-emerald-500 border-emerald-500' },
  { key: 'ditolak', label: 'Ditolak', icon: Ban, color: 'text-slate-400 border-slate-400' },
]

export default function CockpitOutreach({
  prospects, hunterQuery, hunterRunning, onQueryChange, onRunHunter,
  onApproveProspect, onRejectProspect, onGenerateDraft,
}: Props) {
  const [activeTab, setActiveTab] = useState<OutreachStatus>('calon_leads')
  const [draftModal, setDraftModal] = useState<{ prospect: Prospect; draft: string; loading: boolean } | null>(null)
  const [draftEditing, setDraftEditing] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Categorize prospects into 3 groups
  const calonLeads = prospects.filter(p =>
    !['contacted', 'rejected', 'skipped'].includes(p.status) &&
    p.decision !== 'skip'
  )
  const prosesHubungi = prospects.filter(p => p.status === 'contacted')
  const ditolak = prospects.filter(p =>
    p.status === 'rejected' || p.status === 'skipped' || p.decision === 'skip'
  )

  const filtered = activeTab === 'calon_leads' ? calonLeads
    : activeTab === 'proses_dihubungi' ? prosesHubungi
    : ditolak

  const counts = {
    calon_leads: calonLeads.length,
    proses_dihubungi: prosesHubungi.length,
    ditolak: ditolak.length,
  }

  const handleHubungi = async (prospect: Prospect) => {
    setDraftModal({ prospect, draft: '', loading: true })
    try {
      const draft = await onGenerateDraft(prospect)
      setDraftModal({ prospect, draft, loading: false })
      setDraftEditing(draft)
    } catch {
      setDraftModal({ prospect, draft: 'Gagal generate pesan. Coba lagi.', loading: false })
      setDraftEditing('')
    }
  }

  const handleApproveDraft = async () => {
    if (!draftModal || !draftEditing.trim()) return
    setActionLoading(draftModal.prospect.id)
    try {
      await onApproveProspect(draftModal.prospect.id, draftEditing)
      setDraftModal(null)
      setDraftEditing('')
    } catch {
      // keep modal open
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: string) => {
    setActionLoading(id)
    try {
      await onRejectProspect(id)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Hunter Search */}
      <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-[15px] font-semibold text-slate-800 flex items-center gap-3">
              <Compass size={20} className="text-[#0060E1]" />
              Pencarian Prospek
            </h3>
            <p className="text-xs text-slate-400">Cari calon klien lewat Google Maps & analisis AI</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
            <Activity size={12} className="text-[#0060E1]" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{prospects.length} TOTAL PROSPEK</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#0060E1] transition-colors" />
            <input
              type="text"
              value={hunterQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !hunterRunning && hunterQuery.trim() && onRunHunter()}
              placeholder="e.g. hotel bali, klinik kecantikan jakarta, cafe surabaya..."
              className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0060E1]/20 transition-all"
            />
          </div>
          <button
            onClick={onRunHunter}
            disabled={hunterRunning || !hunterQuery.trim()}
            className={cn(
              "px-8 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-3 min-w-[180px]",
              hunterRunning || !hunterQuery.trim()
                ? "bg-white text-slate-300 cursor-not-allowed"
                : "bg-[#0060E1] text-white hover:bg-[#004FC0] shadow-blue-500/10"
            )}
          >
            {hunterRunning ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {hunterRunning ? 'Mencari...' : 'Mulai Pencarian'}
          </button>
        </div>
      </div>

      {/* 3-Status Tabs */}
      <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="flex border-b border-slate-100">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 py-4 px-4 text-center transition-all relative",
                activeTab === tab.key
                  ? "border-b-2 " + tab.color
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <tab.icon size={16} />
                <span className="text-[11px] font-bold uppercase tracking-wider">{tab.label}</span>
                <span className={cn(
                  "text-[10px] font-black px-2 py-0.5 rounded-full min-w-[24px]",
                  activeTab === tab.key
                    ? tab.key === 'calon_leads' ? "bg-[#0060E1]/10 text-[#0060E1]"
                    : tab.key === 'proses_dihubungi' ? "bg-emerald-100 text-emerald-600"
                    : "bg-slate-100 text-slate-500"
                    : "bg-slate-100 text-slate-400"
                )}>
                  {counts[tab.key]}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Prospect Cards */}
        {filtered.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto opacity-30">
              {activeTab === 'calon_leads' ? <Users size={36} /> :
               activeTab === 'proses_dihubungi' ? <MessageSquare size={36} /> :
               <Ban size={36} />}
            </div>
            <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              {activeTab === 'calon_leads' ? 'Belum ada calon leads. Cari prospek dulu.' :
               activeTab === 'proses_dihubungi' ? 'Belum ada yang sedang dihubungi.' :
               'Tidak ada yang ditolak.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filtered.map((prospect) => {
              const statusColor = PROSPECT_STATUS_COLORS[prospect.status] || PROSPECT_STATUS_COLORS.discovered
              const isLoading = actionLoading === prospect.id

              return (
                <div key={prospect.id} className="p-5 hover:bg-slate-50/60 transition-all group">
                  <div className="flex items-start gap-4">
                    {/* Business Info */}
                    <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-[#0060E1] shrink-0 group-hover:scale-105 transition-transform">
                      <Globe size={20} />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm tracking-tight group-hover:text-[#0060E1] transition-colors truncate">
                          {prospect.business_name}
                        </h4>
                        {prospect.maps_url && (
                          <a href={prospect.maps_url} target="_blank" rel="noopener noreferrer"
                             className="p-1 rounded-lg text-slate-300 hover:text-[#0060E1] transition-all">
                            <ExternalLink size={11} />
                          </a>
                        )}
                        <span className={cn("text-[9px] px-2 py-0.5 rounded-lg font-black uppercase tracking-wider", statusColor.text, statusColor.bg)}>
                          {prospect.status}
                        </span>
                      </div>

                      {prospect.address && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                          <MapPin size={10} className="text-red-400 shrink-0" /> {prospect.address}
                        </p>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        {prospect.phone && (
                          <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg">
                            <Phone size={10} /> {prospect.phone}
                          </span>
                        )}
                        {prospect.rating > 0 && (
                          <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg">
                            <Star size={10} className="fill-current" /> {prospect.rating} ({prospect.review_count})
                          </span>
                        )}
                        {prospect.website && (
                          <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg">
                            <Globe size={10} /> Website
                          </span>
                        )}
                        {prospect.pain_type && (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg">
                            Pain: {prospect.pain_type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pain Score + Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      {prospect.pain_score > 0 && (
                        <div className="text-center">
                          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider mb-0.5">Score</p>
                          <span className={cn(
                            "text-2xl font-black",
                            prospect.pain_score >= 80 ? "text-emerald-600" :
                            prospect.pain_score >= 50 ? "text-[#0060E1]" : "text-slate-400"
                          )}>
                            {prospect.pain_score}
                          </span>
                        </div>
                      )}

                      {/* Action buttons for Calon Leads */}
                      {activeTab === 'calon_leads' && (
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => handleHubungi(prospect)}
                            disabled={isLoading || !prospect.phone}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0060E1] text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#004FC0] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            title={!prospect.phone ? 'Tidak ada nomor telepon' : 'Hubungi prospek ini'}
                          >
                            <Send size={12} /> Hubungi
                          </button>
                          <button
                            onClick={() => handleReject(prospect.id)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-40"
                          >
                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Tolak
                          </button>
                        </div>
                      )}

                      {/* Status indicator for Proses */}
                      {activeTab === 'proses_dihubungi' && (
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                          <Clock size={12} /> Aktif
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Draft Preview Modal */}
      {draftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !draftModal.loading && setDraftModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0060E1]/10 flex items-center justify-center text-[#0060E1]">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Preview Pesan untuk {draftModal.prospect.business_name}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Review dan edit sebelum Mandala mengirim</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Target Info */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <Phone size={14} className="text-emerald-500" />
                <span className="text-xs font-semibold text-slate-600">{draftModal.prospect.phone || 'Nomor tidak tersedia'}</span>
                <ChevronRight size={12} className="text-slate-300" />
                <span className="text-xs text-slate-400">{draftModal.prospect.business_name}</span>
              </div>

              {/* Draft Message */}
              {draftModal.loading ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 size={24} className="animate-spin text-[#0060E1]" />
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-500">Mandala sedang menyusun pesan...</p>
                    <p className="text-[10px] text-slate-400 mt-1">Menganalisis profil bisnis & pain points</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Edit3 size={10} /> Draft Pesan (bisa diedit)
                    </label>
                    <button
                      onClick={async () => {
                        setDraftModal({ ...draftModal, loading: true })
                        try {
                          const newDraft = await onGenerateDraft(draftModal.prospect)
                          setDraftModal({ ...draftModal, draft: newDraft, loading: false })
                          setDraftEditing(newDraft)
                        } catch {
                          setDraftModal({ ...draftModal, loading: false })
                        }
                      }}
                      className="text-[10px] font-bold text-[#0060E1] hover:underline flex items-center gap-1"
                    >
                      <Sparkles size={10} /> Generate Ulang
                    </button>
                  </div>
                  <textarea
                    value={draftEditing}
                    onChange={(e) => setDraftEditing(e.target.value)}
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-400 italic">Mandala akan mengirim pesan ini via WhatsApp ke {draftModal.prospect.phone}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => { setDraftModal(null); setDraftEditing('') }}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleApproveDraft}
                disabled={draftModal.loading || !draftEditing.trim() || actionLoading === draftModal.prospect.id}
                className="flex-1 py-3 rounded-xl bg-[#0060E1] text-white text-[11px] font-bold uppercase tracking-wider hover:bg-[#004FC0] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === draftModal.prospect.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <CheckCircle2 size={14} />
                }
                Approve & Kirim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
