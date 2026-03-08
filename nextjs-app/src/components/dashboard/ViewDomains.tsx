'use client'

import { useState, useEffect } from 'react'
import { FolderPlus, FolderOpen, Briefcase, GraduationCap, TrendingUp, Heart, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Briefcase,
  GraduationCap,
  TrendingUp,
  Heart,
}

type Domain = {
  id: string
  name: string
  display_name: string
  icon?: string
  color?: string
  total_tasks?: number
  progress_percentage?: number
}

export default function ViewDomains() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newColor, setNewColor] = useState('work')

  useEffect(() => {
    loadDomains()
  }, [])

  async function loadDomains() {
    setLoading(true)
    try {
      const res = await fetch('/api/domains')
      if (res.ok) {
        const data = await res.json()
        setDomains(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newDisplayName.trim()) return
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim().toLowerCase().replace(/\s+/g, '_'),
          display_name: newDisplayName.trim(),
          color: newColor,
          icon: newColor === 'work' ? 'Briefcase' : newColor === 'learn' ? 'GraduationCap' : newColor === 'business' ? 'TrendingUp' : 'Heart',
        }),
      })
      if (res.ok) {
        setNewName('')
        setNewDisplayName('')
        setShowAdd(false)
        loadDomains()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const colorClasses: Record<string, string> = {
    work: 'bg-work/20 text-work-light border-work/30',
    learn: 'bg-learn/20 text-learn-light border-learn/30',
    business: 'bg-business/20 text-business-light border-business/30',
    personal: 'bg-personal/20 text-personal-light border-personal/30',
    blue: 'bg-work/20 text-work-light border-work/30',
    purple: 'bg-learn/20 text-learn-light border-learn/30',
    green: 'bg-business/20 text-business-light border-business/30',
    pink: 'bg-personal/20 text-personal-light border-personal/30',
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Domains</h2>
          <p className="text-sm text-gray-500">Folder view. Add domains/projects manually.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-medium"
        >
          <Plus size={18} />
          Add domain
        </button>
      </div>

      {showAdd && (
        <div className="glass-strong rounded-2xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">New domain / project</h3>
            <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-white/10 text-gray-400">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Internal name (e.g. work, learn)</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="work"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Display name</label>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Work & Career"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Color</label>
              <select
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
              >
                <option value="work">Work (blue)</option>
                <option value="learn">Learn (amber)</option>
                <option value="business">Business (green)</option>
                <option value="personal">Personal (violet)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium">
                Save
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl border border-white/20 text-gray-400 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-sm text-gray-500 col-span-full">Loading...</p>
        ) : domains.length === 0 ? (
          <p className="text-sm text-gray-500 col-span-full">No domains yet. Add one above.</p>
        ) : (
          domains.map((d) => {
            const Icon = iconMap[d.icon ?? ''] ?? FolderOpen
            const colorKey = (d.color ?? d.name).toLowerCase()
            const colorClass = colorClasses[colorKey] ?? 'bg-white/10 text-gray-400 border-white/10'
            return (
              <div
                key={d.id}
                className={cn(
                  'glass rounded-2xl p-5 hover-lift cursor-pointer border transition-all',
                  colorClass
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colorClass)}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{d.display_name}</h3>
                    <p className="text-xs text-gray-500">{d.name}</p>
                  </div>
                </div>
                {typeof d.total_tasks === 'number' && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{d.total_tasks} tasks</span>
                    {typeof d.progress_percentage === 'number' && (
                      <span className="text-gray-400">{d.progress_percentage}%</span>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
