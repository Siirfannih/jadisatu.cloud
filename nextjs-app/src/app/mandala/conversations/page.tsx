'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Bot } from 'lucide-react'
import CockpitConversations from '@/components/mandala/CockpitConversations'
import type { Conversation } from '@/components/mandala/types'

const brand = { primary: '#0060E1' }

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const res = await fetch('/api/mandala/conversations')
      if (res.ok) {
        const json = await res.json()
        const list = json.data ?? json
        setConversations(Array.isArray(list) ? list : [])
      }
    } catch (err) {
      console.error('Failed to load conversations:', err)
    }
  }

  async function handleTakeover(id: string) {
    await fetch(`/api/mandala/takeover/${id}`, { method: 'POST' })
    loadData()
  }

  async function handleRelease(id: string) {
    await fetch(`/api/mandala/let-mandala/${id}`, { method: 'POST' })
    loadData()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] max-w-[1400px] mx-auto px-4 sm:px-6 pt-4">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 flex-shrink-0" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <MessageSquare className="w-6 h-6" style={{ color: brand.primary }} />
            Percakapan
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Pantau dan kelola percakapan Mandala AI dengan calon klien</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: '#0060E115', color: brand.primary }}>
          <Bot className="w-3.5 h-3.5" />
          Mandala Aktif 24/7
        </div>
      </div>
      <div className="flex-1 min-h-0 pb-4">
        <CockpitConversations
          conversations={conversations}
          onTakeover={handleTakeover}
          onRelease={handleRelease}
        />
      </div>
    </div>
  )
}
