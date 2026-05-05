'use client'

import { useEffect, useState } from 'react'
import {
  Users, Search, Phone,
  Bot, X, Filter, ChevronDown, ChevronUp,
  ArrowUpDown, Star, Clock, TrendingUp,
  Loader2, MessageSquare, UserCheck,
} from 'lucide-react'
import { PHASES } from '@/components/mandala/types'

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

type SortField = 'name' | 'score' | 'last_message' | 'created_at'
type SortDir = 'asc' | 'desc'

interface Contact {
  id: string
  customer_name: string
  customer_number: string
  status: string
  phase: string
  current_handler: string
  lead_score: number
  last_message_at: string
  created_at: string
  updated_at: string
  avatar_color: string
}

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  kenalan: { label: 'Kenalan', color: '#0060E1', bg: '#EFF6FF' },
  gali_masalah: { label: 'Gali Masalah', color: '#F59E0B', bg: '#FFFBEB' },
  tawarkan_solusi: { label: 'Tawarkan Solusi', color: '#8B5CF6', bg: '#F5F3FF' },
  closing: { label: 'Closing', color: '#10B981', bg: '#ECFDF5' },
  rescue: { label: 'Rescue', color: '#EF4444', bg: '#FEF2F2' },
}

const DEFAULT_PHASE = { label: 'Unknown', color: '#94A3B8', bg: '#F1F5F9' }

const AVATAR_COLORS = ['#0060E1', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#F97316', '#8B5CF6', '#EC4899']

function getScoreColor(score: number) {
  if (score >= 80) return { color: '#10B981', bg: '#ECFDF5' }
  if (score >= 50) return { color: '#0060E1', bg: '#EFF6FF' }
  return { color: '#94A3B8', bg: '#F8FAFC' }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Hari ini'
  if (diffDays === 1) return 'Kemarin'
  if (diffDays < 7) return `${diffDays} hari lalu`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function getDisplayName(c: Contact) {
  return c.customer_name || formatPhoneDisplay(c.customer_number)
}

function formatPhoneDisplay(phone: string) {
  if (!phone) return '-'
  // Strip @s.whatsapp.net and @lid suffixes
  const clean = phone.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '')
  // Format Indonesian numbers
  if (clean.startsWith('62') && clean.length >= 10) {
    return '+' + clean.slice(0, 2) + ' ' + clean.slice(2, 5) + '-' + clean.slice(5, 9) + '-' + clean.slice(9)
  }
  return clean
}

function getInitials(name: string) {
  if (!name || name === 'Kontak Baru') return '?'
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

export default function CRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [filterPhase, setFilterPhase] = useState<string>('all')
  const [filterHandler, setFilterHandler] = useState<'all' | 'mandala' | 'owner'>('all')
  const [sortField, setSortField] = useState<SortField>('last_message')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => { loadContacts() }, [])

  async function loadContacts() {
    setLoading(true)
    try {
      const res = await fetch('/api/mandala/conversations')
      if (res.ok) {
        const json = await res.json()
        const list = json.data ?? json
        if (Array.isArray(list) && list.length > 0) {
          const mapped: Contact[] = list.map((d: any, i: number) => ({
            id: d.id,
            customer_name: d.customer_name || '',
            customer_number: d.customer_number || '',
            status: d.status || 'active',
            phase: d.phase || 'kenalan',
            current_handler: d.current_handler || 'mandala',
            lead_score: d.lead_score ?? 0,
            last_message_at: d.last_message_at || d.updated_at || '',
            created_at: d.created_at || '',
            updated_at: d.updated_at || '',
            avatar_color: AVATAR_COLORS[i % AVATAR_COLORS.length],
          }))
          setContacts(mapped)
        }
      }
    } catch (err) {
      console.error('Failed to load CRM data:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Filter & sort
  let filtered = contacts.filter(c => {
    if (filterPhase !== 'all' && c.phase !== filterPhase) return false
    if (filterHandler !== 'all' && c.current_handler !== filterHandler) return false
    if (search) {
      const q = search.toLowerCase()
      const name = getDisplayName(c).toLowerCase()
      return name.includes(q) || c.customer_number.includes(q)
    }
    return true
  })

  filtered.sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'name': cmp = getDisplayName(a).localeCompare(getDisplayName(b)); break
      case 'score': cmp = a.lead_score - b.lead_score; break
      case 'last_message': cmp = new Date(a.last_message_at || 0).getTime() - new Date(b.last_message_at || 0).getTime(); break
      case 'created_at': cmp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(); break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Stats
  const stats = {
    total: contacts.length,
    active: contacts.filter(c => c.status === 'active').length,
    mandalaHandled: contacts.filter(c => c.current_handler === 'mandala').length,
    ownerHandled: contacts.filter(c => c.current_handler === 'owner').length,
    closing: contacts.filter(c => c.phase === 'closing').length,
    highScore: contacts.filter(c => c.lead_score >= 50).length,
    avgScore: contacts.length > 0 ? Math.round(contacts.reduce((s, c) => s + c.lead_score, 0) / contacts.length) : 0,
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: brand.primary }} />
        <p className="text-sm text-slate-400">Memuat data CRM...</p>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 p-4 sm:p-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7" style={{ color: brand.primary }} />
            CRM & Pipeline
          </h1>
          <p className="text-sm text-slate-400 mt-1">Kelola prospek dari percakapan Mandala AI</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.1s', animationFillMode: 'both' }}>
        {[
          { label: 'Total Prospek', value: stats.total, color: brand.primary },
          { label: 'Aktif', value: stats.active, color: '#0060E1' },
          { label: 'Mandala', value: stats.mandalaHandled, color: brand.accent },
          { label: 'Owner', value: stats.ownerHandled, color: brand.success },
          { label: 'Closing', value: stats.closing, color: '#10B981' },
          { label: 'Skor 50+', value: stats.highScore, color: brand.warning },
          { label: 'Avg. Skor', value: stats.avgScore, color: brand.orange },
        ].map((s) => (
          <div key={s.label} className={card + ' p-4 hover:shadow-[0_8px_24px_rgba(0,96,225,0.08)] transition-all duration-300'}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
            <div className="w-8 h-1 rounded-full mt-2" style={{ backgroundColor: s.color, opacity: 0.3 }} />
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className={card + ' p-4'} style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.2s', animationFillMode: 'both' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau nomor telepon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${showFilters ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            <Filter className="w-4 h-4" />
            Filter
            {(filterPhase !== 'all' || filterHandler !== 'all') && (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phase:</span>
              {(['all', ...Object.keys(PHASE_CONFIG)] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterPhase(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterPhase === s ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  style={filterPhase === s ? { backgroundColor: s === 'all' ? brand.primary : PHASE_CONFIG[s]?.color } : {}}
                >
                  {s === 'all' ? 'Semua' : (PHASE_CONFIG[s] || DEFAULT_PHASE).label}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-slate-200 mx-2 self-center" />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Handler:</span>
              {(['all', 'mandala', 'owner'] as const).map(h => (
                <button
                  key={h}
                  onClick={() => setFilterHandler(h)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterHandler === h ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {h === 'all' ? 'Semua' : h === 'mandala' ? '🤖 Mandala' : '👤 Owner'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contact Table */}
      <div className={card + ' overflow-hidden'}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  { key: 'name' as SortField, label: 'Prospek', width: 'min-w-[220px]' },
                  { key: 'score' as SortField, label: 'Skor', width: 'w-[80px]' },
                  { key: null, label: 'Phase', width: 'w-[140px]' },
                  { key: null, label: 'Handler', width: 'w-[100px]' },
                  { key: 'last_message' as SortField, label: 'Terakhir Chat', width: 'w-[120px]' },
                  { key: 'created_at' as SortField, label: 'Sejak', width: 'w-[100px]' },
                ].map(col => (
                  <th
                    key={col.label}
                    className={`text-left px-4 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider ${col.width} ${col.key ? 'cursor-pointer hover:text-slate-600 select-none' : ''}`}
                    onClick={() => col.key && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.key && sortField === col.key && (
                        sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                      {col.key && sortField !== col.key && (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => {
                const scoreStyle = getScoreColor(contact.lead_score)
                const phaseConf = PHASE_CONFIG[contact.phase] || DEFAULT_PHASE
                return (
                  <tr
                    key={contact.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedContact(contact)}
                  >
                    {/* Prospect */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                          style={{ backgroundColor: contact.avatar_color }}
                        >
                          {getInitials(contact.customer_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800 truncate">{getDisplayName(contact)}</p>
                          <span className="text-[11px] text-slate-400 truncate flex items-center gap-0.5">
                            <Phone className="w-3 h-3 flex-shrink-0" /> {formatPhoneDisplay(contact.customer_number)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3.5">
                      <div
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] font-bold"
                        style={{ backgroundColor: scoreStyle.bg, color: scoreStyle.color }}
                      >
                        {contact.lead_score}
                      </div>
                    </td>

                    {/* Phase */}
                    <td className="px-4 py-3.5">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: phaseConf.bg, color: phaseConf.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: phaseConf.color }} />
                        {phaseConf.label}
                      </span>
                    </td>

                    {/* Handler */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg ${contact.current_handler === 'mandala' ? 'bg-violet-50 text-violet-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {contact.current_handler === 'mandala' ? <Bot className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                        {contact.current_handler === 'mandala' ? 'Mandala' : 'Owner'}
                      </span>
                    </td>

                    {/* Last Message */}
                    <td className="px-4 py-3.5">
                      <span className="text-[12px] text-slate-500">{formatDate(contact.last_message_at)}</span>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3.5">
                      <span className="text-[12px] text-slate-500">{formatDate(contact.created_at)}</span>
                    </td>
                  </tr>
                )
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: brand.primarySoft }}>
                        <Users className="w-6 h-6" style={{ color: brand.primary }} />
                      </div>
                      <p className="text-sm font-medium text-slate-700">Tidak ada prospek ditemukan</p>
                      <p className="text-xs text-slate-400 mt-1">Coba ubah filter atau tunggu prospek baru dari Mandala</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Menampilkan <span className="font-semibold text-slate-600">{filtered.length}</span> dari {contacts.length} prospek
          </p>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <TrendingUp className="w-3 h-3" style={{ color: brand.success }} />
            <span className="font-semibold" style={{ color: brand.success }}>{stats.closing}</span> di fase closing
          </div>
        </div>
      </div>

      {/* Contact Detail Drawer */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedContact(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">Detail Prospek</h3>
                <button onClick={() => setSelectedContact(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Avatar + Name */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold"
                  style={{ backgroundColor: selectedContact.avatar_color }}
                >
                  {getInitials(selectedContact.customer_name)}
                </div>
                <div>
                  <h4 className="text-[17px] font-bold text-slate-900">{getDisplayName(selectedContact)}</h4>
                  <p className="text-sm text-slate-500">{formatPhoneDisplay(selectedContact.customer_number)}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                {[
                  { icon: Phone, label: 'Telepon', color: brand.success },
                  { icon: MessageSquare, label: 'WhatsApp', color: '#25D366' },
                ].map(a => (
                  <button key={a.label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all">
                    <a.icon className="w-5 h-5" style={{ color: a.color }} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{a.label}</span>
                  </button>
                ))}
              </div>

              {/* Info Fields */}
              <div className="space-y-4 mb-6">
                {[
                  { label: 'Nomor WhatsApp', value: formatPhoneDisplay(selectedContact.customer_number) },
                  { label: 'Phase Pipeline', value: (PHASE_CONFIG[selectedContact.phase] || DEFAULT_PHASE).label },
                  { label: 'Ditangani Oleh', value: selectedContact.current_handler === 'mandala' ? '🤖 Mandala AI' : '👤 Owner' },
                  { label: 'Skor Lead', value: `${selectedContact.lead_score}/100` },
                  { label: 'Status', value: selectedContact.status },
                  { label: 'Terakhir Chat', value: formatDate(selectedContact.last_message_at) },
                  { label: 'Pertama Chat', value: formatDate(selectedContact.created_at) },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{f.label}</p>
                    <p className="text-[14px] font-medium text-slate-700">{f.value || '-'}</p>
                  </div>
                ))}
              </div>

              {/* Phase Journey */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Phase Journey</h4>
                <div className="space-y-2">
                  {PHASES.map((p) => {
                    const isCurrent = selectedContact.phase === p.key
                    const isPast = PHASES.findIndex(x => x.key === selectedContact.phase) > PHASES.findIndex(x => x.key === p.key)
                    return (
                      <div key={p.key} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${isCurrent ? p.lightBg : isPast ? 'bg-slate-50' : ''}`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${isCurrent ? p.color : isPast ? 'bg-slate-300' : 'bg-slate-200'}`} />
                        <span className={`text-[12px] font-semibold ${isCurrent ? p.text : isPast ? 'text-slate-500' : 'text-slate-300'}`}>{p.label}</span>
                        {isCurrent && <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-400">Saat ini</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
