'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase-browser'
import {
  MessageSquare, Users, UserCheck, Bot, Activity, Phone,
  Search, Filter, Clock, AlertTriangle, CheckCircle2, Send,
  ChevronRight, Star, Building2, Mail, Calendar, ArrowRight,
  Hand, Shield, Loader2,
} from 'lucide-react'
import type { Conversation } from './types'
import { PHASES } from './types'

const brand = {
  primary: '#0060E1',
  primarySoft: '#EFF6FF',
  accent: '#6366F1',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
}

const card = 'bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)]'

interface ChatMessage {
  id: string
  sender: 'customer' | 'mandala' | 'owner'
  text: string
  time: string
}

interface Props {
  conversations: Conversation[]
  onTakeover: (id: string) => void
  onRelease: (id: string) => void
}

function mapConversation(c: any): Conversation {
  return {
    id: c.id,
    tenant_id: c.tenant_id || '',
    customer_name: c.customer_name || '',
    customer_number: c.customer_number || '',
    channel: 'whatsapp',
    status: c.status || 'active',
    phase: c.phase || 'kenalan',
    current_handler: c.current_handler || 'mandala',
    owner_active: c.current_handler === 'owner',
    score: c.lead_score ?? c.score ?? 0,
    updated_at: c.last_message_at || c.updated_at || '',
  }
}

function getTimeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}j`
  return `${Math.floor(hours / 24)}h`
}

function getScoreColor(score: number) {
  if (score >= 80) return brand.success
  if (score >= 50) return brand.primary
  return '#94A3B8'
}

function getAvatarColor(name: string) {
  const colors = ['#0060E1', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#F97316', '#8B5CF6', '#EC4899']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

function formatPhone(phone: string) {
  if (!phone) return ''
  const clean = phone.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '')
  if (clean.startsWith('62') && clean.length >= 10) {
    return '+' + clean.slice(0, 2) + ' ' + clean.slice(2, 5) + '-' + clean.slice(5, 9) + '-' + clean.slice(9)
  }
  return clean
}

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function CockpitConversations({ conversations, onTakeover, onRelease }: Props) {
  const supabase = createClient()
  const allConversations = conversations.map(mapConversation)
  const [selectedId, setSelectedId] = useState<string | null>(allConversations[0]?.id || null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPhase, setFilterPhase] = useState<string>('all')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from('mandala_messages')
        .select('id, direction, sender, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (!error && data) {
        const mapped: ChatMessage[] = data.map((m: any) => ({
          id: m.id,
          sender: m.direction === 'incoming' ? 'customer' : (m.sender === 'owner' ? 'owner' : 'mandala'),
          text: m.content || '',
          time: formatTime(m.created_at),
        }))
        setMessages(mapped)
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [supabase])

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId)
    }
  }, [selectedId, loadMessages])

  const filtered = allConversations.filter(c => {
    if (filterPhase !== 'all' && c.phase !== filterPhase) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (c.customer_name || c.customer_number).toLowerCase().includes(q)
    }
    return true
  })

  const selected = allConversations.find(c => c.id === selectedId) || null
  const selectedPhase = selected ? PHASES.find(p => p.key === selected.phase) || PHASES[0] : null

  // Stats
  const totalActive = allConversations.filter(c => c.status === 'active').length
  const mandalaHandled = allConversations.filter(c => c.current_handler === 'mandala').length
  const ownerHandled = allConversations.filter(c => c.current_handler === 'owner').length
  const highScore = allConversations.filter(c => c.score >= 80).length

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: 'Percakapan Aktif', value: totalActive, color: brand.primary, icon: MessageSquare },
          { label: 'Ditangani Mandala', value: mandalaHandled, color: brand.accent, icon: Bot },
          { label: 'Diambil Alih', value: ownerHandled, color: brand.success, icon: UserCheck },
          { label: 'Skor Tinggi (80+)', value: highScore, color: brand.warning, icon: Star },
        ].map(s => (
          <div key={s.label} className={card + ' p-4 hover:shadow-[0_8px_24px_rgba(0,96,225,0.08)] transition-all duration-300'}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3-Panel Inbox */}
      <div className={card + ' overflow-hidden flex-1 min-h-0'}>
        <div className="flex h-full">
          {/* LEFT PANEL — Conversation List */}
          <div className="w-[320px] flex-shrink-0 border-r border-slate-100 flex flex-col h-full">
            {/* Search */}
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari percakapan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 rounded-xl pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
                />
              </div>
              {/* Phase filter pills */}
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setFilterPhase('all')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${filterPhase === 'all' ? 'text-white' : 'bg-slate-100 text-slate-500'}`}
                  style={filterPhase === 'all' ? { backgroundColor: brand.primary } : {}}
                >
                  Semua
                </button>
                {PHASES.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setFilterPhase(p.key)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${filterPhase === p.key ? `${p.lightBg} ${p.text}` : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <MessageSquare className="w-8 h-8 text-slate-200 mb-3" />
                  <p className="text-sm text-slate-400">Tidak ada percakapan</p>
                </div>
              ) : (
                filtered.map(conv => {
                  const phase = PHASES.find(p => p.key === conv.phase) || PHASES[0]
                  const isActive = conv.id === selectedId
                  const isOwner = conv.current_handler === 'owner'

                  return (
                    <div
                      key={conv.id}
                      className={cn(
                        'px-4 py-3.5 cursor-pointer transition-all border-l-3',
                        isActive
                          ? 'bg-blue-50/60 border-l-[3px]'
                          : 'hover:bg-slate-50 border-l-[3px] border-transparent'
                      )}
                      style={isActive ? { borderLeftColor: brand.primary } : {}}
                      onClick={() => setSelectedId(conv.id)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[12px] font-bold"
                            style={{ backgroundColor: getAvatarColor(conv.customer_name || conv.customer_number) }}
                          >
                            {getInitials(conv.customer_name || conv.customer_number)}
                          </div>
                          <div className={cn(
                            'absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center',
                            isOwner ? 'bg-emerald-500' : 'bg-blue-500'
                          )}>
                            {isOwner ? <UserCheck className="w-2.5 h-2.5 text-white" /> : <Bot className="w-2.5 h-2.5 text-white" />}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-[13px] font-semibold text-slate-800 truncate">{conv.customer_name || formatPhone(conv.customer_number)}</h4>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">{getTimeAgo(conv.updated_at)}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {formatPhone(conv.customer_number)}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', phase.lightBg, phase.text)}>
                              {phase.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getScoreColor(conv.score) }} />
                              <span className="text-[10px] font-bold" style={{ color: getScoreColor(conv.score) }}>{conv.score}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* CENTER PANEL — Chat Preview */}
          <div className="flex-1 flex flex-col h-full min-w-0">
            {selected ? (
              <>
                {/* Chat Header */}
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                      style={{ backgroundColor: getAvatarColor(selected.customer_name || selected.customer_number) }}
                    >
                      {getInitials(selected.customer_name || selected.customer_number)}
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-slate-800">{selected.customer_name || formatPhone(selected.customer_number)}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">{selected.channel}</span>
                        <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', selectedPhase?.lightBg, selectedPhase?.text)}>
                          {selectedPhase?.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.current_handler === 'mandala' ? (
                      <button
                        onClick={() => onTakeover(selected.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider text-white transition-all hover:opacity-90 shadow-sm"
                        style={{ backgroundColor: brand.primary }}
                      >
                        <Hand className="w-3.5 h-3.5" /> Ambil Alih
                      </button>
                    ) : (
                      <button
                        onClick={() => onRelease(selected.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-500 transition-all"
                      >
                        <Bot className="w-3.5 h-3.5" /> Serahkan ke Mandala
                      </button>
                    )}
                  </div>
                </div>

                {/* Handler Banner */}
                <div className={cn(
                  'px-5 py-2 flex items-center gap-2 text-[11px] font-semibold',
                  selected.current_handler === 'mandala'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-emerald-50 text-emerald-600'
                )}>
                  {selected.current_handler === 'mandala' ? (
                    <><Bot className="w-3.5 h-3.5" /> Mandala AI sedang menangani percakapan ini</>
                  ) : (
                    <><UserCheck className="w-3.5 h-3.5" /> Anda sedang menangani percakapan ini</>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>Skor: {selected.score}/100</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ backgroundColor: '#F8FAFC' }}>
                  {loadingMessages ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-slate-300 mb-2" />
                      <p className="text-sm text-slate-400">Memuat pesan...</p>
                    </div>
                  ) : messages.length > 0 ? (
                    messages.map((msg) => {
                      const isCustomer = msg.sender === 'customer'
                      const isMandala = msg.sender === 'mandala'

                      return (
                        <div key={msg.id} className={cn('flex', isCustomer ? 'justify-start' : 'justify-end')}>
                          <div className={cn(
                            'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm',
                            isCustomer
                              ? 'bg-white rounded-tl-sm'
                              : isMandala
                                ? 'bg-blue-500 text-white rounded-tr-sm'
                                : 'bg-emerald-500 text-white rounded-tr-sm'
                          )}>
                            {!isCustomer && (
                              <p className={cn('text-[9px] font-bold uppercase tracking-wider mb-1', 'text-white/70')}>
                                {isMandala ? '🤖 Mandala' : '👤 Anda'}
                              </p>
                            )}
                            <p className={cn('text-[13px] leading-relaxed', isCustomer ? 'text-slate-700' : 'text-white')}>{msg.text}</p>
                            <p className={cn('text-[10px] mt-1 text-right', isCustomer ? 'text-slate-400' : 'text-white/60')}>{msg.time}</p>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageSquare className="w-10 h-10 text-slate-200 mb-3" />
                      <p className="text-sm text-slate-400">Belum ada pesan</p>
                    </div>
                  )}
                </div>

                {/* Input area (read-only preview) */}
                <div className="px-5 py-3 border-t border-slate-100 bg-white">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-50 rounded-xl px-4 py-2.5 text-[13px] text-slate-400">
                      {selected.current_handler === 'mandala'
                        ? 'Mandala sedang mengelola percakapan ini...'
                        : 'Ketik pesan untuk membalas...'}
                    </div>
                    <button className="p-2.5 rounded-xl transition-all" style={{ backgroundColor: brand.primarySoft, color: brand.primary }}>
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: brand.primarySoft }}>
                  <MessageSquare className="w-8 h-8" style={{ color: brand.primary }} />
                </div>
                <p className="text-lg font-semibold text-slate-700">Pilih Percakapan</p>
                <p className="text-sm text-slate-400 mt-1">Pilih percakapan di panel kiri untuk melihat preview</p>
              </div>
            )}
          </div>

          {/* RIGHT PANEL — Contact Detail */}
          {selected && (
            <div className="w-[280px] flex-shrink-0 border-l border-slate-100 overflow-y-auto h-full">
              <div className="p-5">
                {/* Contact Info */}
                <div className="text-center mb-5">
                  <div
                    className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white text-lg font-bold mb-3"
                    style={{ backgroundColor: getAvatarColor(selected.customer_name || selected.customer_number) }}
                  >
                    {getInitials(selected.customer_name || selected.customer_number)}
                  </div>
                  <h3 className="text-[15px] font-bold text-slate-800">{selected.customer_name || formatPhone(selected.customer_number)}</h3>
                  <p className="text-[12px] text-slate-500">{formatPhone(selected.customer_number)}</p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Skor</p>
                    <p className="text-lg font-bold" style={{ color: getScoreColor(selected.score) }}>{selected.score}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pesan</p>
                    <p className="text-lg font-bold text-slate-700">{messages.length}</p>
                  </div>
                </div>

                {/* Detail Fields */}
                <div className="space-y-3.5 mb-5">
                  {[
                    { icon: Phone, label: 'WhatsApp', value: formatPhone(selected.customer_number) },
                    { icon: Bot, label: 'Handler', value: selected.current_handler === 'mandala' ? 'Mandala AI' : 'Owner' },
                    { icon: Clock, label: 'Terakhir Aktif', value: getTimeAgo(selected.updated_at) + ' lalu' },
                  ].map(f => (
                    <div key={f.label} className="flex items-start gap-2.5">
                      <f.icon className="w-3.5 h-3.5 text-slate-300 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{f.label}</p>
                        <p className="text-[12px] font-medium text-slate-700">{f.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Phase Progress */}
                <div className="mb-5">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Fase Percakapan</p>
                  <div className="space-y-1.5">
                    {PHASES.filter(p => p.key !== 'rescue').map((phase) => {
                      const isCurrentPhase = selected.phase === phase.key
                      const phaseOrder = ['kenalan', 'gali_masalah', 'tawarkan_solusi', 'closing']
                      const currentIdx = phaseOrder.indexOf(selected.phase)
                      const thisIdx = phaseOrder.indexOf(phase.key)
                      const isPast = thisIdx < currentIdx && currentIdx >= 0

                      return (
                        <div key={phase.key} className="flex items-center gap-2">
                          <div className={cn(
                            'w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all',
                            isCurrentPhase ? phase.color : isPast ? phase.color + ' opacity-50' : 'bg-slate-200'
                          )} />
                          <span className={cn(
                            'text-[11px] font-medium transition-all',
                            isCurrentPhase ? 'text-slate-800 font-bold' : isPast ? 'text-slate-400' : 'text-slate-300'
                          )}>
                            {phase.label}
                          </span>
                          {isCurrentPhase && (
                            <span className="text-[9px] font-bold text-blue-500 ml-auto">AKTIF</span>
                          )}
                        </div>
                      )
                    })}
                    {selected.phase === 'rescue' && (
                      <div className="flex items-center gap-2 mt-1">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <span className="text-[11px] font-bold text-red-500">Mode Rescue Aktif</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
