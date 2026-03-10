'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Search, MoreVertical, Type, List, Image, Link2,
  Hash, Youtube, Twitter, Instagram, FileText, PenTool,
  Video, ChevronRight, Trash2, Save, Calendar, Tag,
  Filter, Linkedin, Globe
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
  external_publish_id: string
  project_id: string | null
  created_at: string
  updated_at: string
}

const STATUS_OPTIONS = ['idea', 'draft', 'script', 'ready', 'published'] as const
const PLATFORM_OPTIONS = ['instagram', 'tiktok', 'youtube', 'linkedin', 'twitter'] as const

const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-slate-500/20 text-slate-300 dark:text-slate-300 light:text-slate-600',
  draft: 'bg-blue-500/20 text-blue-400 dark:text-blue-400 light:text-blue-600',
  script: 'bg-purple-500/20 text-purple-400 dark:text-purple-400 light:text-purple-600',
  ready: 'bg-emerald-500/20 text-emerald-400 dark:text-emerald-400 light:text-emerald-600',
  published: 'bg-pink-500/20 text-pink-400 dark:text-pink-400 light:text-pink-600',
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram size={16} />,
  tiktok: <Video size={16} />,
  youtube: <Youtube size={16} />,
  linkedin: <Linkedin size={16} />,
  twitter: <Twitter size={16} />,
}

const PIPELINE_STAGES = [
  { key: 'idea', label: 'Idea', icon: '💡' },
  { key: 'script', label: 'Script', icon: '📝' },
  { key: 'ready', label: 'Shoot', icon: '🎬' },
  { key: 'published', label: 'Publish', icon: '🚀' },
]

export default function CreativeHub() {
  const [contents, setContents] = useState<ContentItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editScript, setEditScript] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [editPlatform, setEditPlatform] = useState('instagram')
  const [editStatus, setEditStatus] = useState('idea')
  const [editPublishDate, setEditPublishDate] = useState('')

  const loadContents = useCallback(async () => {
    const res = await fetch('/api/contents')
    if (res.ok) {
      const data = await res.json()
      setContents(data)
    }
  }, [])

  useEffect(() => {
    loadContents()
  }, [loadContents])

  const selected = contents.find(c => c.id === selectedId) || null

  useEffect(() => {
    if (selected) {
      setEditTitle(selected.title)
      setEditScript(selected.script || '')
      setEditCaption(selected.caption || '')
      setEditPlatform(selected.platform || 'instagram')
      setEditStatus(selected.status || 'idea')
      setEditPublishDate(selected.publish_date ? selected.publish_date.slice(0, 16) : '')
    }
  }, [selected])

  async function createContent() {
    const res = await fetch('/api/contents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled Content' }),
    })
    if (res.ok) {
      const newItem = await res.json()
      await loadContents()
      setSelectedId(newItem.id)
    }
  }

  async function saveContent() {
    if (!selectedId) return
    setSaving(true)
    await fetch('/api/contents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedId,
        title: editTitle,
        script: editScript,
        caption: editCaption,
        platform: editPlatform,
        status: editStatus,
        publish_date: editPublishDate || null,
      }),
    })
    await loadContents()
    setSaving(false)
  }

  async function deleteContent(id: string) {
    if (!confirm('Delete this content?')) return
    await fetch(`/api/contents?id=${id}`, { method: 'DELETE' })
    if (selectedId === id) setSelectedId(null)
    await loadContents()
  }

  const filtered = contents.filter(c => {
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    const matchSearch = !searchQuery ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.script?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchStatus && matchSearch
  })

  const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.key === editStatus)

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Pipeline Stage Indicator */}
      <div className="border-b border-border/50 dark:border-white/5 px-6 py-3 flex items-center justify-between bg-card/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <PenTool size={20} className="text-primary" />
          <h1 className="text-lg font-bold">Creative Hub</h1>
        </div>
        <div className="flex items-center gap-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const isActive = currentStageIndex >= i && selectedId
            const isCurrent = stage.key === editStatus && selectedId
            return (
              <div key={stage.key} className="flex items-center">
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all',
                    isCurrent
                      ? 'bg-primary/20 text-primary font-semibold'
                      : isActive
                        ? 'text-foreground/70'
                        : 'text-muted-foreground/50'
                  )}
                >
                  <span>{stage.icon}</span>
                  <span className="hidden md:inline">{stage.label}</span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <ChevronRight size={14} className="text-muted-foreground/30 mx-1" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Content Library */}
        <div className="w-72 lg:w-80 border-r border-border/50 dark:border-white/5 flex flex-col bg-card/30 dark:bg-zinc-900/30">
          <div className="p-4 space-y-3 border-b border-border/50 dark:border-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Library</h2>
              <button
                onClick={createContent}
                className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-background/50 dark:bg-white/5 border border-border/50 dark:border-white/10 outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {['all', ...STATUS_OPTIONS].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md transition-colors capitalize',
                    filterStatus === status
                      ? 'bg-primary/20 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No content yet</p>
                <button onClick={createContent} className="mt-2 text-primary hover:underline text-xs">
                  Create your first content
                </button>
              </div>
            ) : (
              filtered.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'group p-3 rounded-xl cursor-pointer transition-all',
                    selectedId === item.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/50 dark:hover:bg-white/5 border border-transparent'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium line-clamp-1 flex-1">{item.title}</h3>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteContent(item.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded text-destructive transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded capitalize', STATUS_COLORS[item.status] || STATUS_COLORS.idea)}>
                      {item.status}
                    </span>
                    <span className="text-muted-foreground">
                      {PLATFORM_ICONS[item.platform] || <Globe size={14} />}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(item.updated_at || item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {item.script && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{item.script}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center Panel - Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedId && selected ? (
            <>
              <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <button className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground"><Type size={16} /></button>
                  <button className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground"><List size={16} /></button>
                  <button className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground"><Image size={16} /></button>
                  <button className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground"><Link2 size={16} /></button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {saving ? 'Saving...' : 'Auto-save available'}
                  </span>
                  <button
                    onClick={saveContent}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Save size={14} />
                    Save
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Content title..."
                  className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/30"
                />

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Script / Body</label>
                  <textarea
                    value={editScript}
                    onChange={(e) => setEditScript(e.target.value)}
                    placeholder="Write your script, outline, or content body here..."
                    className="w-full min-h-[300px] bg-transparent border border-border/30 dark:border-white/5 rounded-lg p-4 text-sm leading-relaxed outline-none focus:border-primary/30 resize-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Caption</label>
                  <textarea
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Write your caption for social media..."
                    className="w-full min-h-[120px] bg-transparent border border-border/30 dark:border-white/5 rounded-lg p-4 text-sm leading-relaxed outline-none focus:border-primary/30 resize-none transition-colors"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <PenTool className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium mb-1">Select or create content</p>
                <p className="text-sm">Choose from the library or create something new</p>
                <button
                  onClick={createContent}
                  className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm"
                >
                  <Plus size={16} />
                  New Content
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Metadata */}
        {selectedId && selected && (
          <div className="w-64 lg:w-72 border-l border-border/50 dark:border-white/5 overflow-y-auto bg-card/30 dark:bg-zinc-900/30 p-4 space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full bg-background/50 dark:bg-white/5 border border-border/50 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50 capitalize"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s} className="capitalize bg-card">{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Platform</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORM_OPTIONS.map(p => (
                  <button
                    key={p}
                    onClick={() => setEditPlatform(p)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors capitalize',
                      editPlatform === p
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-muted/30 dark:bg-white/5 text-muted-foreground hover:text-foreground border border-transparent'
                    )}
                  >
                    {PLATFORM_ICONS[p]}
                    <span className="text-[10px]">{p}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Publish Date</label>
              <input
                type="datetime-local"
                value={editPublishDate}
                onChange={(e) => setEditPublishDate(e.target.value)}
                className="w-full bg-background/50 dark:bg-white/5 border border-border/50 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Video Link</label>
              <input
                type="url"
                value={selected.video_link || ''}
                readOnly
                placeholder="No video link"
                className="w-full bg-background/50 dark:bg-white/5 border border-border/50 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-muted-foreground"
              />
            </div>

            <div className="pt-3 border-t border-border/50 dark:border-white/5">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Created: {new Date(selected.created_at).toLocaleDateString()}</p>
                <p>Updated: {new Date(selected.updated_at || selected.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <button
              onClick={saveContent}
              disabled={saving}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
