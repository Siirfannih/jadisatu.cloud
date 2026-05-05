'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  PenTool, TrendingUp, Eye, Calendar, Image, Upload,
  Sparkles, Target, Clock, Lightbulb, Zap, Search,
  ChevronRight, ArrowUpRight, GripVertical, Plus, X,
  Instagram, Linkedin, MessageCircle, Hash, Loader2,
  Edit2, Trash2, ChevronLeft, BarChart3,
  ExternalLink,
  ArrowLeft
} from 'lucide-react'

type ContentTab = 'ringkasan' | 'perencana' | 'inspirasi'
type ContentStatus = 'idea' | 'draft' | 'script' | 'ready' | 'published'

interface ContentCard {
  id: string
  title: string
  script?: string
  caption?: string
  platform: string
  status: ContentStatus
  publish_date?: string
  created_at?: string
  updated_at?: string
  assignee?: string
}

// Column definitions with monochrome blue scale
const kanbanColumns: { id: ContentStatus; label: string; borderColor: string }[] = [
  { id: 'idea', label: 'Ide', borderColor: 'border-t-[#0060E1]' },
  { id: 'draft', label: 'Draft', borderColor: 'border-t-[#3B82F6]' },
  { id: 'script', label: 'Script', borderColor: 'border-t-[#60A5FA]' },
  { id: 'ready', label: 'Siap', borderColor: 'border-t-[#93C5FD]' },
  { id: 'published', label: 'Terbit', borderColor: 'border-t-[#10B981]' },
]

const platformIcon = (platform: string) => {
  switch (platform?.toLowerCase()) {
    case 'instagram': return <Instagram className="w-3 h-3" />
    case 'linkedin': return <Linkedin className="w-3 h-3" />
    case 'whatsapp': return <MessageCircle className="w-3 h-3" />
    case 'tiktok': return <span className="text-[9px] font-bold">TT</span>
    default: return <Hash className="w-3 h-3" />
  }
}

const getStatusColor = (status: ContentStatus) => {
  switch (status) {
    case 'published': return 'bg-emerald-100 text-emerald-600'
    case 'ready': return 'bg-cyan-100 text-cyan-600'
    case 'script': return 'bg-blue-100 text-blue-600'
    case 'draft': return 'bg-slate-100 text-slate-600'
    case 'idea': return 'bg-slate-100 text-slate-600'
    default: return 'bg-slate-100 text-slate-600'
  }
}

const formatDate = (dateString?: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })
}


// Format Indonesian date for calendar/timeline
function formatDateID(date: Date): string {
  return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Check if dates are on the same day
function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

// Get days in month
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

// Get first day of month (0 = Sunday, 1 = Monday, etc.)
function getFirstDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
}

// Format relative date for timeline (hari ini, besok, or date)
function getRelativeDateLabel(date: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)

  const diff = Math.floor((checkDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diff === 0) return 'Hari ini'
  if (diff === 1) return 'Besok'

  return checkDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<ContentTab>('ringkasan')
  const [cards, setCards] = useState<ContentCard[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPlatform, setNewPlatform] = useState('instagram')

  // Calendar state (for Ringkasan mini-calendar)
  const [calendarDate, setCalendarDate] = useState(new Date())

  // Workspace editor state (replaces modal)
  const [editorCard, setEditorCard] = useState<ContentCard | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPlatform, setEditPlatform] = useState('instagram')
  const [editStatus, setEditStatus] = useState<ContentStatus>('idea')
  const [editScript, setEditScript] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [editPublishDate, setEditPublishDate] = useState('')

  // Save state
  const [saving, setSaving] = useState(false)

  // Drag-and-drop state
  const [draggedCard, setDraggedCard] = useState<ContentCard | null>(null)

  const fetchContents = useCallback(async () => {
    try {
      const res = await fetch('/api/contents')
      if (res.ok) {
        const data = await res.json()
        setCards(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Failed to load contents:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContents()
  }, [fetchContents])

  // ========== CREATE CONTENT ==========
  async function createContent() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          platform: newPlatform,
          status: 'idea',
        }),
      })
      if (res.ok) {
        setNewTitle('')
        setNewPlatform('instagram')
        setShowCreateModal(false)
        fetchContents()
      }
    } catch (err) {
      console.error('Failed to create content:', err)
    } finally {
      setCreating(false)
    }
  }

  // ========== UPDATE CARD (via workspace) ==========
  async function updateCard() {
    if (!editorCard || !editTitle.trim()) return
    setSaving(true)
    try {
      const publishDate = editPublishDate && editPublishDate.trim() !== '' ? editPublishDate : null
      const res = await fetch('/api/contents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editorCard.id,
          title: editTitle,
          platform: editPlatform,
          status: editStatus,
          script: editScript,
          caption: editCaption,
          publish_date: publishDate,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('Save failed:', res.status, errData)
        setSaving(false)
        return
      }
      const updatedData = await res.json()
      setCards(prev =>
        prev.map(c =>
          c.id === editorCard.id
            ? {
              ...c,
              title: updatedData.title ?? editTitle,
              platform: updatedData.platform ?? editPlatform,
              status: updatedData.status ?? editStatus,
              script: updatedData.script ?? editScript,
              caption: updatedData.caption ?? editCaption,
              publish_date: updatedData.publish_date ?? publishDate,
              updated_at: updatedData.updated_at ?? new Date().toISOString(),
            }
            : c
        )
      )
      closeWorkspace()
    } catch (err) {
      console.error('Failed to update content:', err)
    } finally {
      setSaving(false)
    }
  }

  // ========== DELETE CARD ==========
  async function deleteCard(id: string) {
    try {
      await fetch(`/api/contents?id=${id}`, { method: 'DELETE' })
      setCards(prev => prev.filter(c => c.id !== id))
      closeWorkspace()
    } catch (err) {
      console.error('Failed to delete content:', err)
    }
  }

  // ========== OPEN WORKSPACE ==========
  function openWorkspace(card: ContentCard) {
    setEditorCard(card)
    setEditTitle(card.title)
    setEditPlatform(card.platform)
    setEditStatus(card.status)
    setEditScript(card.script || '')
    setEditCaption(card.caption || '')
    setEditPublishDate(card.publish_date || '')
  }

  // ========== CLOSE WORKSPACE ==========
  function closeWorkspace() {
    setEditorCard(null)
    setEditTitle('')
    setEditPlatform('instagram')
    setEditStatus('idea')
    setEditScript('')
    setEditCaption('')
    setEditPublishDate('')
  }

  // ========== DRAG AND DROP HANDLERS ==========
  function handleDragStart(e: React.DragEvent<HTMLDivElement>, card: ContentCard) {
    setDraggedCard(card)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDropColumn(e: React.DragEvent<HTMLDivElement>, targetStatus: ContentStatus) {
    e.preventDefault()
    if (!draggedCard || draggedCard.status === targetStatus) {
      setDraggedCard(null)
      return
    }

    try {
      await fetch('/api/contents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draggedCard.id, status: targetStatus }),
      })
      setCards(prev =>
        prev.map(c =>
          c.id === draggedCard.id ? { ...c, status: targetStatus } : c
        )
      )
    } catch (err) {
      console.error('Failed to update status:', err)
    }
    setDraggedCard(null)
  }

  // ========== HELPERS ==========
  const filteredCards = searchTerm
    ? cards.filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()))
    : cards

  const totalCards = cards.length
  const publishedCount = cards.filter(c => c.status === 'published').length
  const readyCount = cards.filter(c => c.status === 'ready').length
  const draftCount = cards.filter(c => c.status === 'draft' || c.status === 'script').length

  const tabs: { id: ContentTab; label: string }[] = [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'perencana', label: 'Perencana' },
    { id: 'inspirasi', label: 'Inspirasi' },
  ]

  const metrics = [
    { label: 'Total Konten', value: totalCards.toString(), icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Terbit', value: publishedCount.toString(), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Dalam Proses', value: draftCount.toString(), icon: PenTool, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Siap Publish', value: readyCount.toString(), icon: Calendar, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  ]

  // Get published cards for scorecard
  const publishedCards = cards.filter(c => c.status === 'published')

  // Get scheduled cards for timeline (those with publish_date or status 'ready')
  const scheduledCards = cards
    .filter(c => c.publish_date || c.status === 'ready')
    .sort((a, b) => {
      const dateA = a.publish_date ? new Date(a.publish_date) : new Date('9999')
      const dateB = b.publish_date ? new Date(b.publish_date) : new Date('9999')
      return dateA.getTime() - dateB.getTime()
    })

  // Get days with scheduled content for calendar highlighting
  const daysWithContent = new Set<number>()
  const currentMonth = calendarDate.getMonth()
  const currentYear = calendarDate.getFullYear()
  scheduledCards.forEach(card => {
    if (card.publish_date) {
      const date = new Date(card.publish_date)
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        daysWithContent.add(date.getDate())
      }
    }
  })

  // Get next 3-4 upcoming items for mini-timeline in Ringkasan
  const upcomingItems = scheduledCards.slice(0, 4)

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <div className="px-4 sm:px-8 pt-6 pb-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6" style={{ animation: 'slide-up 0.5s ease-out' }}>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-800">Konten</h1>
              <p className="text-slate-400 mt-1">Kelola, rencanakan, dan optimalkan konten bisnis Anda.</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-[#0060E1] hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" /> Buat Konten
            </button>
          </div>

          {/* TABS */}
          <div className="flex gap-1 border-b border-slate-200">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-all',
                  activeTab === tab.id
                    ? 'border-[#0060E1] text-[#0060E1]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto">

          {/* ===== TAB: RINGKASAN (OVERVIEW) ===== */}
          {activeTab === 'ringkasan' && (
            <div className="space-y-6">
              {/* AI Summary Banner */}
              <div
                className="bg-slate-800 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center gap-4 text-white"
                style={{ animation: 'slide-up 0.5s ease-out' }}
              >
                <div className="p-3 rounded-xl bg-white/10">
                  <Sparkles className="w-5 h-5" />
                </div>
                <p className="text-sm flex-1">
                  Anda memiliki <span className="font-semibold">{totalCards} konten</span> total.
                  {readyCount > 0 && <> <span className="text-emerald-300 font-semibold">{readyCount} siap</span> untuk dipublikasikan.</>}
                  {draftCount > 0 && <> {draftCount} sedang dalam proses.</>}
                </p>
              </div>

              {/* Metrics Grid */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#0060E1] animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {metrics.map((m, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all"
                      style={{ animation: 'slide-up 0.5s ease-out', animationDelay: `${i * 0.1}s` }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className={`p-2 rounded-xl ${m.bg}`}>
                          <m.icon className={`w-4 h-4 ${m.color}`} />
                        </div>
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        {m.label}
                      </p>
                      <p className="text-2xl font-bold text-slate-800">{m.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Three-Column Grid: Siap Publish + Performa Konten + Jadwal Mendatang */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Siap Publish */}
                <div
                  className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                  style={{ animation: 'slide-up 0.5s ease-out', animationDelay: '0.2s' }}
                >
                  <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-slate-800">
                    <Calendar className="w-4 h-4 text-[#0060E1]" /> Siap Publish
                  </h3>
                  <div className="space-y-3">
                    {cards.filter(c => c.status === 'ready').slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all cursor-pointer"
                        onClick={() => openWorkspace(item)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-1.5 rounded-lg bg-slate-100 shrink-0">
                            {platformIcon(item.platform)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                            <p className="text-[10px] text-slate-400">{item.platform}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openWorkspace(item)
                          }}
                          className="text-[10px] px-2 py-1 rounded bg-emerald-100 text-emerald-600 font-bold hover:bg-emerald-200 transition-colors shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                    {cards.filter(c => c.status === 'ready').length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-6">Belum ada konten siap publish</p>
                    )}
                  </div>
                </div>

                {/* Column 2: Performa Konten (Published Analytics) */}
                <div
                  className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                  style={{ animation: 'slide-up 0.5s ease-out', animationDelay: '0.3s' }}
                >
                  <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-slate-800">
                    <BarChart3 className="w-4 h-4 text-[#0060E1]" /> Performa Konten
                  </h3>
                  <div className="space-y-4">
                    {publishedCards.length > 0 ? (
                      publishedCards.slice(0, 3).map((card) => {
                        return (
                          <div key={card.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-sm font-medium text-slate-800 truncate mb-2">{card.title}</p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500">
                              {card.platform && (
                                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">{card.platform}</span>
                              )}
                              {card.publish_date && (
                                <span>{new Date(card.publish_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                              )}
                              {card.status === 'published' && (
                                <span className="text-emerald-600 font-semibold">Terbit</span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-6">Belum ada konten terpublikasi</p>
                    )}
                  </div>
                </div>

                {/* Column 3: Jadwal Mendatang (Compact Mini-Calendar + Timeline) */}
                <div
                  className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                  style={{ animation: 'slide-up 0.5s ease-out', animationDelay: '0.4s' }}
                >
                  <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-slate-800">
                    <Calendar className="w-4 h-4 text-[#0060E1]" /> Jadwal Mendatang
                  </h3>

                  {/* Compact Mini-Calendar */}
                  <div className="mb-5 pb-5 border-b border-slate-100">
                    {/* Month/Year Header with Nav Arrows */}
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                      </button>
                      <p className="text-sm font-bold text-slate-800">
                        {calendarDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                      </p>
                      <button
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}
                        className="p-1 hover:bg-slate-100 rounded transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>

                    {/* Day Grid (S S R K J S M) */}
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                      {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((day, i) => (
                        <p key={i} className="text-[9px] font-bold uppercase text-slate-400">
                          {day}
                        </p>
                      ))}
                    </div>

                    {/* Days with dots */}
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: getFirstDayOfMonth(calendarDate) }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {Array.from({ length: getDaysInMonth(calendarDate) }).map((_, i) => {
                        const day = i + 1
                        const hasContent = daysWithContent.has(day)
                        return (
                          <div
                            key={day}
                            className="flex flex-col items-center justify-center p-1 text-[11px] font-medium text-slate-600 rounded hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <span>{day}</span>
                            {hasContent && (
                              <div className="w-1 h-1 rounded-full bg-[#0060E1] mt-0.5" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Mini-Timeline: Next 3-4 Items */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Mendatang
                    </p>
                    {upcomingItems.length > 0 ? (
                      upcomingItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-2 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-all cursor-pointer"
                          onClick={() => openWorkspace(item)}
                        >
                          <p className="text-[10px] font-bold text-slate-400 mb-1">
                            {item.publish_date ? getRelativeDateLabel(new Date(item.publish_date)) : 'Belum jadwal'}
                          </p>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1 rounded bg-slate-100 shrink-0">
                              {platformIcon(item.platform)}
                            </div>
                            <p className="text-xs font-medium text-slate-800 truncate">{item.title}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-4">Tidak ada jadwal mendatang</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== TAB: PERENCANA (KANBAN) ===== */}
          {activeTab === 'perencana' && (
            <div className="space-y-6">
              {/* Search Bar */}
              <div
                className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-200"
                style={{ animation: 'slide-up 0.5s ease-out' }}
              >
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari konten..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder-slate-400"
                />
              </div>

              {/* Kanban Columns */}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-[#0060E1] animate-spin" />
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {kanbanColumns.map((col, colIndex) => {
                    const colCards = filteredCards.filter(c => c.status === col.id)
                    return (
                      <div
                        key={col.id}
                        className={`min-w-[280px] w-[280px] shrink-0 bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border-t-4 ${col.borderColor}`}
                        style={{ animation: 'slide-up 0.5s ease-out', animationDelay: `${colIndex * 0.08}s` }}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropColumn(e, col.id)}
                      >
                        {/* Column Header */}
                        <div className="p-3 flex items-center justify-between border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">{col.label}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {colCards.length}
                            </span>
                          </div>
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="p-1 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </div>

                        {/* Cards Container */}
                        <div className="p-3 space-y-2 min-h-[400px]">
                          {colCards.map((card) => (
                            <div
                              key={card.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, card)}
                              onClick={() => openWorkspace(card)}
                              className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-300 cursor-move transition-all group"
                            >
                              <div className="flex items-start gap-3 mb-2">
                                <GripVertical className="w-3.5 h-3.5 text-slate-300 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800 line-clamp-2">{card.title}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">{card.platform}</p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openWorkspace(card)
                                  }}
                                  className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200 shrink-0"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                                </button>
                              </div>
                              {card.publish_date && (
                                <div className="flex items-center gap-2 px-2 py-1 bg-white rounded border border-slate-100 text-[9px] text-slate-600">
                                  <Calendar className="w-2.5 h-2.5" />
                                  <span>{formatDate(card.publish_date)}</span>
                                </div>
                              )}
                            </div>
                          ))}
                          {colCards.length === 0 && (
                            <div className="flex items-center justify-center h-[200px] text-slate-400 text-sm">
                              Tidak ada konten
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== TAB: INSPIRASI ===== */}
          {activeTab === 'inspirasi' && (
            <div className="space-y-6">
              {/* Header */}
              <div style={{ animation: 'slide-up 0.5s ease-out' }}>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Inspirasi Konten</h2>
                <p className="text-slate-400">Ide-ide segar untuk konten yang lebih engaging dan impactful.</p>
              </div>

              {/* Inspirasi Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    icon: Lightbulb,
                    title: 'Behind The Scenes',
                    description: 'Tunjukkan proses kreatif dan culture tim Anda.',
                    color: 'text-amber-600',
                    bg: 'bg-amber-50',
                  },
                  {
                    icon: Target,
                    title: 'User Testimonial',
                    description: 'Cerita sukses dan kepuasan pelanggan nyata.',
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50',
                  },
                  {
                    icon: Zap,
                    title: 'Quick Tips',
                    description: 'Berbagi nilai dalam format singkat dan actionable.',
                    color: 'text-cyan-600',
                    bg: 'bg-cyan-50',
                  },
                  {
                    icon: Clock,
                    title: 'Live Events',
                    description: 'Tayang langsung untuk engagement real-time maksimal.',
                    color: 'text-pink-600',
                    bg: 'bg-pink-50',
                  },
                  {
                    icon: Target,
                    title: 'Product Demo',
                    description: 'Demonstrasi fitur dan keunggulan produk secara visual.',
                    color: 'text-blue-600',
                    bg: 'bg-blue-50',
                  },
                  {
                    icon: Sparkles,
                    title: 'Educational Series',
                    description: 'Serial pembelajaran yang membangun expertise dan trust.',
                    color: 'text-purple-600',
                    bg: 'bg-purple-50',
                  },
                ].map((item, i) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={i}
                      className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100 hover:border-slate-200 hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all cursor-pointer group"
                      style={{ animation: 'slide-up 0.5s ease-out', animationDelay: `${i * 0.08}s` }}
                      onClick={() => {
                        setNewTitle(item.title)
                        setShowCreateModal(true)
                      }}
                    >
                      <div className={`p-3 rounded-xl ${item.bg} w-fit mb-4 group-hover:scale-110 transition-transform`}>
                        <Icon className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <h3 className="text-base font-bold text-slate-800 mb-2">{item.title}</h3>
                      <p className="text-sm text-slate-500 mb-4">{item.description}</p>
                      <button className="text-[10px] font-bold uppercase tracking-wider text-[#0060E1] hover:text-blue-700 transition-colors flex items-center gap-1">
                        Gunakan Ide <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== CREATE CONTENT MODAL ===== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full sm:max-w-md p-6 animate-in slide-in-from-bottom sm:slide-in-from-center duration-300">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-slate-800">Buat Konten Baru</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Judul Konten
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Masukkan judul konten..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0060E1] focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Platform
                </label>
                <div className="flex gap-2 flex-wrap">
                  {['Instagram', 'LinkedIn', 'WhatsApp', 'TikTok', 'Twitter/X'].map((platform) => (
                    <button
                      key={platform}
                      onClick={() => setNewPlatform(platform.toLowerCase())}
                      className={cn(
                        'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                        newPlatform === platform.toLowerCase()
                          ? 'bg-[#0060E1] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={createContent}
                disabled={creating || !newTitle.trim()}
                className="flex-1 px-4 py-2.5 bg-[#0060E1] hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Membuat...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Buat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FULL-PAGE WORKSPACE OVERLAY ===== */}
      {editorCard && (
        <div className="fixed inset-0 z-50 bg-white animate-in slide-in-from-bottom duration-200">
          {/* Top Bar */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <button
              onClick={closeWorkspace}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" /> Kembali
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => deleteCard(editorCard.id)}
                className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
              >
                Hapus
              </button>
              <button
                onClick={updateCard}
                disabled={saving || !editTitle.trim()}
                className="px-4 py-2 bg-[#0060E1] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                  </>
                ) : (
                  'Simpan'
                )}
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex h-[calc(100vh-72px)] overflow-hidden">
            {/* Left Side: Writing Workspace (~70%) */}
            <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-8">
              <div className="max-w-3xl mx-auto space-y-8">
                {/* Title */}
                <div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Judul konten..."
                    className="text-3xl font-bold text-slate-800 w-full bg-transparent border-none outline-none placeholder-slate-300 focus:ring-0 p-0"
                  />
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-100" />

                {/* Naskah/Script Section */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    Naskah
                  </label>
                  <textarea
                    value={editScript}
                    onChange={(e) => setEditScript(e.target.value)}
                    placeholder="Mulai menulis naskah di sini..."
                    className="w-full min-h-[300px] text-[15px] leading-relaxed text-slate-700 bg-transparent border-none outline-none focus:ring-0 p-0 resize-vertical placeholder-slate-300"
                  />
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-100" />

                {/* Caption Section */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    Caption
                  </label>
                  <textarea
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Tambahkan caption untuk media sosial..."
                    className="w-full min-h-[120px] text-[15px] leading-relaxed text-slate-700 bg-transparent border-none outline-none focus:ring-0 p-0 resize-vertical placeholder-slate-300"
                  />
                </div>
              </div>
            </div>

            {/* Right Side: Metadata Sidebar (~30%, max-w-[280px]) */}
            <div className="w-full sm:w-[280px] max-w-[280px] bg-slate-50 border-l border-slate-100 overflow-y-auto flex flex-col">
              <div className="p-5 space-y-6 flex-1">
                {/* Status */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    Status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['idea', 'draft', 'script', 'ready', 'published'] as ContentStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => setEditStatus(status)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all',
                          editStatus === status
                            ? 'bg-[#0060E1] text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                        )}
                      >
                        {status === 'idea' && 'Ide'}
                        {status === 'draft' && 'Draft'}
                        {status === 'script' && 'Script'}
                        {status === 'ready' && 'Siap'}
                        {status === 'published' && 'Terbit'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Platform */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    Platform
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['instagram', 'linkedin', 'whatsapp', 'tiktok', 'twitter/x'].map((platform) => (
                      <button
                        key={platform}
                        onClick={() => setEditPlatform(platform)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1',
                          editPlatform === platform
                            ? 'bg-[#0060E1] text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                        )}
                      >
                        {platformIcon(platform)}
                        <span>{platform}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Schedule Date */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
                    Jadwal Publikasi
                  </p>
                  <div
                    className="relative w-full cursor-pointer"
                    onClick={() => {
                      const input = document.getElementById('publish-date-input') as HTMLInputElement
                      if (input?.showPicker) input.showPicker()
                      else input?.focus()
                    }}
                  >
                    <div className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:border-slate-300 transition-colors flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className={editPublishDate ? 'text-slate-800' : 'text-slate-400'}>
                        {editPublishDate
                          ? new Date(editPublishDate).toLocaleDateString('id-ID', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                          : 'Pilih tanggal & waktu...'}
                      </span>
                    </div>
                    <input
                      id="publish-date-input"
                      type="datetime-local"
                      value={editPublishDate ? editPublishDate.slice(0, 16) : ''}
                      onChange={(e) => setEditPublishDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      tabIndex={-1}
                    />
                  </div>
                  {editPublishDate && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditPublishDate('') }}
                      className="mt-2 text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                    >
                      Hapus jadwal
                    </button>
                  )}
                </div>

                {/* Created/Updated Info */}
                <div className="pt-5 border-t border-slate-200">
                  <div className="space-y-2 text-[10px] text-slate-500">
                    {editorCard.created_at && (
                      <p>
                        <span className="font-bold text-slate-600">Dibuat:</span> {new Date(editorCard.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                    {editorCard.updated_at && (
                      <p>
                        <span className="font-bold text-slate-600">Diubah:</span> {new Date(editorCard.updated_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Platform Icon Indicator (bottom) */}
              <div className="p-5 border-t border-slate-200 flex justify-center">
                <div className="p-4 rounded-xl bg-white border border-slate-100">
                  <div className="w-8 h-8 flex items-center justify-center text-2xl">
                    {platformIcon(editPlatform)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
