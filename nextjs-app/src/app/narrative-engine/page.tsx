'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Compass, Search, Sparkles, Send, ChevronRight,
  Loader2, Copy, Check, ArrowRight, Youtube, Twitter,
  Instagram, Video, Linkedin, Globe, ExternalLink
} from 'lucide-react'

interface ContentAngle {
  angle: string
  description: string
  platform: string
  format: string
}

interface ResearchResult {
  research_summary: string
  content_angles: ContentAngle[]
  topic: string
  researched_at: string
}

interface GenerateResult {
  draft_script: string
  topic: string
  angle: string
  platform: string
  generated_at: string
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram size={16} />,
  tiktok: <Video size={16} />,
  youtube: <Youtube size={16} />,
  linkedin: <Linkedin size={16} />,
  twitter: <Twitter size={16} />,
}

export default function NarrativeEngine() {
  const router = useRouter()
  const [topic, setTopic] = useState('')
  const [researching, setResearching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [research, setResearch] = useState<ResearchResult | null>(null)
  const [generated, setGenerated] = useState<GenerateResult | null>(null)
  const [selectedAngle, setSelectedAngle] = useState<ContentAngle | null>(null)
  const [copied, setCopied] = useState(false)
  const [sentToHub, setSentToHub] = useState<string | false>(false)
  const [sendingAngle, setSendingAngle] = useState<number | null>(null)

  async function runResearch() {
    if (!topic.trim()) return
    setResearching(true)
    setResearch(null)
    setGenerated(null)
    setSelectedAngle(null)

    try {
      const res = await fetch('/light/api/narrative/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      if (res.ok) {
        const data = await res.json()
        setResearch(data)
      }
    } catch (error) {
      console.error('Research failed:', error)
    } finally {
      setResearching(false)
    }
  }

  async function generateContent(angle?: ContentAngle) {
    if (!research) return
    setGenerating(true)
    setGenerated(null)
    const useAngle = angle || selectedAngle

    try {
      const res = await fetch('/light/api/narrative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: research.topic,
          angle: useAngle?.angle || '',
          platform: useAngle?.platform || 'instagram',
          research_summary: research.research_summary,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setGenerated(data)
      }
    } catch (error) {
      console.error('Generation failed:', error)
    } finally {
      setGenerating(false)
    }
  }

  async function sendToCreativeHub() {
    if (!generated || !research) return
    setSentToHub(false)

    try {
      const res = await fetch('/light/api/contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generated.angle || `${generated.topic} Content`,
          script: generated.draft_script,
          caption: `[Research: ${research.topic}]\n\n${research.research_summary}`,
          platform: generated.platform,
          status: 'draft',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSentToHub(data.id || 'sent')
        setTimeout(() => setSentToHub(false), 5000)
      }
    } catch (error) {
      console.error('Failed to send to Creative Hub:', error)
    }
  }

  async function sendAngleAsIdea(angle: ContentAngle, index: number) {
    if (!research) return
    setSendingAngle(index)

    try {
      const res = await fetch('/light/api/contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: angle.angle,
          script: '',
          caption: `[From Narrative Engine — ${research.topic}]\n\n${angle.description}\n\nFormat: ${angle.format}\n\nResearch:\n${research.research_summary}`,
          platform: angle.platform,
          status: 'idea',
        }),
      })
      if (res.ok) {
        setSendingAngle(-index - 1) // negative = sent indicator
        setTimeout(() => setSendingAngle(null), 2000)
      }
    } catch (error) {
      console.error('Failed to send angle to Creative Hub:', error)
      setSendingAngle(null)
    }
  }

  function copyScript() {
    if (!generated?.draft_script) return
    navigator.clipboard.writeText(generated.draft_script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Compass size={28} className="text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Narrative Engine</h1>
        </div>
        <p className="text-muted-foreground">Research topics, generate content angles, and create scripts for any platform.</p>
      </div>

      {/* Research Input */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
          Enter Topic or Narrative
        </label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runResearch()}
              placeholder="e.g., AI in content creation, Crypto market trends, Creator economy..."
              className="w-full pl-11 pr-4 py-3 bg-muted border border-border rounded-xl text-base outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <button
            onClick={runResearch}
            disabled={researching || !topic.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {researching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            Run Research
          </button>
        </div>
      </div>

      {/* Research Results */}
      {research && (
        <div className="space-y-4 animate-slide-up">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Sparkles size={20} className="text-primary" />
              Research Summary
            </h2>
            <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed bg-muted rounded-xl p-4">
              {research.research_summary}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Content Angles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {research.content_angles.map((angle, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedAngle(angle)}
                  className={cn(
                    'p-4 rounded-xl border cursor-pointer transition-all',
                    selectedAngle?.angle === angle.angle
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:border-primary/30 hover:bg-muted'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-sm">{angle.angle}</h3>
                    <span className="text-muted-foreground shrink-0">
                      {PLATFORM_ICONS[angle.platform] || <Globe size={16} />}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{angle.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-2 py-0.5 bg-muted rounded text-muted-foreground">
                      {angle.format}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          sendAngleAsIdea(angle, i)
                        }}
                        disabled={sendingAngle === i}
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                      >
                        {sendingAngle === -(i + 1) ? (
                          <><Check size={12} className="text-emerald-500" /> Sent</>
                        ) : sendingAngle === i ? (
                          <><Loader2 size={12} className="animate-spin" /> Sending</>
                        ) : (
                          <><Send size={12} /> Save as Idea</>
                        )}
                      </button>
                      <span className="text-border">|</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedAngle(angle)
                          generateContent(angle)
                        }}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Generate <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedAngle && (
              <button
                onClick={() => generateContent()}
                disabled={generating}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Generate Content for &ldquo;{selectedAngle.angle}&rdquo;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Generated Content */}
      {generated && (
        <div className="bg-card border border-border rounded-2xl p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles size={20} className="text-accent" />
              Generated Script
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                {PLATFORM_ICONS[generated.platform]} {generated.platform}
              </span>
            </div>
          </div>

          <pre className="text-sm whitespace-pre-wrap leading-relaxed bg-muted rounded-xl p-4 mb-4 font-sans max-h-96 overflow-y-auto">
            {generated.draft_script}
          </pre>

          <div className="flex items-center gap-3">
            <button
              onClick={copyScript}
              className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Script'}
            </button>
            {sentToHub ? (
              <button
                onClick={() => router.push('/creative')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Check size={14} />
                Sent! Open Creative Hub
                <ExternalLink size={12} />
              </button>
            ) : (
              <button
                onClick={sendToCreativeHub}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Send size={14} />
                Send to Creative Hub
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
