'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ListTodo } from 'lucide-react'
import CockpitTasks from '@/components/mandala/CockpitTasks'
import type { MandalaStats, Conversation } from '@/components/mandala/types'

export default function TasksPage() {
  const router = useRouter()
  const [stats, setStats] = useState<MandalaStats | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, convoRes] = await Promise.all([
          fetch('/api/mandala/stats'),
          fetch('/api/mandala/conversations'),
        ])
        if (statsRes.ok) setStats(await statsRes.json())
        if (convoRes.ok) {
          const data = await convoRes.json()
          setConversations(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Failed to load tasks data:', err)
      }
    }
    load()
  }, [])

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-6" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationFillMode: 'both' }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <ListTodo className="w-7 h-7" style={{ color: '#0060E1' }} />
          Tugas AI
        </h1>
        <p className="text-sm text-slate-400 mt-1">Delegasikan dan kelola tugas untuk Mandala</p>
      </div>
      <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.1s', animationFillMode: 'both' }}>
        <CockpitTasks
          stats={stats}
          conversations={conversations}
          onNavigate={(section) => router.push(`/mandala/${section}`)}
        />
      </div>
    </div>
  )
}
