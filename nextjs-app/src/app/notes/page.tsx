'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { cn } from '@/lib/utils'
import { Search, Plus, StickyNote, Trash2, X } from 'lucide-react'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTags, setEditTags] = useState('')
  const supabase = createClient()

  useEffect(() => { loadNotes() }, [])

  async function loadNotes() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('ideas')
      .select('*')
      .eq('user_id', user.id)
      .in('source', ['quick-note', 'manual', 'note'])
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (data) setNotes(data)
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
      setNotes([data, ...notes])
      setSelectedId(data.id)
      setEditTitle(data.title)
      setEditContent('')
      setEditTags('')
    }
  }

  async function saveNote() {
    if (!selectedId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const tags = editTags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)
    await supabase.from('ideas').update({
      title: editTitle,
      content: editContent,
      tags,
    }).eq('id', selectedId).eq('user_id', user.id)
    loadNotes()
  }

  async function deleteNote(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('ideas').update({ status: 'archived' }).eq('id', id).eq('user_id', user.id)
    if (selectedId === id) {
      setSelectedId(null)
    }
    setNotes(notes.filter(n => n.id !== id))
  }

  const selected = notes.find(n => n.id === selectedId)

  useEffect(() => {
    if (selected) {
      setEditTitle(selected.title)
      setEditContent(selected.content || '')
      setEditTags(selected.tags?.map(t => `#${t}`).join(', ') || '')
    }
  }, [selectedId])

  const filtered = notes.filter(n =>
    !searchQuery ||
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
            <p className="text-muted-foreground text-sm">Quick notes and thoughts. Use #tags to organize.</p>
          </div>
          <button
            onClick={createNote}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors text-sm"
          >
            <Plus size={16} /> New Note
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden min-h-0 px-8 pb-8">
        {/* Notes List */}
        <div className="w-80 flex flex-col bg-card rounded-3xl border border-border shadow-sm overflow-hidden shrink-0">
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
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <StickyNote className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground mb-1">No notes yet</p>
                <button onClick={createNote} className="text-primary hover:text-primary/80 text-xs font-medium">
                  + Create note
                </button>
              </div>
            ) : (
              filtered.map(note => (
                <div
                  key={note.id}
                  onClick={() => setSelectedId(note.id)}
                  className={cn(
                    'group p-3 rounded-2xl cursor-pointer transition-colors',
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
                    <div className="flex gap-1">
                      {note.tags?.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(note.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 bg-card rounded-3xl border border-border shadow-sm flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {new Date(selected.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <button
                  onClick={saveNote}
                  className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white text-sm rounded-lg transition-colors font-medium"
                >
                  Save
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-2xl mx-auto">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Note title..."
                    className="w-full text-3xl font-bold text-foreground border-none focus:outline-none p-0 mb-4 bg-transparent placeholder-muted-foreground/40"
                  />
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="#tag1, #tag2, #tag3"
                    className="w-full text-sm text-muted-foreground border-none focus:outline-none p-0 mb-6 bg-transparent placeholder-muted-foreground/40"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Start writing..."
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
                <p className="text-sm text-muted-foreground mb-5">Your thoughts, captured instantly</p>
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
      </div>
    </div>
  )
}
