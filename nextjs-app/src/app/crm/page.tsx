'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Search, Users, TrendingUp, AlertTriangle, ExternalLink, Filter } from 'lucide-react'

interface Lead {
  id: string
  title: string
  body: string
  url: string
  source: string
  platform: string
  subreddit: string
  pain_score: number
  opportunity_level: string
  category: string
  status: string
  keywords_extracted: string[]
  scraped_at: string
}

interface Stats {
  total_collected: number
  today_new: number
  high_opportunity: number
  avg_pain_score: number
}

const OPP_STYLE: Record<string, string> = {
  'Very High': 'bg-red-500/10 text-red-600 dark:text-red-400',
  'High': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  'Medium': 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  'Low': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
}

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    loadStats()
    loadLeads()
  }, [filterCategory])

  async function loadStats() {
    const res = await fetch('/light/api/leads?stats=true')
    if (res.ok) {
      const data = await res.json()
      setStats(data)
      if (data.categories) {
        setCategories(Object.keys(data.categories))
      }
    }
  }

  async function loadLeads() {
    const params = new URLSearchParams({ limit: '50' })
    if (filterCategory !== 'All') params.set('category', filterCategory)
    const res = await fetch(`/light/api/leads?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLeads(data.data || [])
    }
  }

  const filtered = leads.filter(l =>
    !searchQuery ||
    l.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.category?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
        <p className="text-muted-foreground">Track leads and pain points from the Hunter Agent.</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-primary" />
              <p className="text-xs text-muted-foreground">Total Leads</p>
            </div>
            <p className="text-2xl font-bold">{stats.total_collected}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-green-500" />
              <p className="text-xs text-muted-foreground">Today New</p>
            </div>
            <p className="text-2xl font-bold">{stats.today_new}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-red-500" />
              <p className="text-xs text-muted-foreground">High Opportunity</p>
            </div>
            <p className="text-2xl font-bold">{stats.high_opportunity}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-purple-500" />
              <p className="text-xs text-muted-foreground">Avg Pain Score</p>
            </div>
            <p className="text-2xl font-bold">{stats.avg_pain_score}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search leads..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-card border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary">
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Leads List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-16 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No leads found</p>
          </div>
        ) : (
          filtered.map(lead => (
            <div key={lead.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-sm line-clamp-1">{lead.title}</h3>
                    {lead.url && (
                      <a href={lead.url} target="_blank" rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all shrink-0">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{lead.body}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-lg">
                      {lead.source || lead.platform}
                    </span>
                    {lead.subreddit && (
                      <span className="text-[10px] font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-lg">
                        r/{lead.subreddit}
                      </span>
                    )}
                    {lead.category && (
                      <span className="text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-lg">
                        {lead.category}
                      </span>
                    )}
                    {lead.keywords_extracted?.slice(0, 3).map(kw => (
                      <span key={kw} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={cn(
                    'text-[10px] font-bold uppercase px-2 py-1 rounded-lg',
                    OPP_STYLE[lead.opportunity_level] || OPP_STYLE.Low
                  )}>
                    {lead.opportunity_level}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-foreground">{lead.pain_score}</span>
                    <span className="text-[10px] text-muted-foreground">pain</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {lead.scraped_at ? new Date(lead.scraped_at).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
