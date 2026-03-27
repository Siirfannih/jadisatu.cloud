'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Shield, User, Crosshair, Headphones } from 'lucide-react'

interface PolicyData {
  rules: string
  identity: string
  modes: {
    sales_shadow: string
    ceo_assistant: string
  }
}

const SECTIONS = [
  { key: 'identity', label: 'Identity', icon: User, description: 'Who Mandala is and how it presents itself' },
  { key: 'rules', label: 'Behavioral Rules', icon: Shield, description: 'Core rules that govern all interactions' },
  { key: 'sales_shadow', label: 'Sales Shadow Mode', icon: Crosshair, description: 'Invisible AI handling customer messages' },
  { key: 'ceo_assistant', label: 'CEO Assistant Mode', icon: Headphones, description: 'Direct assistant for owner conversations' },
] as const

export default function CockpitPolicies() {
  const [data, setData] = useState<PolicyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>('identity')

  useEffect(() => {
    fetch('/api/mandala/policies')
      .then(res => res.ok ? res.json() : { data: null })
      .then(json => setData(json.data || null))
      .catch(() => setData(null))
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

  if (!data) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
        <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">No policies loaded.</p>
        <p className="text-sm text-muted-foreground/60 mt-1">
          Add policy files to mandala/core/ to configure Mandala behavior.
        </p>
      </div>
    )
  }

  function getContent(key: string): string {
    if (!data) return ''
    if (key === 'identity') return data.identity
    if (key === 'rules') return data.rules
    if (key === 'sales_shadow') return data.modes.sales_shadow
    if (key === 'ceo_assistant') return data.modes.ceo_assistant
    return ''
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Runtime policies and behavioral configuration loaded from Mandala core files
      </p>

      {SECTIONS.map((section) => {
        const content = getContent(section.key)
        const isExpanded = expanded === section.key
        const Icon = section.icon
        return (
          <div key={section.key} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => setExpanded(isExpanded ? null : section.key)}
              className="w-full p-4 text-left hover:bg-muted/30 transition-colors flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{section.label}</p>
                <p className="text-xs text-muted-foreground">{section.description}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {content ? `${content.split('\n').length} lines` : 'empty'}
              </span>
            </button>
            {isExpanded && content && (
              <div className="px-4 pb-4">
                <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                  {content}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
