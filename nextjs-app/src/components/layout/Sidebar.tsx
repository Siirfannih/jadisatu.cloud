'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Lightbulb, KanbanSquare, FolderKanban,
  Bot, BrainCircuit, History, Settings,
  PenTool, Compass, Moon, Sparkles,
  ChevronLeft, ChevronRight
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
  { icon: PenTool, label: 'Creative Hub', to: '/creative' },
  { icon: Lightbulb, label: 'Ideas', to: '/ideas' },
  { icon: KanbanSquare, label: 'Kanban', to: '/kanban' },
  { icon: FolderKanban, label: 'Projects', to: '/projects' },
  { type: 'divider' as const },
  { icon: Compass, label: 'Narrative Engine', to: '/narrative-engine' },
  { icon: Bot, label: 'AI Agents', to: '/agents' },
  { icon: BrainCircuit, label: 'Context Hub', to: '/context' },
  { icon: History, label: 'History', to: '/history' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside className={cn(
      'h-screen sticky top-0 flex flex-col z-20 transition-all duration-300 ease-in-out bg-white border-r border-slate-200',
      collapsed ? 'w-[72px]' : 'w-[260px]'
    )}>
      {/* Logo */}
      <div className="p-6 flex items-center justify-between relative">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg tracking-tight whitespace-nowrap text-slate-900">
              Jadisatu
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors absolute -right-3 top-7 bg-white border border-slate-200 shadow-sm z-30"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 no-scrollbar">
        {navItems.map((item, index) => {
          if ('type' in item && item.type === 'divider') {
            return <div key={index} className="my-2 mx-2 border-t border-slate-100" />
          }
          const Icon = item.icon!
          const active = pathname === item.to
          return (
            <Link
              key={item.to}
              href={item.to!}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative',
                active
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 shrink-0',
                active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
              )} />
              {!collapsed && <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-white text-slate-900 text-xs rounded border border-slate-200 shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {/* Bottom: Dark Mode toggle + Settings */}
      <div className="p-3 mt-auto border-t border-slate-100 space-y-1">
        <a
          href="/dashboard.html"
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 group',
            collapsed && 'justify-center px-2'
          )}
        >
          <Moon className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-slate-600" />
          {!collapsed && <span className="font-medium text-sm whitespace-nowrap">Dark Mode</span>}
        </a>
        <Link
          href="/settings"
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 group',
            collapsed && 'justify-center px-2'
          )}
        >
          <Settings className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-slate-600" />
          {!collapsed && <span className="font-medium text-sm whitespace-nowrap">Settings</span>}
        </Link>
      </div>
    </aside>
  )
}
