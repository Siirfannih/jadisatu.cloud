'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  BookOpen, Plus, Pencil, Trash2, Save, X,
  ChevronLeft, Filter, Search
} from 'lucide-react'
import Link from 'next/link'

interface KnowledgeEntry {
  id: string
  title: string
  content: string
  category: string
  active: boolean
  priority: number
  tags: string[]
  created_at: string
  updated_at: string
}

const CATEGORIES = [
  { key: 'product', label: 'Product', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'faq', label: 'FAQ', color: 'bg-green-50 text-green-700 border-green-200' },
  { key: 'competitor', label: 'Competitor', color: 'bg-red-50 text-red-700 border-red-200' },
  { key: 'process', label: 'Process', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'general', label: 'General', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { key: 'custom', label: 'Custom', color: 'bg-amber-50 text-amber-700 border-amber-200' },
]

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('general')
  const [formActive, setFormActive] = useState(true)
  const [formPriority, setFormPriority] = useState(0)

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterCategory) params.set('category', filterCategory)
      const res = await fetch(`/api/mandala/knowledge?${params}`)
      if (res.status === 403) { setForbidden(true); return }
      const json = await res.json()
      setEntries(json.data || [])
    } catch (err) {
      console.error('Failed to fetch knowledge:', err)
    }
  }, [filterCategory])

  useEffect(() => {
    setLoading(true)
    fetchEntries().finally(() => setLoading(false))
  }, [fetchEntries])

  const startCreate = () => {
    setEditing(null)
    setCreating(true)
    setFormTitle('')
    setFormContent('')
    setFormCategory('general')
    setFormActive(true)
    setFormPriority(0)
  }

  const startEdit = (entry: KnowledgeEntry) => {
    setCreating(false)
    setEditing(entry)
    setFormTitle(entry.title)
    setFormContent(entry.content)
    setFormCategory(entry.category)
    setFormActive(entry.active)
    setFormPriority(entry.priority)
  }

  const cancelForm = () => {
    setEditing(null)
    setCreating(false)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) return
    setSaving(true)
    try {
      await fetch('/api/mandala/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          title: formTitle.trim(),
          content: formContent.trim(),
          category: formCategory,
          active: formActive,
          priority: formPriority,
        }),
      })
      cancelForm()
      await fetchEntries()
    } catch (err) {
      console.error('Save failed:', err)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this knowledge entry?')) return
    try {
      await fetch(`/api/mandala/knowledge?id=${id}`, { method: 'DELETE' })
      await fetchEntries()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const filtered = entries.filter((e) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q)
    }
    return true
  })

  if (forbidden) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Knowledge base is only available for the owner account.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/mandala" className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-500" />
              Knowledge Base
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage what Mandala knows — products, FAQ, competitors, processes
            </p>
          </div>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Knowledge
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(creating || editing) && (
        <div className="bg-card border-2 border-blue-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{editing ? 'Edit Knowledge' : 'New Knowledge Entry'}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Product pricing tiers"
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Content (Markdown)</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={10}
                placeholder="Write knowledge content in markdown format. This will be injected into Mandala's context when relevant."
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <input
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="rounded"
                  />
                  Active (injected into context)
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={cancelForm} className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formTitle.trim() || !formContent.trim()}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse h-32" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No knowledge entries yet.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Add product info, FAQ, or competitor analysis for Mandala to use.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const cat = CATEGORIES.find((c) => c.key === entry.category) || CATEGORIES[4]
            return (
              <div
                key={entry.id}
                className={cn(
                  "bg-card border rounded-xl p-5 shadow-sm transition-colors",
                  entry.active ? "border-border" : "border-border opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{entry.title}</h3>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", cat.color)}>
                        {cat.label}
                      </span>
                      {!entry.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                      {entry.content.slice(0, 200)}{entry.content.length > 200 ? '...' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      Updated {new Date(entry.updated_at).toLocaleDateString('id-ID')}
                      {entry.priority > 0 && ` · Priority ${entry.priority}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(entry)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
