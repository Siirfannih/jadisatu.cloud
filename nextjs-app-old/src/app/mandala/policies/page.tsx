'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Shield, Plus, Pencil, Trash2, Save, X,
  ChevronLeft, CheckCircle2, Clock, Archive,
  ArrowUpCircle
} from 'lucide-react'
import Link from 'next/link'

interface Policy {
  id: string
  title: string
  description: string | null
  rules_prompt: string
  status: 'candidate' | 'active' | 'archived'
  source: 'manual' | 'correction' | 'briefing' | 'auto'
  priority: number
  flags: Record<string, unknown>
  promoted_at: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG = {
  candidate: { label: 'Candidate', icon: Clock, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  active: { label: 'Active', icon: CheckCircle2, color: 'bg-green-50 text-green-700 border-green-200' },
  archived: { label: 'Archived', icon: Archive, color: 'bg-slate-50 text-slate-500 border-slate-200' },
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  correction: 'From Correction',
  briefing: 'From Briefing',
  auto: 'Auto-generated',
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [editing, setEditing] = useState<Policy | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formRules, setFormRules] = useState('')
  const [formPriority, setFormPriority] = useState(0)

  const fetchPolicies = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      const res = await fetch(`/api/mandala/policies?${params}`)
      if (res.status === 403) { setForbidden(true); return }
      const json = await res.json()
      setPolicies(json.data || [])
    } catch (err) {
      console.error('Failed to fetch policies:', err)
    }
  }, [filterStatus])

  useEffect(() => {
    setLoading(true)
    fetchPolicies().finally(() => setLoading(false))
  }, [fetchPolicies])

  const startCreate = () => {
    setEditing(null)
    setCreating(true)
    setFormTitle('')
    setFormDescription('')
    setFormRules('')
    setFormPriority(0)
  }

  const startEdit = (policy: Policy) => {
    setCreating(false)
    setEditing(policy)
    setFormTitle(policy.title)
    setFormDescription(policy.description || '')
    setFormRules(policy.rules_prompt)
    setFormPriority(policy.priority)
  }

  const cancelForm = () => {
    setEditing(null)
    setCreating(false)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formRules.trim()) return
    setSaving(true)
    try {
      await fetch('/api/mandala/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          rules_prompt: formRules.trim(),
          priority: formPriority,
        }),
      })
      cancelForm()
      await fetchPolicies()
    } catch (err) {
      console.error('Save failed:', err)
    }
    setSaving(false)
  }

  const handlePromote = async (id: string) => {
    try {
      await fetch('/api/mandala/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'active' }),
      })
      await fetchPolicies()
    } catch (err) {
      console.error('Promote failed:', err)
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await fetch('/api/mandala/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'archived' }),
      })
      await fetchPolicies()
    } catch (err) {
      console.error('Archive failed:', err)
    }
  }

  const handleReactivate = async (id: string) => {
    try {
      await fetch('/api/mandala/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'candidate' }),
      })
      await fetchPolicies()
    } catch (err) {
      console.error('Reactivate failed:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this policy permanently?')) return
    try {
      await fetch(`/api/mandala/policies?id=${id}`, { method: 'DELETE' })
      await fetchPolicies()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const candidateCount = policies.filter((p) => p.status === 'candidate').length
  const activeCount = policies.filter((p) => p.status === 'active').length

  if (forbidden) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Policy management is only available for the owner account.</p>
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
              <Shield className="w-6 h-6 text-purple-500" />
              Policies
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Define rules that shape Mandala&apos;s behavior — candidate policies need promotion to take effect
            </p>
          </div>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Policy
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{candidateCount}</p>
          <p className="text-sm text-amber-600 font-medium">Candidates</p>
          <p className="text-xs text-amber-500 mt-0.5">Pending review</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{activeCount}</p>
          <p className="text-sm text-green-600 font-medium">Active</p>
          <p className="text-xs text-green-500 mt-0.5">Influencing behavior</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-500">{policies.length - candidateCount - activeCount}</p>
          <p className="text-sm text-slate-500 font-medium">Archived</p>
          <p className="text-xs text-slate-400 mt-0.5">Disabled</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
        {[
          { key: '', label: 'All' },
          { key: 'candidate', label: 'Candidates' },
          { key: 'active', label: 'Active' },
          { key: 'archived', label: 'Archived' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
              filterStatus === tab.key
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Create/Edit Form */}
      {(creating || editing) && (
        <div className="bg-card border-2 border-purple-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{editing ? 'Edit Policy' : 'New Policy'}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Never offer discounts without owner approval"
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Why this policy exists..."
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rules Prompt</label>
              <textarea
                value={formRules}
                onChange={(e) => setFormRules(e.target.value)}
                rows={6}
                placeholder="Write the behavioral rule in natural language. This text is injected directly into Mandala's system prompt.&#10;&#10;Example:&#10;- NEVER offer discounts or free trials without explicit owner approval&#10;- When customer asks about pricing, always mention the Starter plan first&#10;- If customer mentions competitor X, acknowledge their strengths but highlight our Y advantage"
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y"
              />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <input
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
                  className="w-24 px-3 py-2 rounded-lg bg-muted border border-border text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={cancelForm} className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formTitle.trim() || !formRules.trim()}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 text-sm font-medium"
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save as Candidate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Policy List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse h-28" />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No policies defined yet.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Create policies to control Mandala&apos;s behavior, or they&apos;ll be auto-generated from conversation corrections.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map((policy) => {
            const statusCfg = STATUS_CONFIG[policy.status]
            const StatusIcon = statusCfg.icon
            return (
              <div
                key={policy.id}
                className={cn(
                  "bg-card border rounded-xl p-5 shadow-sm",
                  policy.status === 'archived' ? "border-border opacity-60" : "border-border"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{policy.title}</h3>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium flex items-center gap-1", statusCfg.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {SOURCE_LABELS[policy.source] || policy.source}
                      </span>
                    </div>
                    {policy.description && (
                      <p className="text-sm text-muted-foreground mb-2">{policy.description}</p>
                    )}
                    <div className="bg-muted/50 rounded-lg p-3 text-sm font-mono text-muted-foreground whitespace-pre-wrap">
                      {policy.rules_prompt.slice(0, 200)}{policy.rules_prompt.length > 200 ? '...' : ''}
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      Created {new Date(policy.created_at).toLocaleDateString('id-ID')}
                      {policy.promoted_at && ` · Promoted ${new Date(policy.promoted_at).toLocaleDateString('id-ID')}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    {policy.status === 'candidate' && (
                      <button
                        onClick={() => handlePromote(policy.id)}
                        className="p-2 rounded-lg hover:bg-green-50 transition-colors text-green-600"
                        title="Promote to Active"
                      >
                        <ArrowUpCircle className="w-5 h-5" />
                      </button>
                    )}
                    {policy.status === 'active' && (
                      <button
                        onClick={() => handleArchive(policy.id)}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-muted-foreground"
                        title="Archive"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    {policy.status === 'archived' && (
                      <button
                        onClick={() => handleReactivate(policy.id)}
                        className="p-2 rounded-lg hover:bg-amber-50 transition-colors text-amber-600"
                        title="Reactivate as Candidate"
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(policy)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(policy.id)}
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
