'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Target, FolderKanban, Columns, NotebookPen, Users,
  Bot, LineChart, Settings, Command, Menu, X
} from 'lucide-react'

type ViewId = 'overview' | 'focus' | 'domains' | 'kanban' | 'notes' | 'crm' | 'agents' | 'history' | 'projects'

type Props = {
  currentView: ViewId
  onSelectView: (view: ViewId) => void
  focusCount?: number
  crmCount?: number
  agentsOnline?: number
}

export default function DashboardSidebar({ currentView, onSelectView, focusCount = 3, crmCount = 12, agentsOnline = 2 }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const navClass = (view: ViewId) =>
    cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all w-full',
      currentView === view ? 'bg-white/5 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
    )

  return (
    <aside className={cn('glass-strong flex flex-col shrink-0 z-20 transition-all duration-300', collapsed ? 'w-16' : 'w-64')}>
      {/* Profile Header - match HTML */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-personal to-personal-dark flex items-center justify-center text-white font-bold text-lg">
            IF
          </div>
          {!collapsed && (
            <div>
              <div className="font-semibold text-white">Irfan</div>
              <div className="text-xs text-gray-400">Solo Founder</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                <span>Life Balance</span>
                <span className="text-white">78%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-work w-[40%]" />
                <div className="h-full bg-learn w-[25%]" />
                <div className="h-full bg-business w-[35%]" />
              </div>
              <div className="flex gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-work-light"><div className="w-1.5 h-1.5 rounded-full bg-work" />Work</span>
                <span className="flex items-center gap-1 text-learn-light"><div className="w-1.5 h-1.5 rounded-full bg-learn" />Learn</span>
                <span className="flex items-center gap-1 text-business-light"><div className="w-1.5 h-1.5 rounded-full bg-business" />Business</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll py-4 px-3 space-y-1">
        {!collapsed && <div className="px-3 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Dashboard</div>}
        <button onClick={() => onSelectView('overview')} className={navClass('overview')}>
          <LayoutDashboard className="w-4 h-4 text-accent shrink-0" />
          {!collapsed && <span>Overview</span>}
        </button>
        <button onClick={() => onSelectView('focus')} className={navClass('focus')}>
          <Target className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Today&apos;s Focus</span>
              <span className="bg-accent/20 text-accent text-[10px] px-2 py-0.5 rounded-full">{focusCount}</span>
            </>
          )}
        </button>

        {!collapsed && <div className="mt-6 px-3 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Domains</div>}
        <button onClick={() => onSelectView('domains')} className={navClass('domains')}>
          <div className="w-2 h-2 rounded-full bg-work shrink-0" />
          {!collapsed && <><span className="flex-1 text-left">Work & Career</span><span className="text-[10px] text-gray-600">Ojek</span></>}
        </button>
        <button onClick={() => onSelectView('domains')} className={navClass('domains')}>
          <div className="w-2 h-2 rounded-full bg-learn shrink-0" />
          {!collapsed && <><span className="flex-1 text-left">Learning</span><span className="text-[10px] text-gray-600">Kuliah</span></>}
        </button>
        <button onClick={() => onSelectView('domains')} className={navClass('domains')}>
          <div className="w-2 h-2 rounded-full bg-business shrink-0" />
          {!collapsed && <><span className="flex-1 text-left">Business</span><span className="text-[10px] text-gray-600">JadiSatu</span></>}
        </button>

        {!collapsed && <div className="mt-6 px-3 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Workspace</div>}
        <button onClick={() => onSelectView('projects')} className={navClass('projects')}>
          <FolderKanban className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Projects</span>}
        </button>
        <button onClick={() => onSelectView('kanban')} className={navClass('kanban')}>
          <Columns className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Kanban Board</span>}
        </button>
        <button onClick={() => onSelectView('notes')} className={navClass('notes')}>
          <NotebookPen className="w-4 h-4 shrink-0" />
          {!collapsed && <><span className="flex-1 text-left">Notes & Ideas</span><span className="text-[10px] text-gray-600">Notion-style</span></>}
        </button>
        <button onClick={() => onSelectView('crm')} className={navClass('crm')}>
          <Users className="w-4 h-4 shrink-0" />
          {!collapsed && <><span className="flex-1 text-left">CRM</span><span className="bg-business/20 text-business-light text-[10px] px-2 py-0.5 rounded-full">{crmCount}</span></>}
        </button>

        {!collapsed && <div className="mt-6 px-3 mb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">System</div>}
        <button onClick={() => onSelectView('agents')} className={navClass('agents')}>
          <Bot className="w-4 h-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">AI Agents</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] text-success">{agentsOnline}</span>
              </span>
            </>
          )}
        </button>
        <button onClick={() => onSelectView('history')} className={navClass('history')}>
          <LineChart className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Progress & History</span>}
        </button>
      </div>

      <div className="p-4 border-t border-white/5 space-y-2">
        <button className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-400 hover:text-white transition-all', collapsed && 'justify-center')}>
          <Command className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && <><span>Command Menu</span><span className="ml-auto text-[10px] opacity-50">⌘K</span></>}
        </button>
      </div>
    </aside>
  )
}
