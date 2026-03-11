'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { cn } from '@/lib/utils'
import { Search, Plus, StickyNote, Trash2, Save, Calendar, Hash, FileText, Clock } from 'lucide-react'

interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  source: string
  status: string
  created_at: string
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState('')
  const [saving, setSaving] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  useEffect(() => { loadNotes() }, [])

  async function loadNotes() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('ideas')
      .select('*')
      .eq('user_id', user.id)
      .in('source', ['quick-note', 'manual', 'note'])
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (data) setNotes(data)
    setLoading(false)
  }

  async function createNote() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('ideas')
      .insert({ title: 'Untitled Note', content: '', tags: [], source: 'quick-note', status: 'active', user_id: user.id })
      .select()
      .single()
    if (data) {
      setNotes(prev => [data, ...prev])
      setSelectedId(data.id)
      setEditTitle(data.title)
      setEditContent('')
      setEditTags('')
    }
  }

  const saveNote = useCallback(async () => {
    if (!selectedId) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const tags = editTags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)
    await supabase.from('ideas').update({
      title: editTitle,
      content: editContent,
      tags,
    }).eq('id', selectedId).eq('user_id', user.id)
    setNotes(prev => prev.map(n => n.id === selectedId ? { ...n, title: editTitle, content: editContent, tags } : n))
    setSaving(false)
  }, [selectedId, editTitle, editContent, editTags, supabase])

  // Auto-save after 1.5s of inactivity
  const scheduleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => { saveNote() }, 1500)
  }, [saveNote])

  async function deleteNote(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('ideas').update({ status: 'archived' }).eq('id', id).eq('user_id', user.id)
    if (selectedId === id) setSelectedId(null)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const selected = notes.find(n => n.id === selectedId)

  useEffect(() => {
    if (selected) {
      setEditTitle(selected.title)
      setEditContent(selected.content || '')
      setEditTags(selected.tags?.map(t => `#${t}`).join(', ') || '')
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = notes.filter(n =>
    !searchQuery ||
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const wordCount = editContent.trim() ? editContent.trim().split(/\s+/).length : 0
  const charCount = editContent.length
  const parsedTags = editTags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    })
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    })
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">📝 Notes & Ideas</h1>
            <p className="text-muted-foreground text-sm mt-1">Capture thoughts, organize with tags, build on your ideas.</p>
          </div>
          <button
            onClick={createNote}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors text-sm shadow-sm"
          >
            <Plus size={16} /> New Note
          </button>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0 px-8 pb-8">
        {/* Left Panel — Note List */}
        <div className="w-72 xl:w-80 flex flex-col bg-card rounded-3xl border border-border shadow-sm overflow-hidden shrink-0">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border-none text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">{notes.length} notes</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="space-y-3 p-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="rounded-2xl p-3 space-y-2">
                    <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-full bg-muted animate-pulse rounded" />
                    <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <StickyNote className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {searchQuery ? 'No matching notes' : 'Your ideas notebook is empty'}
                </p>
                <p className="text-xs text-muted-foreground/60 mb-3">
                  {searchQuery ? 'Try a different search' : 'Start capturing thoughts!'}
                </p>
                {!searchQuery && (
                  <button onClick={createNote} className="text-primary hover:text-primary/80 text-xs font-medium">
                    + Create your first note
                  </button>
                )}
              </div>
            ) : (
              filtered.map(note => (
                <div
                  key={note.id}
                  onClick={() => setSelectedId(note.id)}
                  className={cn(
                    'group p-3 rounded-2xl cursor-pointer transition-all',
                    selectedId === note.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted border border-transparent'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={cn(
                      'font-semibold text-sm line-clamp-1',
                      selectedId === note.id ? 'text-primary' : 'text-foreground'
                    )}>
                      {note.title}
                    </h3>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNote(note.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-500/10 rounded text-red-400 hover:text-red-600 transition-all shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {note.content && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{note.content}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-1 flex-wrap">
                      {note.tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                      {(note.tags?.length || 0) > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{note.tags.length - 2}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {timeAgo(note.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center Panel — Editor */}
        <div className="flex-1 bg-card rounded-3xl border border-border shadow-sm flex flex-col overflow-hidden min-w-0">
          {selected ? (
            <>
              <div className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock size={12} />
                  <span>{timeAgo(selected.created_at)}</span>
                  {saving && <span className="text-primary ml-2">Saving...</span>}
                </div>
                <button
                  onClick={saveNote}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-white text-sm rounded-lg transition-colors font-medium"
                >
                  <Save size={14} /> Save
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-2xl mx-auto">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => { setEditTitle(e.target.value); scheduleAutoSave() }}
                    placeholder="Note title..."
                    className="w-full text-3xl font-bold text-foreground border-none focus:outline-none p-0 mb-4 bg-transparent placeholder-muted-foreground/40"
                  />
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => { setEditTags(e.target.value); scheduleAutoSave() }}
                    placeholder="#tag1, #tag2, #tag3"
                    className="w-full text-sm text-muted-foreground border-none focus:outline-none p-0 mb-6 bg-transparent placeholder-muted-foreground/40"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => { setEditContent(e.target.value); scheduleAutoSave() }}
                    placeholder="Start writing your ideas..."
                    className="w-full min-h-[400px] bg-transparent text-foreground text-base leading-relaxed outline-none resize-none placeholder-muted-foreground/40"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <StickyNote className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <p className="text-lg font-semibold text-foreground mb-1">Select or create a note</p>
                <p className="text-sm text-muted-foreground mb-5">Your ideas notebook is empty — start capturing thoughts!</p>
                <button
                  onClick={createNote}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl transition-colors text-sm font-medium"
                >
                  <Plus size={16} /> New Note
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel — Metadata */}
        <div className="w-64 xl:w-72 bg-card rounded-3xl border border-border shadow-sm overflow-hidden shrink-0 hidden lg:flex flex-col">
          {selected ? (
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 border-b border-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Note Info</h3>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-sm font-medium text-foreground">{formatDate(selected.created_at)}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(selected.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileText size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Statistics</p>
                      <p className="text-sm font-medium text-foreground">{wordCount} words</p>
                      <p className="text-xs text-muted-foreground">{charCount} characters</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Hash size={14} className="text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</h3>
                </div>
                {parsedTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {parsedTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/60">No tags — add them in the editor above</p>
                )}
              </div>

              <div className="p-5 border-t border-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => deleteNote(selected.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete Note
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-5">
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">Select a note to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
