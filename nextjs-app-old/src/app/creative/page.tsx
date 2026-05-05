'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus, Search, X, Save, Trash2, Wand2, Loader2,
  Youtube, Twitter, Instagram, Video, Globe, Linkedin, BookOpen,
  ChevronRight, Sparkles, GripVertical, Calendar as CalendarIcon,
  Bold, Italic, List, ListOrdered, Link2, Type
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
  useDroppable,
} from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  hook_text?: string
  value_text?: string
  cta_text?: string
  tags?: string
}

const STATUS_FLOW = ['idea', 'draft', 'script', 'ready', 'published'] as const
const PLATFORM_OPTIONS = [
  { key: 'twitter', label: 'Twitter', Icon: Twitter, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-500/10' },
  { key: 'youtube', label: 'YouTube', Icon: Youtube, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
  { key: 'instagram', label: 'Instagram', Icon: Instagram, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/10' },
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  { key: 'tiktok', label: 'TikTok', Icon: Video, color: 'text-foreground', bg: 'bg-muted' },
  { key: 'blog', label: 'Blog', Icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
] as const

const STAGE_META: Record<string, { label: string; emoji: string; color: string }> = {
  idea: { label: 'Idea', emoji: '💡', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400' },
  draft: { label: 'Draft', emoji: '📝', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
  script: { label: 'Script', emoji: '🎬', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400' },
  ready: { label: 'Ready', emoji: '🚀', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  published: { label: 'Published', emoji: '✨', color: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400' },
}

const NEXT_STAGE: Record<string, string> = {
  idea: 'draft',
  draft: 'script',
  script: 'ready',
  ready: 'published',
}

// ── Droppable Stage Tab ──────────────────────────────
function StageDropZone({ stageKey, count, isActive, onClick, isOver }: {
  stageKey: string; count: number; isActive: boolean; onClick: () => void; isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: `stage-${stageKey}` })
  const meta = STAGE_META[stageKey]

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap',
        isActive
          ? cn(meta.color, 'shadow-sm')
          : 'text-muted-foreground hover:bg-muted',
        isOver && 'ring-2 ring-primary ring-offset-2 scale-105'
      )}
    >
      <span>{meta.emoji}</span>
      <span>{meta.label}</span>
      <span className={cn(
        'text-[10px] font-bold px-1.5 py-0.5 rounded-md',
        isActive ? 'bg-white/30 dark:bg-black/20' : 'bg-muted'
      )}>{count}</span>
    </button>
  )
}

// ── Draggable Content Card ───────────────────────────
function DraggableContentCard({ item, isSelected, onClick }: {
  item: ContentItem; isSelected: boolean; onClick: () => void
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const platform = PLATFORM_OPTIONS.find(p => p.key === item.platform)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition-all',
        isSelected
          ? 'bg-primary/5 border-primary/30 shadow-sm'
          : 'bg-card border-border hover:border-primary/20 hover:shadow-sm',
        isDragging && 'opacity-50 shadow-lg'
      )}
      onClick={onClick}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 p-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-foreground line-clamp-1 mb-1">
          {item.title || 'Untitled'}
        </h4>
        <div className="flex items-center gap-2">
          {platform && (
            <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md', platform.bg, platform.color)}>
              <platform.Icon className="w-2.5 h-2.5" />
              {platform.label}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(item.updated_at || item.created_at).toLocaleDateString()}
          </span>
        </div>
        {item.script && (
          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">{item.script}</p>
        )}
      </div>
    </div>
  )
}

// ── Drag Overlay Card ────────────────────────────────
function DragOverlayCard({ item }: { item: ContentItem }) {
  const platform = PLATFORM_OPTIONS.find(p => p.key === item.platform)
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl border border-primary/30 bg-card shadow-xl w-[260px]">
      <GripVertical size={14} className="mt-0.5 text-muted-foreground/40 shrink-0" />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-foreground line-clamp-1 mb-1">{item.title || 'Untitled'}</h4>
        {platform && (
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md', platform.bg, platform.color)}>
            <platform.Icon className="w-2.5 h-2.5" />
            {platform.label}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────
export default function CreativeStudio() {
  const [contents, setContents] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)

  // Editor state
  const [editTitle, setEditTitle] = useState('')
  const [editScript, setEditScript] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [editPlatform, setEditPlatform] = useState('instagram')
  const [editStage, setEditStage] = useState('idea')
  const [editTags, setEditTags] = useState('')
  const [editPublishDate, setEditPublishDate] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [generating, setGenerating] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const publishDateInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // ── Data fetching ──────────────────────────────────
  const loadContents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/contents')
      if (res.ok) {
        const data = await res.json()
        setContents(data)
      }
    } catch {
      // silent
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadContents()
  }, [loadContents])

  // ── Selection ──────────────────────────────────────
  const selectedItem = contents.find(c => c.id === selectedId)

  useEffect(() => {
    if (selectedItem) {
      setEditTitle(selectedItem.title || '')
      setEditScript(selectedItem.script || '')
      setEditCaption(selectedItem.caption || '')
      setEditPlatform(selectedItem.platform || 'instagram')
      setEditStage(selectedItem.status || 'idea')
      setEditTags((selectedItem as ContentItem & { tags?: string }).tags || '')
      setEditPublishDate(selectedItem.publish_date ? selectedItem.publish_date.split('T')[0] : '')
      setHasUnsavedChanges(false)
    }
  }, [selectedId, selectedItem?.updated_at])

  // ── CRUD ───────────────────────────────────────────
  async function saveContent() {
    if (!selectedId || !selectedItem) return
    setSaving(true)
    try {
      await fetch('/api/contents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedId,
          title: editTitle,
          script: editScript,
          caption: editCaption,
          platform: editPlatform,
          status: editStage,
          publish_date: editPublishDate || null,
        }),
      })
      setContents(prev => prev.map(c =>
        c.id === selectedId ? {
          ...c,
          title: editTitle,
          script: editScript,
          caption: editCaption,
          platform: editPlatform,
          status: editStage,
          publish_date: editPublishDate || null,
          updated_at: new Date().toISOString(),
        } : c
      ))
      setHasUnsavedChanges(false)
    } catch {
      // silent
    }
    setSaving(false)
  }

  async function createContent() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          platform: 'instagram',
          status: 'idea',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setContents(prev => [data, ...prev])
        setNewTitle('')
        setShowCreateForm(false)
        setSelectedId(data.id)
      }
    } catch {
      // silent
    }
    setCreating(false)
  }

  async function deleteContent(id: string) {
    if (!confirm('Delete this content?')) return
    await fetch(`/api/contents?id=${id}`, { method: 'DELETE' })
    setContents(prev => prev.filter(c => c.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
    }
  }

  async function generateScript() {
    if (!selectedItem || !editTitle.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/narrative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: editTitle,
          angle: editTitle,
          platform: editPlatform,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setEditScript(data.draft_script || '')
        setHasUnsavedChanges(true)
        // Auto-advance to script stage if currently in idea/draft
        if (editStage === 'idea' || editStage === 'draft') {
          setEditStage('script')
        }
      }
    } catch {
      // silent
    }
    setGenerating(false)
  }

  async function advanceStage() {
    if (!selectedItem || !NEXT_STAGE[editStage]) return
    const next = NEXT_STAGE[editStage]
    setEditStage(next)
    setSaving(true)
    try {
      await fetch('/api/contents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId, status: next }),
      })
      setContents(prev => prev.map(c =>
        c.id === selectedId ? { ...c, status: next, updated_at: new Date().toISOString() } : c
      ))
    } catch {
      // silent
    }
    setSaving(false)
  }

  async function moveToStage(id: string, newStatus: string) {
    await fetch('/api/contents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    setContents(prev => prev.map(c =>
      c.id === id ? { ...c, status: newStatus, updated_at: new Date().toISOString() } : c
    ))
    if (selectedId === id) {
      setEditStage(newStatus)
    }
  }

  // ── Filtering ──────────────────────────────────────
  const filtered = contents.filter(c => {
    const matchesSearch = !searchQuery ||
      c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.script?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = activeFilter === 'all' || c.status === activeFilter
    return matchesSearch && matchesFilter
  })

  function getStageCount(stage: string) {
    return contents.filter(c => c.status === stage).length
  }

  // ── Drag & Drop ────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    setDragActiveId(event.active.id as string)
  }

  function handleDragOver(event: { over: { id: string | number } | null }) {
    if (event.over) {
      const overId = String(event.over.id)
      if (overId.startsWith('stage-')) {
        setOverStage(overId.replace('stage-', ''))
      } else {
        setOverStage(null)
      }
    } else {
      setOverStage(null)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDragActiveId(null)
    setOverStage(null)

    if (!over) return
    const overId = String(over.id)

    if (overId.startsWith('stage-')) {
      const targetStage = overId.replace('stage-', '')
      const itemId = active.id as string
      const item = contents.find(c => c.id === itemId)
      if (item && item.status !== targetStage) {
        moveToStage(itemId, targetStage)
      }
    }
  }

  const dragItem = dragActiveId ? contents.find(c => c.id === dragActiveId) : null

  // ── Auto-resize textarea ───────────────────────────
  function handleEditorChange(value: string) {
    setEditScript(value)
    setHasUnsavedChanges(true)
    if (editorRef.current) {
      editorRef.current.style.height = 'auto'
      editorRef.current.style.height = editorRef.current.scrollHeight + 'px'
    }
  }

  // ── Keyboard shortcut ──────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (hasUnsavedChanges && selectedId) {
          saveContent()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasUnsavedChanges, selectedId, editTitle, editScript, editCaption, editPlatform, editStage, editPublishDate])

  // ── Render ─────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">Content Studio</h1>
              <p className="text-muted-foreground text-sm">Write, structure, and publish your content.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {selectedItem && NEXT_STAGE[editStage] && (
                <button
                  onClick={advanceStage}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  Advance <ChevronRight size={14} />
                </button>
              )}
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
              >
                <Plus size={14} />
                New Content
              </button>
            </div>
          </div>

          {/* Stage filter tabs (droppable) */}
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-2xl px-2 py-1.5 w-fit max-w-full overflow-x-auto">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                activeFilter === 'all'
                  ? 'bg-foreground/10 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              All {contents.length}
            </button>
            {STATUS_FLOW.map(stageKey => (
              <StageDropZone
                key={stageKey}
                stageKey={stageKey}
                count={getStageCount(stageKey)}
                isActive={activeFilter === stageKey}
                onClick={() => setActiveFilter(stageKey)}
                isOver={overStage === stageKey}
              />
            ))}
          </div>
        </div>

        {/* Quick Create Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
            <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold">New Content Idea</h2>
                <button onClick={() => setShowCreateForm(false)} className="p-1 hover:bg-muted rounded-lg">
                  <X size={16} />
                </button>
              </div>
              <input
                type="text"
                placeholder="What's your content idea?"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createContent()}
                autoFocus
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary mb-3"
              />
              <button
                onClick={createContent}
                disabled={!newTitle.trim() || creating}
                className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Add to Pipeline'}
              </button>
            </div>
          </div>
        )}

        {/* 3-Panel Layout */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 border-t border-border">
          {/* ── Left Panel: Content List ── */}
          <div className="w-full md:w-[300px] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-border bg-card/50 max-h-[40vh] md:max-h-none">
            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl pl-8 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-muted rounded-xl p-3 animate-pulse">
                      <div className="h-3.5 bg-muted-foreground/10 rounded w-3/4 mb-2" />
                      <div className="h-2.5 bg-muted-foreground/10 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground/60">
                    {searchQuery ? 'No matching content' : 'Start by adding your first content idea'}
                  </p>
                </div>
              ) : (
                filtered.map(item => (
                  <DraggableContentCard
                    key={item.id}
                    item={item}
                    isSelected={selectedId === item.id}
                    onClick={() => setSelectedId(item.id)}
                  />
                ))
              )}
            </div>

            {/* Item count */}
            <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
              {filtered.length} items
            </div>
          </div>

          {/* ── Middle Panel: Editor ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-[50vh] md:min-h-0">
            {selectedItem ? (
              <>
                {/* Editor toolbar */}
                <div className="shrink-0 px-6 py-2 border-b border-border flex items-center gap-1">
                  {[
                    { icon: Bold, label: 'Bold' },
                    { icon: Italic, label: 'Italic' },
                    { icon: Type, label: 'Heading' },
                    { icon: List, label: 'Bullet List' },
                    { icon: ListOrdered, label: 'Numbered List' },
                    { icon: Link2, label: 'Link' },
                  ].map(btn => (
                    <button
                      key={btn.label}
                      title={btn.label}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <btn.icon size={15} />
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button
                    onClick={generateScript}
                    disabled={generating || !editTitle.trim()}
                    className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 mr-2"
                  >
                    {generating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                    {generating ? 'Generating...' : 'Generate Script'}
                  </button>
                  <span className="text-[10px] text-muted-foreground mr-2">
                    {editScript.split(/\s+/).filter(Boolean).length} words
                  </span>
                  {hasUnsavedChanges && (
                    <button
                      onClick={saveContent}
                      disabled={saving}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <Save size={12} />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  )}
                </div>

                {/* Title + Content area */}
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-3xl mx-auto px-8 py-6">
                    <textarea
                      value={editTitle}
                      onChange={e => { setEditTitle(e.target.value); setHasUnsavedChanges(true) }}
                      onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
                      placeholder="Untitled"
                      rows={1}
                      className="w-full text-2xl font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/40 mb-4 resize-none overflow-hidden break-words"
                    />
                    <textarea
                      ref={editorRef}
                      value={editScript}
                      onChange={e => handleEditorChange(e.target.value)}
                      placeholder="Start writing your script, outline, caption, or content draft here..."
                      className="w-full min-h-[400px] text-sm text-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/40 leading-relaxed"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
                  <h3 className="text-lg font-semibold text-muted-foreground/60 mb-1">Select content to edit</h3>
                  <p className="text-sm text-muted-foreground/40">
                    Choose an item from the list or create a new one
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right Panel: Production ── */}
          {selectedItem && (
            <div className="w-full md:w-[280px] shrink-0 border-t md:border-t-0 md:border-l border-border bg-card/50 overflow-y-auto">
              <div className="p-5 space-y-5">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Production</h3>

                {/* Stage */}
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Stage</label>
                  <select
                    value={editStage}
                    onChange={e => { setEditStage(e.target.value); setHasUnsavedChanges(true) }}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    {STATUS_FLOW.map(s => (
                      <option key={s} value={s}>{STAGE_META[s].emoji} {STAGE_META[s].label}</option>
                    ))}
                  </select>
                </div>

                {/* Platform */}
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Platform</label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORM_OPTIONS.map(p => (
                      <button
                        key={p.key}
                        onClick={() => { setEditPlatform(p.key); setHasUnsavedChanges(true) }}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all',
                          editPlatform === p.key
                            ? cn(p.bg, p.color, 'ring-1 ring-current/30')
                            : 'bg-muted border border-border text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        <p.Icon size={12} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Tags</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={e => { setEditTags(e.target.value); setHasUnsavedChanges(true) }}
                    placeholder="tag1, tag2"
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Publish Date — click label or area to open date picker */}
                <div>
                  <label
                    onClick={() => publishDateInputRef.current?.showPicker?.()}
                    className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 cursor-pointer hover:text-foreground transition-colors"
                  >
                    Publish Date
                  </label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => publishDateInputRef.current?.showPicker?.()}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') publishDateInputRef.current?.showPicker?.() }}
                    className="relative flex items-center gap-2 w-full bg-muted border border-border rounded-xl pl-3 pr-3 py-2 text-xs outline-none focus-within:ring-2 focus-within:ring-primary cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <input
                      ref={publishDateInputRef}
                      type="date"
                      value={editPublishDate}
                      onChange={e => { setEditPublishDate(e.target.value); setHasUnsavedChanges(true) }}
                      className="flex-1 min-w-0 bg-transparent border-none outline-none text-foreground cursor-pointer [color-scheme:inherit]"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={saveContent}
                  disabled={saving || !hasUnsavedChanges}
                  className="w-full flex items-center justify-center gap-2 bg-foreground hover:bg-foreground/90 text-background py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
                >
                  <Save size={14} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteContent(selectedItem.id)}
                  className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 py-2 rounded-xl text-xs font-medium transition-colors"
                >
                  <Trash2 size={12} />
                  Delete Content
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {dragItem ? <DragOverlayCard item={dragItem} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
