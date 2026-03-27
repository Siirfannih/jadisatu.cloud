'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { BookOpen, FileText, Briefcase, HelpCircle, Swords, Wrench } from 'lucide-react'
import type { KnowledgeFile } from './types'

const CATEGORY_CONFIG: Record<string, { icon: typeof BookOpen; color: string; bg: string }> = {
  knowledge: { icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
  'skill/sales': { icon: Briefcase, color: 'text-green-600', bg: 'bg-green-50' },
  'skill/conversation': { icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
  'skill/admin': { icon: Wrench, color: 'text-slate-600', bg: 'bg-slate-50' },
}

function getCategoryConfig(cat: string) {
  return CATEGORY_CONFIG[cat] || { icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50' }
}

export default function CockpitKnowledge() {
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/mandala/knowledge')
      .then(res => res.ok ? res.json() : { data: [] })
      .then(json => setFiles(json.data || []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse h-20" />
        ))}
      </div>
    )
  }

  const grouped = files.reduce<Record<string, KnowledgeFile[]>>((acc, file) => {
    const cat = file.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(file)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {files.length} knowledge {files.length === 1 ? 'file' : 'files'} loaded from Mandala runtime
      </p>

      {Object.entries(grouped).map(([category, catFiles]) => {
        const config = getCategoryConfig(category)
        const Icon = config.icon
        return (
          <div key={category} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className={cn("p-4 border-b border-border flex items-center gap-3", config.bg)}>
              <Icon className={cn("w-5 h-5", config.color)} />
              <h3 className="font-semibold text-sm capitalize">{category.replace('skill/', 'Skills: ')}</h3>
              <span className="ml-auto text-xs text-muted-foreground">{catFiles.length} files</span>
            </div>
            <div className="divide-y divide-border">
              {catFiles.map((file) => {
                const isExpanded = expanded === `${category}/${file.name}`
                return (
                  <div key={file.name}>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : `${category}/${file.name}`)}
                      className="w-full p-4 text-left hover:bg-muted/30 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium capitalize">{file.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {file.content.length > 0 ? `${Math.ceil(file.content.length / 4)} tokens` : 'empty'}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                          {file.content || '(empty)'}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {files.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No knowledge files found.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Add markdown files to mandala/knowledge/ to populate the knowledge base.
          </p>
        </div>
      )}
    </div>
  )
}
