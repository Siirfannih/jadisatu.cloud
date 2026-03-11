'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Plus, Search, X, Save,
  Youtube, Twitter, Instagram, Video, Globe, Linkedin,
  FileText, ArrowRight, ChevronRight, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContentItem {
  id: string
  title: string
  script: string
  caption: string
  platform: string
  status: string
  publish_date: string | null
  thumbnail: string
  image_assets: string[]
  video_link: string
  carousel_assets: unknown[]
  project_id: string | null
  created_at: string
  updated_at: string
}

const STATUS_FLOW = ['idea', 'draft', 'script', 'ready', 'published'] as const
const PLATFORM_OPTIONS = ['instagram', 'tiktok', 'youtube', 'linkedin', 'twitter'] as const

const PIPELINE_STAGES = [
  { key: 'idea', label: 'Idea', emoji: '💡', color: 'border-yellow-400/40 bg-yellow-50/50 dark:bg-yellow-500/5' },
  { key: 'draft', label: 'Draft', emoji: '📝', color: 'border-blue-400/40 bg-blue-50/50 dark:bg-blue-500/5' },
  { key: 'script', label: 'Script', emoji: '🎬', color: 'border-purple-400/40 bg-purple-50/50 dark:bg-purple-500/5' },
  { key: 'ready', label: 'Ready', emoji: '🚀', color: 'border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-500/5' },
  { key: 'published', label: 'Published', emoji: '✨', color: 'border-pink-400/40 bg-pink-50/50 dark:bg-pink-500/5' },
]

const NEXT_STAGE: Record<string, string> = {
  idea: 'draft',
  draft: 'script',
  script: 'ready',
  ready: 'published',
}

const PLATFORM_META: Record<string, { Icon: React.ComponentType<{ className?: string; size?: number }>; color: string; bgColor: string; label: string }> = {
  instagram: { Icon: Instagram, color: 'text-pink-500', bgColor: 'bg-pink-50 dark:bg-pink-500/10', label: 'IG' },
  tiktok: { Icon: Video, color: 'text-foreground', bgColor: 'bg-muted', label: 'TikTok' },
  youtube: { Icon: Youtube, color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-500/10', label: 'YT' },
  linkedin: { Icon: Linkedin, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-500/10', label: 'LinkedIn' },
  twitter: { Icon: Twitter, color: 'text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-500/10', label: 'Twitter' },
}

export default function CreativeHub() {
  const [contents, setContents] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newContent, setNewContent] = useState({ title: '', platform: 'instagram', script: '' })
  const [creating, setCreating] = useState(false)

  const loadContents = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/light/api/contents')
    if (res.ok) {
      const data = await res.json()
      setContents(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadContents()
  }, [loadContents])

  async function moveToStage(id: string, newStatus: string) {
    await fetch('/light/api/contents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    setContents(prev =>
      prev.map(c => c.id === id ? { ...c, status: newStatus } : c)
    )
  }

  async function createContent() {
    if (!newContent.title.trim()) return
    setCreating(true)
    const res = await fetch('/light/api/contents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newContent.title,
        platform: newContent.platform,
        script: newContent.script,
        status: 'idea',
      }),
    })
    if (res.ok) {
      setNewContent({ title: '', platform: 'instagram', script: '' })
      setShowCreateForm(false)
      await loadContents()
    }
    setCreating(false)
  }

  async function deleteContent(id: string) {
    if (!confirm('Delete this content?')) return
    await fetch(`/light/api/contents?id=${id}`, { method: 'DELETE' })
    setContents(prev => prev.filter(c => c.id !== id))
  }

  const filtered = contents.filter(c =>
    !searchQuery ||
    c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.script?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function getStageContents(stageKey: string) {
    return filtered.filter(c => c.status === stageKey)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">🎨 Creative Studio</h1>
            <p className="text-muted-foreground text-sm">
              Your content pipeline — from spark to publish
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm text-sm"
            >
              <Plus className="w-4 h-4" />
              New Content
            </button>
          </div>
        </div>

        {/* Pipeline summary */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-2.5 shadow-sm w-fit">
          {PIPELINE_STAGES.map((stage, i) => {
            const count = getStageContents(stage.key).length
            return (
              <div key={stage.key} className="flex items-center">
                <div className="flex items-center gap-1.5 px-2 py-0.5">
                  <span className="text-sm">{stage.emoji}</span>
                  <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
                  <span className="text-xs font-bold text-foreground">{count}</span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <ChevronRight size={12} className="text-muted-foreground/40 mx-0.5" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Create Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">✨ New Content Idea</h2>
              <button onClick={() => setShowCreateForm(false)} className="p-1 hover:bg-muted rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Content title *"
                value={newContent.title}
                onChange={e => setNewContent(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Platform</label>
                <div className="flex gap-2">
                  {PLATFORM_OPTIONS.map(p => {
                    const meta = PLATFORM_META[p]
                    return (
                      <button
                        key={p}
                        onClick={() => setNewContent(prev => ({ ...prev, platform: p }))}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                          newContent.platform === p
                            ? cn(meta.bgColor, meta.color, 'border-2 border-current')
                            : 'bg-muted border border-border text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        <meta.Icon className="w-3.5 h-3.5" />
                        <span className="text-xs">{meta.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <textarea
                placeholder="Script or notes (optional)"
                value={newContent.script}
                onChange={e => setNewContent(p => ({ ...p, script: e.target.value }))}
                rows={4}
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <button
                onClick={createContent}
                disabled={!newContent.title.trim() || creating}
                className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Add to Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Pipeline */}
      <div className="flex-1 flex gap-4 overflow-x-auto px-8 pb-8 min-h-0">
        {PIPELINE_STAGES.map(stage => {
          const stageContents = getStageContents(stage.key)
          return (
            <div
              key={stage.key}
              className={cn(
                'flex-1 min-w-[240px] flex flex-col rounded-3xl border-2 overflow-hidden',
                stage.color
              )}
            >
              {/* Column Header */}
              <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{stage.emoji}</span>
                  <h3 className="font-semibold text-sm">{stage.label}</h3>
                  <span className="bg-foreground/10 text-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {stageContents.length}
                  </span>
                </div>
                {stage.key === 'idea' && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="bg-card border border-border rounded-2xl p-3.5 animate-pulse">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : stageContents.length === 0 ? (
                  <div className="text-center py-8 px-3">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground/60">
                      {stage.key === 'idea'
                        ? 'Your creative pipeline is ready — drop an idea in! 🌟'
                        : `Move content here when it reaches ${stage.label.toLowerCase()} stage`}
                    </p>
                  </div>
                ) : (
                  stageContents.map(item => {
                    const platform = PLATFORM_META[item.platform] || { Icon: Globe, color: 'text-muted-foreground', bgColor: 'bg-muted', label: item.platform || 'Other' }
                    return (
                      <div
                        key={item.id}
                        className="bg-card border border-border rounded-2xl p-3.5 hover:shadow-md hover:border-primary/20 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-sm line-clamp-2">{item.title}</h4>
                          <button
                            onClick={() => deleteContent(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded text-red-400 hover:text-red-600 transition-all shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {/* Platform badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn(
                            'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md',
                            platform.bgColor, platform.color
                          )}>
                            <platform.Icon className="w-3 h-3" />
                            {platform.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {item.script && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.script}</p>
                        )}

                        {/* Move button */}
                        {NEXT_STAGE[stage.key] && (
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => moveToStage(item.id, NEXT_STAGE[stage.key])}
                              className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              Move to {PIPELINE_STAGES.find(s => s.key === NEXT_STAGE[stage.key])?.label}
                              <ArrowRight size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
