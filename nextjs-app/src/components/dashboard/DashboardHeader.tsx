'use client'

import { Search, Plus, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  pageTitle: string
  domainFilter?: string
  onDomainFilterChange?: (domain: string) => void
  onMorningBriefing?: () => void
}

const DOMAINS = ['All', 'Work', 'Learn', 'Business'] as const

export default function DashboardHeader({ pageTitle, domainFilter = 'All', onDomainFilterChange, onMorningBriefing }: Props) {
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <header className="h-16 glass border-b border-white/5 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">{pageTitle}</h1>
        <span className="text-xs text-gray-500 px-2 py-1 rounded-full bg-white/5 hidden sm:inline-block">
          {dateStr}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-black/30 border border-white/5">
          {DOMAINS.map((d) => (
            <button
              key={d}
              onClick={() => onDomainFilterChange?.(d)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                domainFilter === d ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="h-6 w-px bg-white/10 mx-2" />
        <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onMorningBriefing}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
        </button>
      </div>
    </header>
  )
}
