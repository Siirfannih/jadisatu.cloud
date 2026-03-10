'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'
import {
  LayoutDashboard, Lightbulb, KanbanSquare, FolderKanban,
  Bot, BrainCircuit, History, Settings, Menu, X,
  PenTool, Compass, Sun, Moon, Sparkles,
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
  { icon: Bot, label: 'Agents', to: '/agents' },
  { icon: BrainCircuit, label: 'Context Hub', to: '/context' },
  { icon: History, label: 'History', to: '/history' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 flex flex-col z-20 transition-all duration-300 ease-in-out border-r',
        isLight
          ? 'bg-white border-slate-200'
          : 'bg-card border-border',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center justify-between relative',
        isLight ? 'p-6' : 'h-14 px-3 border-b border-border'
      )}>
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className={cn(
            'flex items-center justify-center shrink-0',
            isLight
              ? 'w-8 h-8 rounded-xl bg-blue-600'
              : 'w-6 h-6 rounded bg-primary'
          )}>
            {isLight
              ? <Sparkles className="w-5 h-5 text-white" />
              : <span className="text-white text-xs font-bold">J</span>
            }
          </div>
          {!collapsed && (
            <span className={cn(
              'font-semibold text-lg tracking-tight whitespace-nowrap',
              isLight ? 'text-slate-900' : 'text-primary'
            )}>
              {isLight ? 'Jadisatu' : 'JadiSatu'}
            </span>
          )}
        </Link>

        {/* Collapse toggle */}
        {isLight ? (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors absolute -right-3 top-7 bg-white border border-slate-200 shadow-sm z-30"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground ml-auto"
          >
            {collapsed ? <Menu size={16} /> : <X size={16} />}
          </button>
        )}
      </div>

      {/* Nav Items */}
      <div className={cn(
        'flex-1 overflow-y-auto space-y-1 no-scrollbar',
        isLight ? 'py-4 px-3' : 'py-4 px-2'
      )}>
        {navItems.map((item, index) => {
          if ('type' in item && item.type === 'divider') {
            return <div key={index} className={cn(
              'my-2 mx-2 border-t',
              isLight ? 'border-slate-100' : 'border-border/50'
            )} />
          }
          const Icon = item.icon!
          const active = pathname === item.to
          return (
            <Link
              key={item.to}
              href={item.to!}
              className={cn(
                'flex items-center gap-3 transition-all duration-200 group relative',
                isLight
                  ? cn(
                      'px-3 py-2.5 rounded-xl',
                      active
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    )
                  : cn(
                      'px-3 py-2 rounded-md',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    ),
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className={cn(
                'shrink-0',
                isLight ? 'w-5 h-5' : 'w-5 h-5',
                isLight && !active && 'text-slate-400 group-hover:text-slate-600'
              )} size={20} />
              {!collapsed && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
              {collapsed && (
                <div className={cn(
                  'absolute left-full ml-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border',
                  isLight
                    ? 'bg-white text-slate-900 border-slate-200 shadow-md'
                    : 'bg-card text-foreground border-border'
                )}>
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {/* Bottom: Theme toggle + Settings */}
      <div className={cn(
        'p-2 border-t space-y-1',
        isLight ? 'p-3 border-slate-100' : 'border-border'
      )}>
        <button
          onClick={toggleTheme}
          className={cn(
            'flex items-center gap-3 w-full transition-all duration-200',
            isLight
              ? 'px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 group'
              : 'px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
            collapsed && 'justify-center px-2'
          )}
        >
          {isLight
            ? <Moon className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-slate-600" size={20} />
            : <Sun size={20} />
          }
          {!collapsed && (
            <span className="text-sm font-medium whitespace-nowrap">
              {isLight ? 'Dark Mode' : 'Light Mode'}
            </span>
          )}
        </button>
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 transition-all duration-200',
            isLight
              ? 'px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 group'
              : 'px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
            collapsed && 'justify-center px-2'
          )}
        >
          <Settings className={cn(
            'w-5 h-5 shrink-0',
            isLight && 'text-slate-400 group-hover:text-slate-600'
          )} size={20} />
          {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Settings</span>}
        </Link>
      </div>
    </aside>
  )
}
