'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'
import {
  LayoutDashboard, Lightbulb, KanbanSquare, FolderKanban,
  Bot, BrainCircuit, History, Settings,
  PenTool, Compass, Moon, Sun, Sparkles,
  ChevronLeft, ChevronRight, Calendar, Target,
  CheckSquare, Users, StickyNote, LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
  { icon: Calendar, label: 'Calendar', to: '/calendar' },
  { icon: Target, label: 'Focus Mode', to: '/focus' },
  { icon: CheckSquare, label: 'Tasks', to: '/tasks' },
  { icon: KanbanSquare, label: 'Kanban', to: '/kanban' },
  { icon: FolderKanban, label: 'Projects', to: '/projects' },
  { type: 'divider' as const },
  { icon: PenTool, label: 'Creative Hub', to: '/creative' },
  { icon: Compass, label: 'Narrative Engine', to: '/narrative-engine' },
  { icon: Bot, label: 'AI Agents', to: '/agents' },
  { icon: Users, label: 'CRM', to: '/crm' },
  { icon: StickyNote, label: 'Notes', to: '/notes' },
  { type: 'divider' as const },
  { icon: History, label: 'History', to: '/history' },
  { icon: BrainCircuit, label: 'Context Hub', to: '/context' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className={cn(
      'h-screen sticky top-0 flex flex-col z-20 transition-all duration-300 ease-in-out bg-card border-r border-border',
      collapsed ? 'w-[72px]' : 'w-[260px]'
    )}>
      {/* Logo */}
      <div className="p-6 flex items-center justify-between relative">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg tracking-tight whitespace-nowrap text-foreground">
              Jadisatu
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors absolute -right-3 top-7 bg-card border border-border shadow-sm z-30"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 no-scrollbar">
        {navItems.map((item, index) => {
          if ('type' in item && item.type === 'divider') {
            return <div key={index} className="my-2 mx-2 border-t border-border" />
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
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 shrink-0',
                active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              {!collapsed && <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-card text-foreground text-xs rounded border border-border shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {/* Bottom: Theme toggle + Settings */}
      <div className="p-3 mt-auto border-t border-border space-y-1">
        <button
          onClick={toggleTheme}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 group',
            collapsed && 'justify-center px-2'
          )}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-foreground" />
          ) : (
            <Moon className="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-foreground" />
          )}
          {!collapsed && <span className="font-medium text-sm whitespace-nowrap">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <Link
          href="/settings"
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 group',
            collapsed && 'justify-center px-2'
          )}
        >
          <Settings className="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-foreground" />
          {!collapsed && <span className="font-medium text-sm whitespace-nowrap">Settings</span>}
        </Link>
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all duration-200 group',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-red-500" />
          {!collapsed && <span className="font-medium text-sm whitespace-nowrap">Logout</span>}
        </button>
      </div>
    </aside>
  )
}
