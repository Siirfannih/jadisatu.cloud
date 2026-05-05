'use client'

import { useEffect, useState, useCallback } from 'react'
import { Send } from 'lucide-react'
import CockpitOutreach from '@/components/mandala/CockpitOutreach'
import type { Prospect } from '@/components/mandala/types'

export default function OutreachPage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [hunterQuery, setHunterQuery] = useState('')
  const [hunterRunning, setHunterRunning] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/mandala/hunter')
      if (res.ok) {
        const json = await res.json()
        const list = json.data ?? json
        setProspects(Array.isArray(list) ? list : [])
      }
    } catch (err) {
      console.error('Failed to load prospects:', err)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleRunHunter() {
    if (!hunterQuery.trim()) return
    setHunterRunning(true)
    try {
      await fetch('/api/mandala/hunter/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: hunterQuery }),
      })
      // Reload after delay to let pipeline process
      setTimeout(() => loadData(), 3000)
    } catch (err) {
      console.error('Hunter failed:', err)
    }
    setHunterRunning(false)
  }

  async function handleGenerateDraft(prospect: Prospect): Promise<string> {
    const res = await fetch('/api/mandala/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate_draft',
        prospect_id: prospect.id,
        business_name: prospect.business_name,
        phone: prospect.phone,
        address: prospect.address,
        rating: prospect.rating,
        review_count: prospect.review_count,
        website: prospect.website,
        pain_type: prospect.pain_type,
        pain_score: prospect.pain_score,
      }),
    })
    if (!res.ok) throw new Error('Failed to generate draft')
    const data = await res.json()
    return data.draft || 'Gagal generate pesan'
  }

  async function handleApproveProspect(id: string, draft: string) {
    const res = await fetch('/api/mandala/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve_and_send',
        prospect_id: id,
        message: draft,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to send')
    }
    await loadData()
  }

  async function handleRejectProspect(id: string) {
    const res = await fetch('/api/mandala/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reject',
        prospect_id: id,
      }),
    })
    if (!res.ok) throw new Error('Failed to reject')
    await loadData()
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-6" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationFillMode: 'none' }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Send className="w-7 h-7" style={{ color: '#0060E1' }} />
          Pencarian Prospek
        </h1>
        <p className="text-sm text-slate-400 mt-1">Temukan, review, dan hubungi calon klien</p>
      </div>
      <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.1s', animationFillMode: 'none' }}>
        <CockpitOutreach
          prospects={prospects}
          hunterQuery={hunterQuery}
          hunterRunning={hunterRunning}
          onQueryChange={setHunterQuery}
          onRunHunter={handleRunHunter}
          onApproveProspect={handleApproveProspect}
          onRejectProspect={handleRejectProspect}
          onGenerateDraft={handleGenerateDraft}
        />
      </div>
    </div>
  )
}
