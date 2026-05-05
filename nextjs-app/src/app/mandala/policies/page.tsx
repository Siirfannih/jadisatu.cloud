'use client'

import { Shield } from 'lucide-react'
import CockpitPolicies from '@/components/mandala/CockpitPolicies'

export default function PoliciesPage() {
  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-6" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationFillMode: 'both' }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Shield className="w-7 h-7" style={{ color: '#0060E1' }} />
          Pengaturan AI
        </h1>
        <p className="text-sm text-slate-400 mt-1">Aturan dan perilaku AI Mandala</p>
      </div>
      <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.1s', animationFillMode: 'both' }}>
        <CockpitPolicies />
      </div>
    </div>
  )
}
