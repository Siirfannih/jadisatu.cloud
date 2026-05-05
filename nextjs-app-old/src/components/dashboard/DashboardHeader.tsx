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
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
        <span className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-muted hidden sm:inline-block">
          {dateStr}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border">
          {DOMAINS.map((d) => (
            <button
              key={d}
              onClick={() => onDomainFilterChange?.(d)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                domainFilter === d ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
              )}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="h-6 w-px bg-border mx-2" />
        <button className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={onMorningBriefing}
          className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
        </button>
      </div>
    </header>
  )
}
