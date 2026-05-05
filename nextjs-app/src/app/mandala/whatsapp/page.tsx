'use client'

import { MessageCircle } from 'lucide-react'
import CockpitWhatsApp from '@/components/mandala/CockpitWhatsApp'

export default function WhatsAppPage() {
  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-6" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationFillMode: 'both' }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <MessageCircle className="w-7 h-7" style={{ color: '#0060E1' }} />
          WhatsApp
        </h1>
        <p className="text-sm text-slate-400 mt-1">Hubungkan dan kelola koneksi WhatsApp Mandala</p>
      </div>
      <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.1s', animationFillMode: 'both' }}>
        <CockpitWhatsApp />
      </div>
    </div>
  )
}
