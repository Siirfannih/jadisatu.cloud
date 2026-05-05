'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Bot, Settings,
  PenTool, Sparkles,
  ChevronLeft, ChevronRight, LogOut,
  BarChart3
} from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

type SidebarProps = {
  isMobile?: boolean
  mobileOpen?: boolean
  onClose?: () => void
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
  { icon: Bot, label: 'Mandala', to: '/mandala', accent: true },
  { icon: PenTool, label: 'Konten', to: '/content' },
  { icon: BarChart3, label: 'Analitik', to: '/analytics' },
  { type: 'divider' as const },
  { icon: Settings, label: 'Pengaturan', to: '/settings' },
]

export default function Sidebar({ isMobile = false, mobileOpen = false, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const showCollapse = !isMobile

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const sidebarContent = (
    <aside className={cn(
      'h-full flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out',
      isMobile ? 'w-[min(280px,85vw)]' : 'h-screen sticky top-0',
      isMobile ? '' : collapsed ? 'w-[72px]' : 'w-[260px]',
      isMobile && !mobileOpen && '-translate-x-full',
      isMobile && mobileOpen && 'translate-x-0 shadow-xl'
    )}>
      {/* Logo */}
      <div className="p-4 sm:p-6 flex items-center justify-between relative shrink-0">
        <Link href="/" className="flex items-center gap-3 overflow-hidden" onClick={isMobile ? onClose : undefined}>
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {(!collapsed || isMobile) && (
            <span className="font-semibold text-lg tracking-tight whitespace-nowrap text-slate-900">
              Jadisatu
            </span>
          )}
        </Link>
        {showCollapse && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors absolute -right-3 top-7 bg-white border border-slate-200 shadow-sm z-30"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
        {isMobile && mobileOpen && onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 ml-auto"
            aria-label="Close menu"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 no-scrollbar">
        {navItems.map((item, index) => {
          if ('type' in item && item.type === 'divider') {
            return <div key={`d${index}`} className="my-2 mx-2 border-t border-slate-200" />
          }
          if ('type' in item && item.type === 'label') {
            if (collapsed && !isMobile) return null
            return (
              <p key={`l${index}`} className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {(item as { type: 'label'; text: string }).text}
              </p>
            )
          }
          const Icon = item.icon!
          const active = pathname === item.to || (item.to !== '/' && pathname?.startsWith(item.to!))
          return (
            <Link
              key={item.to}
              href={item.to!}
              onClick={isMobile ? onClose : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative',
                active
                  ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                collapsed && !isMobile && 'justify-center px-2'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 shrink-0',
                active ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'
              )} />
              {(!collapsed || isMobile) && (
                <span className="text-sm whitespace-nowrap flex items-center gap-2">
                  {item.label}
                  {'accent' in item && item.accent && !active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                  )}
                </span>
              )}
              {collapsed && !isMobile && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-white text-slate-900 text-xs rounded border border-slate-200 shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {/* Bottom: Logout */}
      <div className="p-3 mt-auto border-t border-slate-200 space-y-1">
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group',
            collapsed && !isMobile && 'justify-center px-2'
          )}
        >
          <LogOut className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-red-500" />
          {(!collapsed || isMobile) && <span className="font-medium text-sm whitespace-nowrap">Logout</span>}
        </button>
      </div>
    </aside>
  )

  if (isMobile) {
    return (
      <>
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-20 lg:hidden transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
        <div className={cn(
          'fixed inset-y-0 left-0 z-30 lg:hidden transition-transform duration-300 ease-out',
          !mobileOpen && 'pointer-events-none'
        )}>
          {sidebarContent}
        </div>
      </>
    )
  }

  return (
    <div className="shrink-0 relative z-20">
      {sidebarContent}
    </div>
  )
}
