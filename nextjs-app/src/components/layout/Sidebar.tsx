'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Lightbulb, KanbanSquare, FolderKanban,
  Bot, BrainCircuit, History, Settings, Menu, X
} from 'lucide-react'

const navItems = [
  { icon: LayoutDashboard, label: 'Home', to: '/' },
  { icon: Lightbulb, label: 'Ideas', to: '/ideas' },
  { icon: KanbanSquare, label: 'Kanban', to: '/kanban' },
  { icon: FolderKanban, label: 'Projects', to: '/projects' },
  { type: 'divider' as const },
  { icon: Bot, label: 'Agents', to: '/agents' },
  { icon: BrainCircuit, label: 'Context Hub', to: '/context' },
  { icon: History, label: 'History', to: '/history' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside className={cn('border-r border-border bg-card flex flex-col z-20 transition-all duration-200', collapsed ? 'w-16' : 'w-60')}>
      <div className="h-14 flex items-center px-3 border-b border-border justify-between">
        {!collapsed && (
          <div className="font-bold text-lg tracking-tight flex items-center gap-2 text-primary">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white text-xs font-bold">J</div>
            JadiSatu
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 hover:bg-accent rounded-md text-muted-foreground ml-auto">
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </div>

      <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item, index) => {
          if ('type' in item && item.type === 'divider') {
            return <div key={index} className="my-2 border-t border-border/50 mx-2" />
          }
          const Icon = item.icon!
          const active = pathname === item.to
          return (
            <Link
              key={item.to}
              href={item.to!}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md transition-colors group relative',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon size={20} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-card text-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-border">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </div>

      <div className="p-2 border-t border-border">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            collapsed && 'justify-center px-2'
          )}
        >
          <Settings size={20} />
          {!collapsed && <span className="text-sm font-medium">Settings</span>}
        </Link>
      </div>
    </aside>
  )
}
