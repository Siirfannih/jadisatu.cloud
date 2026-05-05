'use client'

import { BookOpen } from 'lucide-react'
import CockpitKnowledge from '@/components/mandala/CockpitKnowledge'

export default function KnowledgePage() {
  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-6" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationFillMode: 'both' }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <BookOpen className="w-7 h-7" style={{ color: '#0060E1' }} />
          Pengetahuan
        </h1>
        <p className="text-sm text-slate-400 mt-1">Database pengetahuan untuk AI Mandala</p>
      </div>
      <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.1s', animationFillMode: 'both' }}>
        <CockpitKnowledge />
      </div>
    </div>
  )
}
