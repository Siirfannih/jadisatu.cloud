'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Search, Users, Plus, Phone, Mail, Calendar,
  DollarSign, ArrowRight, X, UserPlus, TrendingUp,
  Zap, Send, Loader2
} from 'lucide-react'
import { leadToOutreach } from '@/lib/mandala-outreach'
import type { CreateOutreachRequest } from '@/lib/mandala-outreach'

interface Contact {
  id: string
  title: string
  body: string
  url: string
  source: string
  platform: string
  category: string
  status: string
  pain_score: number
  scraped_at: string
}

const PIPELINE_STAGES = [
  { key: 'lead', label: 'Lead', emoji: '🎯', color: 'border-blue-400/40 bg-blue-50/50 dark:bg-blue-500/5' },
  { key: 'prospect', label: 'Prospect', emoji: '💬', color: 'border-amber-400/40 bg-amber-50/50 dark:bg-amber-500/5' },
  { key: 'client', label: 'Client', emoji: '🤝', color: 'border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-500/5' },
  { key: 'completed', label: 'Completed', emoji: '✅', color: 'border-purple-400/40 bg-purple-50/50 dark:bg-purple-500/5' },
]

const NEXT_STAGE: Record<string, string> = {
  lead: 'prospect',
  prospect: 'client',
  client: 'completed',
}

export default function CRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContact, setNewContact] = useState({ title: '', body: '', platform: '', category: '' })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [sendingToMandala, setSendingToMandala] = useState<string | null>(null)

  const loadContacts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/leads?limit=200')
    if (res.ok) {
      const data = await res.json()
      setContacts(data.data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  async function moveToStage(id: string, newStatus: string) {
    setContacts(prev =>
      prev.map(c => c.id === id ? { ...c, status: newStatus } : c)
    )
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
    } catch {
      loadContacts()
    }
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData('contactId', id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(id)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDropTarget(null)
  }

  function handleDrop(e: React.DragEvent, stageKey: string) {
    e.preventDefault()
    setDropTarget(null)
    const id = e.dataTransfer.getData('contactId')
    if (!id) return
    const status = stageKey === 'lead' ? 'lead' : stageKey
    moveToStage(id, status)
    setDraggingId(null)
  }

  function handleDragOver(e: React.DragEvent, stageKey: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(stageKey)
  }

  async function addContact() {
    if (!newContact.title.trim()) return
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        status: 'lead',
        title: newContact.title,
        body: newContact.body,
        platform: newContact.platform,
        category: newContact.category,
      }),
    })
    setNewContact({ title: '', body: '', platform: '', category: '' })
    setShowAddForm(false)
    await loadContacts()
  }

  async function sendToMandala(contact: Contact) {
    setSendingToMandala(contact.id)
    try {
      const outreach: CreateOutreachRequest = leadToOutreach({
        id: contact.id,
        title: contact.title,
        body: contact.body,
        platform: contact.platform,
        category: contact.category,
        pain_score: contact.pain_score,
        status: contact.status,
      })
      const res = await fetch('/api/mandala/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outreach),
      })
      if (!res.ok) throw new Error('Failed to queue')
    } catch (err) {
      console.error('Failed to send to Mandala:', err)
    }
    setSendingToMandala(null)
  }

  const filtered = contacts.filter(c =>
    !searchQuery ||
    c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function getStageContacts(stageKey: string) {
    if (stageKey === 'lead') {
      return filtered.filter(c => !c.status || c.status === 'lead' || c.status === 'new')
    }
    return filtered.filter(c => c.status === stageKey)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">🤝 My Network</h1>
            <p className="text-muted-foreground text-sm">
              Build relationships, close deals, grow your network
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Add Contact
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {PIPELINE_STAGES.map(stage => {
            const count = getStageContacts(stage.key).length
            return (
              <div key={stage.key} className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3">
                <span className="text-lg">{stage.emoji}</span>
                <div>
                  <p className="text-xs text-muted-foreground">{stage.label}</p>
                  <p className="text-xl font-bold">{count}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Add New Contact</h2>
              <button onClick={() => setShowAddForm(false)} className="p-1 hover:bg-muted rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Name *"
                value={newContact.title}
                onChange={e => setNewContact(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                placeholder="Email or phone"
                value={newContact.body}
                onChange={e => setNewContact(p => ({ ...p, body: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                placeholder="Platform (e.g. Instagram, WhatsApp)"
                value={newContact.platform}
                onChange={e => setNewContact(p => ({ ...p, platform: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                placeholder="Category (e.g. Brand, Agency)"
                value={newContact.category}
                onChange={e => setNewContact(p => ({ ...p, category: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={addContact}
                disabled={!newContact.title.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                Add to Pipeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Pipeline */}
      <div className="flex-1 flex gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden px-4 sm:px-6 lg:px-8 pb-4 sm:pb-8 min-h-0 scrollbar-hide">
        {PIPELINE_STAGES.map(stage => {
          const stageContacts = getStageContacts(stage.key)
          return (
            <div
              key={stage.key}
              className={cn(
                'flex-1 min-w-[240px] sm:min-w-[260px] flex-shrink-0 flex flex-col rounded-2xl sm:rounded-3xl border-2 overflow-hidden transition-colors',
                stage.color,
                dropTarget === stage.key && 'ring-2 ring-primary ring-offset-2'
              )}
              onDrop={(e) => handleDrop(e, stage.key)}
              onDragOver={(e) => handleDragOver(e, stage.key)}
              onDragLeave={() => setDropTarget(null)}
            >
              {/* Column Header */}
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{stage.emoji}</span>
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <span className="bg-foreground/10 text-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {stageContacts.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {stageContacts.length === 0 ? (
                  <div className="text-center py-8 px-3">
                    <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground/60">
                      {stage.key === 'lead'
                        ? 'Add your first contact to get started! 🌟'
                        : `Move contacts here when they become ${stage.label.toLowerCase()}s`}
                    </p>
                  </div>
                ) : (
                  stageContacts.map(contact => (
                    <div
                      key={contact.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, contact.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'bg-card border border-border rounded-2xl p-3.5 hover:shadow-md hover:border-primary/20 transition-all group cursor-grab active:cursor-grabbing',
                        draggingId === contact.id && 'opacity-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-semibold text-sm line-clamp-1">{contact.title}</h4>
                        {contact.pain_score > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            <TrendingUp size={10} />
                            {contact.pain_score}
                          </span>
                        )}
                      </div>

                      {contact.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{contact.body}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {contact.platform && (
                          <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">
                            {contact.platform}
                          </span>
                        )}
                        {contact.category && (
                          <span className="text-[10px] font-medium bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-md">
                            {contact.category}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {contact.scraped_at ? new Date(contact.scraped_at).toLocaleDateString() : 'Just added'}
                        </span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); sendToMandala(contact); }}
                            disabled={sendingToMandala === contact.id}
                            className="flex items-center gap-1 text-[10px] font-medium text-orange-600 hover:text-orange-500 transition-colors"
                            title="Send to Mandala outreach queue"
                          >
                            {sendingToMandala === contact.id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Zap size={10} />
                            )}
                            Mandala
                          </button>
                          {NEXT_STAGE[stage.key] && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); moveToStage(contact.id, NEXT_STAGE[stage.key]); }}
                              className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                              Move to {PIPELINE_STAGES.find(s => s.key === NEXT_STAGE[stage.key])?.label}
                              <ArrowRight size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
