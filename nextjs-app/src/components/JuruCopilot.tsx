'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Sparkles, X, Send, Loader2, PenTool, Compass,
  Lightbulb, ListTodo, LayoutGrid, ArrowRight
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  action?: JuruAction
  links?: { label: string; href: string }[]
}

interface JuruAction {
  type: string
  data: Record<string, unknown>
  executed?: boolean
}

interface ContentItem {
  id: string
  title: string
  script: string
  caption: string
  platform: string
  status: string
}

const QUICK_ACTIONS = [
  { icon: Lightbulb, label: 'Create idea', prompt: 'Create content idea about ' },
  { icon: PenTool, label: 'Generate script', prompt: 'Generate script for ' },
  { icon: LayoutGrid, label: 'Break into slides', prompt: 'Break into carousel slides ' },
  { icon: Compass, label: 'Research', prompt: 'Research ' },
  { icon: ListTodo, label: 'Create task', prompt: 'Create task ' },
]

export default function JuruCopilot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Halo! Aku Juru, AI copilot kamu di JadiSatu. Mau diskusi ide konten, generate script, riset topik, atau apa aja — tanya aja! ✨',
    }
  ])
  const [loading, setLoading] = useState(false)
  const [recentContent, setRecentContent] = useState<ContentItem[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch recent content when opened for context
  useEffect(() => {
    if (open) {
      fetch('/light/api/contents')
        .then(res => res.ok ? res.json() : [])
        .then(data => setRecentContent(Array.isArray(data) ? data.slice(0, 10) : []))
        .catch(() => setRecentContent([]))
    }
  }, [open])

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg])
  }, [])

  async function chatWithAI(userMessage: string): Promise<Message> {
    // Build history from messages (exclude the initial greeting)
    const chatHistory = messages
      .filter((_, i) => i > 0) // skip initial greeting
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/light/api/juru/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: chatHistory.slice(-10),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        return { role: 'assistant', content: data.reply }
      }

      // Log non-200 responses for debugging
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      console.error('Juru API error:', res.status, errData)

      if (res.status === 401) {
        return { role: 'assistant', content: 'Sesi kamu sudah expired. Silakan refresh halaman dan login ulang.' }
      }
      if (res.status === 503) {
        return { role: 'assistant', content: 'AI belum dikonfigurasi. Hubungi admin untuk setup API key.' }
      }
    } catch (err) {
      console.error('Juru fetch error:', err)
    }

    return {
      role: 'assistant',
      content: 'Maaf, aku sedang tidak bisa merespons. Coba lagi ya, atau gunakan salah satu quick action di bawah!',
    }
  }

  async function handleSend() {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    addMessage({ role: 'user', content: userMessage })
    setLoading(true)

    try {
      // Try command processing first, fall back to AI chat
      const response = await processCommand(userMessage)
      addMessage(response)
    } catch {
      addMessage({
        role: 'assistant',
        content: 'Maaf, ada yang error. Coba lagi ya!',
      })
    } finally {
      setLoading(false)
    }
  }

  function findContentByQuery(query: string): ContentItem | undefined {
    const lower = query.toLowerCase()
    return recentContent.find(c =>
      c.title.toLowerCase().includes(lower) ||
      c.id === query
    )
  }

  async function processCommand(input: string): Promise<Message> {
    const lower = input.toLowerCase()

    // Create content idea
    if (lower.startsWith('create content idea') || lower.startsWith('new idea')) {
      const topic = input.replace(/^(create content idea about|create content idea|new idea about|new idea)\s*/i, '').trim()
      if (!topic) {
        return { role: 'assistant', content: 'What topic should the content idea be about? Try: "Create content idea about AI in education"' }
      }

      try {
        const res = await fetch('/light/api/contents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: topic, status: 'idea' }),
        })
        if (res.ok) {
          const data = await res.json()
          refreshContent()
          return {
            role: 'assistant',
            content: `Created content idea: "${topic}"\n\nYou can now edit it in Creative Hub, or ask me to generate a script for it.`,
            action: { type: 'create_idea', data: { title: topic, id: data.id }, executed: true },
            links: [{ label: 'Open Creative Hub', href: '/light/creative' }],
          }
        }
      } catch { /* fall through */ }
      return { role: 'assistant', content: `Couldn't create the idea. Please try in the Creative Hub directly.` }
    }

    // Generate script
    if (lower.startsWith('generate script') || lower.startsWith('write script')) {
      const topic = input.replace(/^(generate script for|generate script|write script for|write script)\s*/i, '').trim()
      if (!topic) {
        return { role: 'assistant', content: 'What should the script be about? Try: "Generate script for AI productivity tools review"' }
      }

      // Check if topic matches existing content
      const existing = findContentByQuery(topic)

      try {
        const res = await fetch('/light/api/narrative/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: existing?.title || topic,
            angle: existing?.title || topic,
            platform: existing?.platform || 'instagram',
          }),
        })
        if (res.ok) {
          const data = await res.json()

          // Update existing content or create new
          if (existing) {
            await fetch('/light/api/contents', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: existing.id,
                script: data.draft_script,
                status: 'script',
              }),
            })
          } else {
            await fetch('/light/api/contents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: topic,
                script: data.draft_script,
                platform: data.platform,
                status: 'script',
              }),
            })
          }
          refreshContent()
          const preview = data.draft_script.substring(0, 150)
          return {
            role: 'assistant',
            content: `Script generated${existing ? ' and updated' : ' and saved'}!\n\nPreview:\n${preview}...`,
            action: { type: 'generate_script', data: { title: topic }, executed: true },
            links: [{ label: 'Open Creative Hub', href: '/light/creative' }],
          }
        }
      } catch { /* fall through */ }
      return { role: 'assistant', content: `Couldn't generate the script. Try the Narrative Engine page.` }
    }

    // Break into carousel slides / formats
    if (lower.startsWith('break into') || lower.startsWith('break this') || lower.startsWith('split into') || lower.startsWith('carousel')) {
      const query = input.replace(/^(break (this |into )?|split into |carousel (slides? )?)(carousel slides?|slides?|formats?)?\s*(for |from |of )?\s*/i, '').trim()

      // Find content to break into slides
      let content = query ? findContentByQuery(query) : undefined

      // If no query match, use the most recent content with a script
      if (!content) {
        content = recentContent.find(c => c.script && c.script.length > 0)
      }

      if (!content || !content.script) {
        return {
          role: 'assistant',
          content: 'I need a content item with a script to break into slides. Generate a script first, or specify which content to use.\n\nTry: "Break into carousel slides [content title]"',
        }
      }

      // Generate carousel slides from the script
      const slides = generateCarouselSlides(content.title, content.script)

      try {
        await fetch('/light/api/contents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: content.id,
            carousel_assets: slides,
          }),
        })
        refreshContent()

        const slidePreview = slides.map((s: { slide: number; text: string }, i: number) =>
          `Slide ${i + 1}: ${s.text.substring(0, 60)}...`
        ).join('\n')

        return {
          role: 'assistant',
          content: `Broke "${content.title}" into ${slides.length} carousel slides!\n\n${slidePreview}`,
          action: { type: 'break_into_slides', data: { contentId: content.id, slideCount: String(slides.length) }, executed: true },
          links: [{ label: 'Open Creative Hub', href: '/light/creative' }],
        }
      } catch { /* fall through */ }
      return { role: 'assistant', content: `Couldn't save carousel slides. Try again later.` }
    }

    // Create tasks from content
    if (lower.startsWith('create tasks from')) {
      const query = input.replace(/^create tasks from (content )?\s*/i, '').trim()

      let content = query ? findContentByQuery(query) : undefined
      if (!content) {
        content = recentContent[0]
      }

      if (!content) {
        return {
          role: 'assistant',
          content: 'No content found to create tasks from. Create some content first!',
        }
      }

      // Generate task list based on content status and pipeline
      const tasks = generateTasksFromContent(content)
      const created: string[] = []

      for (const task of tasks) {
        try {
          const res = await fetch('/light/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
          })
          if (res.ok) created.push(task.title)
        } catch { /* skip */ }
      }

      if (created.length > 0) {
        return {
          role: 'assistant',
          content: `Created ${created.length} tasks for "${content.title}":\n\n${created.map(t => `- ${t}`).join('\n')}`,
          action: { type: 'create_tasks_from_content', data: { contentTitle: content.title, taskCount: String(created.length) }, executed: true },
          links: [{ label: 'Open Kanban', href: '/light/kanban' }],
        }
      }
      return { role: 'assistant', content: `Couldn't create tasks. Please try adding them manually on the Kanban board.` }
    }

    // Create single task
    if (lower.startsWith('create task') || lower.startsWith('add task')) {
      const title = input.replace(/^(create task|add task)\s*/i, '').trim()
      if (!title) {
        return { role: 'assistant', content: 'What task should I create? Try: "Create task Review content calendar"' }
      }

      try {
        const res = await fetch('/light/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, status: 'todo', priority: 'medium', domain: 'work' }),
        })
        if (res.ok) {
          return {
            role: 'assistant',
            content: `Task created: "${title}"`,
            action: { type: 'create_task', data: { title }, executed: true },
            links: [{ label: 'Open Kanban', href: '/light/kanban' }],
          }
        }
      } catch { /* fall through */ }
      return { role: 'assistant', content: `Couldn't create the task. Try the Kanban board directly.` }
    }

    // Research
    if (lower.startsWith('research')) {
      const topic = input.replace(/^research\s*/i, '').trim()
      if (!topic) {
        return { role: 'assistant', content: 'What topic should I research? Try: "Research creator economy trends"' }
      }

      try {
        const res = await fetch('/light/api/narrative/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic }),
        })
        if (res.ok) {
          const data = await res.json()
          const anglesText = data.content_angles
            .map((a: { angle: string; platform: string }) => `- ${a.angle} (${a.platform})`)
            .join('\n')
          return {
            role: 'assistant',
            content: `Research completed for "${topic}"!\n\nContent Angles:\n${anglesText}\n\nSay "Generate script for [topic]" to create a script from this research.`,
            action: { type: 'research', data: { topic }, executed: true },
            links: [{ label: 'Open Narrative Engine', href: '/light/narrative-engine' }],
          }
        }
      } catch { /* fall through */ }
      return { role: 'assistant', content: `Couldn't complete research. Try the Narrative Engine page directly.` }
    }

    // List content
    if (lower.startsWith('list content') || lower.startsWith('show content') || lower.startsWith('my content')) {
      if (recentContent.length === 0) {
        return { role: 'assistant', content: 'No content items found. Create one with "Create content idea about [topic]"' }
      }
      const list = recentContent.slice(0, 5).map(c =>
        `- **${c.title}** [${c.status}] (${c.platform})`
      ).join('\n')
      return {
        role: 'assistant',
        content: `Your recent content:\n\n${list}\n\nYou can reference any of these by title in your commands.`,
        links: [{ label: 'Open Creative Hub', href: '/light/creative' }],
      }
    }

    // No command matched → send to AI for conversational response
    return chatWithAI(input)
  }

  function refreshContent() {
    fetch('/light/api/contents')
      .then(res => res.ok ? res.json() : [])
      .then(data => setRecentContent(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(() => {})
  }

  function handleLinkClick(href: string) {
    router.push(href)
    setOpen(false)
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 safe-area-bottom"
          aria-label="Open Juru"
        >
          <Sparkles size={22} className="sm:w-6 sm:h-6" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed inset-4 sm:inset-auto sm:bottom-6 sm:right-6 sm:left-auto z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-full sm:max-w-none h-[calc(100vh-2rem)] sm:h-[32rem] max-h-[85vh] sm:max-h-[32rem] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <span className="font-semibold text-sm">Juru AI Copilot</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded">
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[85%] p-3 rounded-xl text-sm',
                  msg.role === 'user'
                    ? 'ml-auto bg-primary text-white'
                    : 'bg-muted text-foreground'
                )}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.action?.executed && (
                  <div className="mt-2 pt-2 border-t border-current/10 text-xs opacity-70 flex items-center gap-1">
                    ✓ Action completed
                  </div>
                )}
                {msg.links && msg.links.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-current/10 flex flex-wrap gap-2">
                    {msg.links.map((link, j) => (
                      <button
                        key={j}
                        onClick={() => handleLinkClick(link.href)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {link.label} <ArrowRight size={10} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 size={14} className="animate-spin" />
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-3 py-2 border-t border-border/50 flex gap-1 overflow-x-auto no-scrollbar">
            {QUICK_ACTIONS.map((action, i) => (
              <button
                key={i}
                onClick={() => setInput(action.prompt)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-[11px] text-muted-foreground whitespace-nowrap transition-colors"
              >
                <action.icon size={12} />
                {action.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask Juru anything..."
                className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:border-primary/50"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="p-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function generateCarouselSlides(title: string, script: string): { slide: number; text: string; type: string }[] {
  // Parse script sections into carousel slides
  const sections = script.split(/\n\n+/).filter(s => s.trim().length > 0)
  const slides: { slide: number; text: string; type: string }[] = []

  // Slide 1: Hook / Title
  slides.push({
    slide: 1,
    text: title,
    type: 'hook',
  })

  // Parse meaningful sections into slides
  let slideNum = 2
  for (const section of sections) {
    const cleaned = section.replace(/^\[.*?\]\s*/m, '').trim()
    if (cleaned.length < 10) continue

    // Determine slide type from content
    let type = 'content'
    const sectionLower = section.toLowerCase()
    if (sectionLower.includes('hook') || sectionLower.includes('intro')) type = 'hook'
    else if (sectionLower.includes('problem')) type = 'problem'
    else if (sectionLower.includes('insight') || sectionLower.includes('finding')) type = 'insight'
    else if (sectionLower.includes('action') || sectionLower.includes('step')) type = 'action'
    else if (sectionLower.includes('cta') || sectionLower.includes('follow')) type = 'cta'

    slides.push({
      slide: slideNum++,
      text: cleaned.substring(0, 280),
      type,
    })

    if (slideNum > 10) break // Cap at 10 slides
  }

  // Add CTA slide if not present
  if (!slides.some(s => s.type === 'cta')) {
    slides.push({
      slide: slideNum,
      text: `Follow for more insights on ${title}. Save this post for later!`,
      type: 'cta',
    })
  }

  return slides
}

function generateTasksFromContent(content: ContentItem): { title: string; status: string; priority: string; domain: string }[] {
  const tasks: { title: string; status: string; priority: string; domain: string }[] = []
  const title = content.title

  switch (content.status) {
    case 'idea':
      tasks.push(
        { title: `Research topic: ${title}`, status: 'todo', priority: 'high', domain: 'work' },
        { title: `Write script for: ${title}`, status: 'backlog', priority: 'medium', domain: 'work' },
        { title: `Choose platform for: ${title}`, status: 'backlog', priority: 'low', domain: 'work' },
      )
      break
    case 'draft':
    case 'script':
      tasks.push(
        { title: `Review and edit script: ${title}`, status: 'todo', priority: 'high', domain: 'work' },
        { title: `Create visuals for: ${title}`, status: 'backlog', priority: 'medium', domain: 'work' },
        { title: `Schedule shoot for: ${title}`, status: 'backlog', priority: 'medium', domain: 'work' },
      )
      break
    case 'ready':
      tasks.push(
        { title: `Final review: ${title}`, status: 'todo', priority: 'high', domain: 'work' },
        { title: `Schedule publish date for: ${title}`, status: 'todo', priority: 'high', domain: 'work' },
        { title: `Prepare captions & hashtags: ${title}`, status: 'backlog', priority: 'medium', domain: 'work' },
      )
      break
    case 'published':
      tasks.push(
        { title: `Monitor engagement: ${title}`, status: 'todo', priority: 'medium', domain: 'work' },
        { title: `Respond to comments: ${title}`, status: 'backlog', priority: 'low', domain: 'work' },
      )
      break
    default:
      tasks.push(
        { title: `Plan content: ${title}`, status: 'todo', priority: 'medium', domain: 'work' },
        { title: `Create script for: ${title}`, status: 'backlog', priority: 'medium', domain: 'work' },
        { title: `Produce content: ${title}`, status: 'backlog', priority: 'medium', domain: 'work' },
        { title: `Publish: ${title}`, status: 'backlog', priority: 'low', domain: 'work' },
      )
  }

  return tasks
}
