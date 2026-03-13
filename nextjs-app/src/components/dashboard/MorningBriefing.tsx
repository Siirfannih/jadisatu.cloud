'use client'

import { useState, useEffect } from 'react'
import { Sun, Zap, Battery, BatteryLow, Target, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const ENERGY_LEVELS = [
  { value: 'low', label: 'Low Energy', emoji: '🔋', Icon: BatteryLow, color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10' },
  { value: 'medium', label: 'Steady', emoji: '⚡', Icon: Battery, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' },
  { value: 'high', label: 'Energized', emoji: '🔥', Icon: Zap, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
]

const FOCUS_DOMAINS = [
  { value: 'work', label: 'Work', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
  { value: 'learn', label: 'Learn', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  { value: 'business', label: 'Business', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  { value: 'personal', label: 'Personal', color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400' },
]

export default function MorningBriefing() {
  const [show, setShow] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [step, setStep] = useState(0)
  const [energy, setEnergy] = useState('')
  const [focus, setFocus] = useState('')
  const [priority, setPriority] = useState('')
  const [blocker, setBlocker] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    checkBriefing()
  }, [])

  async function checkBriefing() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/morning-briefing?date=${today}`)
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setCompleted(true)
        } else {
          setShow(true)
        }
      }
    } catch {
      // silent
    }
  }

  async function saveBriefing() {
    setSaving(true)
    try {
      await fetch('/api/morning-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ energy, focus, priority, blocker }),
      })
      setCompleted(true)
      setShow(false)
    } catch {
      // silent
    }
    setSaving(false)
  }

  if (completed || !show) return null

  const steps = [
    {
      title: 'How are you feeling today?',
      subtitle: 'Your energy level helps prioritize tasks',
      content: (
        <div className="flex gap-3">
          {ENERGY_LEVELS.map(level => (
            <button
              key={level.value}
              onClick={() => { setEnergy(level.value); setStep(1) }}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all',
                energy === level.value
                  ? cn(level.color, 'border-current/30 shadow-sm')
                  : 'border-border hover:border-primary/20 bg-card'
              )}
            >
              <span className="text-2xl">{level.emoji}</span>
              <span className="text-xs font-medium">{level.label}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'What\'s your focus today?',
      subtitle: 'Pick a domain to channel your energy',
      content: (
        <div className="flex flex-wrap gap-2">
          {FOCUS_DOMAINS.map(domain => (
            <button
              key={domain.value}
              onClick={() => { setFocus(domain.value); setStep(2) }}
              className={cn(
                'px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                focus === domain.value
                  ? cn(domain.color, 'shadow-sm')
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {domain.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Top priority task?',
      subtitle: 'What\'s the one thing you must accomplish?',
      content: (
        <div className="space-y-3">
          <input
            type="text"
            value={priority}
            onChange={e => setPriority(e.target.value)}
            placeholder="e.g., Finish blog post draft"
            autoFocus
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => setStep(3)}
            disabled={!priority.trim()}
            className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ),
    },
    {
      title: 'Any blockers?',
      subtitle: 'What might get in your way? (optional)',
      content: (
        <div className="space-y-3">
          <input
            type="text"
            value={blocker}
            onChange={e => setBlocker(e.target.value)}
            placeholder="e.g., Waiting for design review"
            autoFocus
            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={saveBriefing}
            disabled={saving}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={14} />
            {saving ? 'Saving...' : 'Start My Day'}
          </button>
          <button
            onClick={saveBriefing}
            disabled={saving}
            className="w-full text-muted-foreground hover:text-foreground py-2 text-xs"
          >
            Skip blockers
          </button>
        </div>
      ),
    },
  ]

  const currentStep = steps[step]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-bold text-foreground">Morning Briefing</span>
          </div>
          <button onClick={() => setShow(false)} className="p-1 hover:bg-muted rounded-lg">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="flex gap-1 mb-5 mt-3">
          {steps.map((_, i) => (
            <div key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1">{currentStep.title}</h2>
        <p className="text-sm text-muted-foreground mb-4">{currentStep.subtitle}</p>
        {currentStep.content}
      </div>
    </div>
  )
}
