'use client'

import { useEffect, useState } from 'react'
import { GitBranch } from 'lucide-react'
import CockpitPipeline from '@/components/mandala/CockpitPipeline'
import type { MandalaStats } from '@/components/mandala/types'

export default function PipelinePage() {
  const [stats, setStats] = useState<MandalaStats | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/mandala/stats')
        if (res.ok) setStats(await res.json())
      } catch (err) {
        console.error('Failed to load pipeline stats:', err)
      }
    }
    load()
  }, [])

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-6" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationFillMode: 'both' }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <GitBranch className="w-7 h-7" style={{ color: '#0060E1' }} />
          Sales Pipeline
        </h1>
        <p className="text-sm text-slate-400 mt-1">Lead temperature & conversion stages</p>
      </div>
      <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.1s', animationFillMode: 'both' }}>
        <CockpitPipeline stats={stats} />
      </div>
    </div>
  )
}
