'use client'

import { useState, useEffect } from 'react'
import { Settings, Wifi, BookOpen, Shield, GraduationCap, Briefcase, User, CheckCircle, AlertCircle, ChevronRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

const brand = {
  primary: '#0060E1',
  primarySoft: '#EFF6FF',
  success: '#10B981',
  warning: '#F59E0B',
}

const card = 'bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)]'

const settingsSections = [
  { id: 'whatsapp', label: 'Koneksi WhatsApp', desc: 'Hubungkan nomor WhatsApp untuk Mandala AI', icon: Wifi, href: '/mandala/whatsapp' },
  { id: 'knowledge', label: 'Database Pengetahuan', desc: 'Kelola pengetahuan yang digunakan AI', icon: BookOpen, href: '/mandala/knowledge' },
  { id: 'policies', label: 'Pengaturan AI', desc: 'Aturan dan perilaku Mandala AI', icon: Shield, href: '/mandala/policies' },
  { id: 'training', label: 'Pelatihan AI', desc: 'Review dan latih percakapan Mandala', icon: GraduationCap, href: '/mandala/conversations' },
  { id: 'business', label: 'Profil Bisnis', desc: 'Informasi bisnis untuk konteks AI', icon: Briefcase, href: '/business-profile' },
]

const integrations = [
  { name: 'Supabase', desc: 'Database utama', connected: true },
  { name: 'OpenClaw', desc: 'Platform agent AI', connected: true },
  { name: 'Google Calendar', desc: 'Sinkronisasi jadwal', connected: false },
]

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoadingUser(false)
    })
  }, [])

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const displayEmail = user?.email || '-'
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="max-w-[900px] mx-auto space-y-7 p-4 sm:p-8 pb-10">
      {/* Header */}
      <div style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationFillMode: 'both' as const }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Settings className="w-7 h-7" style={{ color: brand.primary }} />
          Pengaturan
        </h1>
        <p className="text-sm text-slate-400 mt-1">Kelola konfigurasi bisnis dan AI Anda</p>
      </div>

      {/* Quick Links */}
      <div className={card + ' p-5'} style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.1s', animationFillMode: 'both' as const }}>
        <h3 className="text-[15px] font-semibold text-slate-800 mb-4">Menu Pengaturan</h3>
        <div className="space-y-2">
          {settingsSections.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: brand.primarySoft }}>
                <section.icon className="w-5 h-5" style={{ color: brand.primary }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800">{section.label}</p>
                <p className="text-xs text-slate-400">{section.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </Link>
          ))}
        </div>
      </div>

      {/* Integrations */}
      <div className={card + ' p-5'} style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.2s', animationFillMode: 'both' as const }}>
        <h3 className="text-[15px] font-semibold text-slate-800 mb-4">Integrasi</h3>
        <div className="space-y-3">
          {integrations.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50">
              <div>
                <p className="text-[13px] font-semibold text-slate-800">{item.name}</p>
                <p className="text-xs text-slate-400">{item.desc}</p>
              </div>
              {item.connected ? (
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ backgroundColor: `${brand.success}15`, color: brand.success }}>
                  <CheckCircle className="w-3 h-3" /> Terhubung
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ backgroundColor: `${brand.warning}15`, color: brand.warning }}>
                  <AlertCircle className="w-3 h-3" /> Belum Dikonfigurasi
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Account */}
      <div className={card + ' p-5'} style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.3s', animationFillMode: 'both' as const }}>
        <h3 className="text-[15px] font-semibold text-slate-800 mb-4">Akun</h3>
        <div className="p-3.5 rounded-xl bg-slate-50">
          {loadingUser ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: brand.primary }}>
                {initial}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-800">{displayName}</p>
                <p className="text-xs text-slate-400">{displayEmail}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
