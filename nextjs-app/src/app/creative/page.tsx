'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Plus, Search, Type, List, Image, Link2,
  Youtube, Twitter, Instagram, FileText, PenTool,
  Video, ChevronRight, Trash2, Save, Globe, Linkedin
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

interface Project {
  id: string
  name: string
}

const STATUS_OPTIONS = ['idea', 'draft', 'script', 'ready', 'published'] as const
const PLATFORM_OPTIONS = ['instagram', 'tiktok', 'youtube', 'linkedin', 'twitter'] as const

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  idea: { bg: 'bg-slate-100', text: 'text-slate-600' },
  draft: { bg: 'bg-blue-100', text: 'text-blue-700' },
  script: { bg: 'bg-purple-100', text: 'text-purple-700' },
  ready: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  published: { bg: 'bg-pink-100', text: 'text-pink-700' },
}

const PLATFORM_META: Record<string, { Icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string; label: string }> = {
  instagram: { Icon: Instagram, color: 'text-pink-500', bgColor: 'bg-pink-50', label: 'Instagram' },
  tiktok: { Icon: Video, color: 'text-slate-700', bgColor: 'bg-slate-100', label: 'TikTok' },
  youtube: { Icon: Youtube, color: 'text-red-500', bgColor: 'bg-red-50', label: 'YouTube' },
  linkedin: { Icon: Linkedin, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'LinkedIn' },
  twitter: { Icon: Twitter, color: 'text-blue-400', bgColor: 'bg-blue-50', label: 'Twitter' },
}

const PIPELINE_STAGES = [
  { key: 'idea', label: 'Idea', emoji: '\u{1F4A1}' },
  { key: 'script', label: 'Script', emoji: '\u{1F4DD}' },
  { key: 'ready', label: 'Shoot', emoji: '\u{1F3AC}' },
  { key: 'published', label: 'Publish', emoji: '\u{1F680}' },
]

export default function CreativeHub() {
  const [contents, setContents] = useState<ContentItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
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
  const [editVideoLink, setEditVideoLink] = useState('')
  const [editProjectId, setEditProjectId] = useState<string | null>(null)

  const loadContents = useCallback(async () => {
    const res = await fetch('/api/contents')
    if (res.ok) {
      const data = await res.json()
      setContents(data)
    }
  }, [])

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/projects')
    if (res.ok) {
      const data = await res.json()
      setProjects(data)
    }
  }, [])

  useEffect(() => {
    loadContents()
    loadProjects()
  }, [loadContents, loadProjects])

  const selected = contents.find(c => c.id === selectedId) || null

  useEffect(() => {
    if (selected) {
      setEditTitle(selected.title)
      setEditScript(selected.script || '')
      setEditCaption(selected.caption || '')
      setEditPlatform(selected.platform || 'instagram')
      setEditStatus(selected.status || 'idea')
      setEditPublishDate(selected.publish_date ? selected.publish_date.slice(0, 16) : '')
      setEditVideoLink(selected.video_link || '')
      setEditProjectId(selected.project_id || null)
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
        video_link: editVideoLink,
        project_id: editProjectId,
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with Pipeline */}
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">Creative Hub</h1>
            <p className="text-slate-500 text-sm">Manage ideas, scripts, and content across platforms.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Pipeline Stage Indicator */}
            <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-2 py-1.5 shadow-sm">
              {PIPELINE_STAGES.map((stage, i) => {
                const isActive = currentStageIndex >= i && selectedId
                const isCurrent = stage.key === editStatus && selectedId
                return (
                  <div key={stage.key} className="flex items-center">
                    <div
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm transition-all',
                        isCurrent
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : isActive
                            ? 'text-slate-600'
                            : 'text-slate-300'
                      )}
                    >
                      <span className="text-sm">{stage.emoji}</span>
                      <span className="hidden lg:inline text-xs font-medium">{stage.label}</span>
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && (
                      <ChevronRight size={12} className="text-slate-300 mx-0.5" />
                    )}
                  </div>
                )
              })}
            </div>
            <button
              onClick={createContent}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm text-sm"
            >
              <Plus className="w-4 h-4" />
              New Content
            </button>
          </div>
        </div>
      </div>

      {/* Main 3-Panel Layout */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-0 px-8 pb-8">
        {/* Left Panel - Content Library */}
        <div className="w-80 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {['all', ...STATUS_OPTIONS].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors capitalize',
                    filterStatus === status
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  )}
                >
                  {status === 'all' ? 'All' : status}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-500 mb-1">No content yet</p>
                <p className="text-xs text-slate-400 mb-3">Start creating your first piece</p>
                <button
                  onClick={createContent}
                  className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                >
                  + Create content
                </button>
              </div>
            ) : (
              filtered.map(item => {
                const platform = PLATFORM_META[item.platform] || { Icon: Globe, color: 'text-slate-500', bgColor: 'bg-slate-100', label: item.platform }
                const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.idea
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'group p-3 rounded-2xl cursor-pointer transition-colors flex gap-3',
                      selectedId === item.id
                        ? 'bg-blue-50 border border-blue-100'
                        : 'hover:bg-slate-50 border border-transparent'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      platform.bgColor, platform.color
                    )}>
                      <platform.Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className={cn(
                          'font-semibold text-sm line-clamp-1',
                          selectedId === item.id ? 'text-blue-900' : 'text-slate-900'
                        )}>
                          {item.title}
                        </h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteContent(item.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-all shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-medium text-slate-400">
                          {new Date(item.updated_at || item.created_at).toLocaleDateString()}
                        </span>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider',
                          statusStyle.bg, statusStyle.text
                        )}>
                          {item.status}
                        </span>
                      </div>
                      {item.script && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{item.script}</p>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Center Panel - Editor */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {selectedId && selected ? (
            <>
              <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-1">
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                    <Type className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                    <List className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-2" />
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                    <Image className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                    <Link2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-400">
                    {saving ? 'Saving...' : 'Auto-save available'}
                  </span>
                  <button
                    onClick={saveContent}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 font-medium"
                  >
                    <Save size={14} />
                    Save
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10">
                <div className="max-w-3xl mx-auto">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Content Title"
                    className="w-full text-4xl font-bold text-slate-900 border-none focus:outline-none focus:ring-0 p-0 mb-6 placeholder-slate-300 bg-transparent"
                  />

                  <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Script / Body</label>
                    <textarea
                      value={editScript}
                      onChange={(e) => setEditScript(e.target.value)}
                      placeholder="Write your script, outline, or content body here..."
                      className="w-full min-h-[300px] bg-slate-50 border border-slate-200 rounded-2xl p-5 text-base text-slate-700 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Caption</label>
                    <textarea
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      placeholder="Write your caption for social media..."
                      className="w-full min-h-[120px] bg-slate-50 border border-slate-200 rounded-2xl p-5 text-base text-slate-700 leading-relaxed outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <PenTool className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-lg font-semibold text-slate-700 mb-1">Select or create content</p>
                <p className="text-sm text-slate-400 mb-5">Choose from the library or start something new</p>
                <button
                  onClick={createContent}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-medium shadow-sm"
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
          <div className="w-72 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
            <div className="h-14 border-b border-slate-100 flex items-center px-6 shrink-0">
              <h3 className="font-semibold text-slate-900">Content Details</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                <div className="relative">
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium capitalize"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {/* Platform */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORM_OPTIONS.map(p => {
                    const meta = PLATFORM_META[p]
                    return (
                      <button
                        key={p}
                        onClick={() => setEditPlatform(p)}
                        className={cn(
                          'flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-colors',
                          editPlatform === p
                            ? cn(meta.bgColor, 'border-2 border-current', meta.color)
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        <meta.Icon className={cn('w-4 h-4', editPlatform === p ? meta.color : 'text-slate-400')} />
                        <span className="text-xs">{meta.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Project */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Project</label>
                <div className="relative">
                  <select
                    value={editProjectId || ''}
                    onChange={(e) => setEditProjectId(e.target.value || null)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="">No project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {/* Publish Date */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Publish Date</label>
                <input
                  type="datetime-local"
                  value={editPublishDate}
                  onChange={(e) => setEditPublishDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              {/* Video Link */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Video Link</label>
                <input
                  type="url"
                  value={editVideoLink}
                  onChange={(e) => setEditVideoLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              {/* Timestamps */}
              <div className="pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-400 space-y-1">
                  <p>Created: {new Date(selected.created_at).toLocaleDateString()}</p>
                  <p>Updated: {new Date(selected.updated_at || selected.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={saveContent}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
