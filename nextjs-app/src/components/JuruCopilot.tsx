'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Sparkles, X, Send, Loader2, PenTool, Compass,
  Lightbulb, ListTodo, ChevronDown
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  action?: JuruAction
}

interface JuruAction {
  type: string
  data: Record<string, string>
  executed?: boolean
}

const QUICK_ACTIONS = [
  { icon: Lightbulb, label: 'Create content idea', prompt: 'Create content idea about ' },
  { icon: PenTool, label: 'Generate script', prompt: 'Generate script for ' },
  { icon: Compass, label: 'Research topic', prompt: 'Research ' },
  { icon: ListTodo, label: 'Create tasks', prompt: 'Create tasks from content ' },
]

export default function JuruCopilot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m Juru, your AI copilot. I can help you create content ideas, generate scripts, research topics, and manage tasks. What would you like to do?',
    }
  ])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await processCommand(userMessage)
      setMessages(prev => [...prev, response])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
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
        const res = await fetch('/api/contents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: topic, status: 'idea' }),
        })
        if (res.ok) {
          return {
            role: 'assistant',
            content: `Created a new content idea: "${topic}". You can find it in the Creative Hub.`,
            action: { type: 'create_idea', data: { title: topic }, executed: true },
          }
        }
      } catch { /* fall through */ }
      return { role: 'assistant', content: `I'll create that idea for you. Please open Creative Hub and add "${topic}" there.` }
    }

    // Generate script
    if (lower.startsWith('generate script') || lower.startsWith('write script')) {
      const topic = input.replace(/^(generate script for|generate script|write script for|write script)\s*/i, '').trim()
      if (!topic) {
        return { role: 'assistant', content: 'What should the script be about? Try: "Generate script for AI productivity tools review"' }
      }

      try {
        const res = await fetch('/api/narrative/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, angle: topic, platform: 'instagram' }),
        })
        if (res.ok) {
          const data = await res.json()
          // Save to creative hub
          await fetch('/api/contents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: topic,
              script: data.draft_script,
              platform: data.platform,
              status: 'script',
            }),
          })
          return {
            role: 'assistant',
            content: `Script generated and saved to Creative Hub!\n\nPreview:\n${data.draft_script.substring(0, 200)}...`,
            action: { type: 'generate_script', data: { title: topic }, executed: true },
          }
        }
      } catch { /* fall through */ }
      return { role: 'assistant', content: `I couldn't generate the script right now. Try using the Narrative Engine page directly.` }
    }

    // Research
    if (lower.startsWith('research')) {
      const topic = input.replace(/^research\s*/i, '').trim()
      if (!topic) {
        return { role: 'assistant', content: 'What topic should I research? Try: "Research creator economy trends"' }
      }

      try {
        const res = await fetch('/api/narrative/research', {
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
            content: `Research completed for "${topic}"!\n\nContent Angles:\n${anglesText}\n\nUse the Narrative Engine page to generate scripts from these angles.`,
            action: { type: 'research', data: { topic }, executed: true },
          }
        }
      } catch { /* fall through */ }
      return { role: 'assistant', content: `Research on "${topic}" is available in the Narrative Engine. Head there to see full results.` }
    }

    // Create tasks
    if (lower.startsWith('create task') || lower.startsWith('add task')) {
      const title = input.replace(/^(create tasks? from content|create tasks?|add tasks?)\s*/i, '').trim()
      if (!title) {
        return { role: 'assistant', content: 'What task should I create? Try: "Create task Review content calendar"' }
      }

      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, status: 'todo', priority: 'medium', domain: 'work' }),
        })
        if (res.ok) {
          return {
            role: 'assistant',
            content: `Task created: "${title}". You can find it on the Kanban board.`,
            action: { type: 'create_task', data: { title }, executed: true },
          }
        }
      } catch { /* fall through */ }
      return { role: 'assistant', content: `I'll note that task. Please add "${title}" on the Kanban board.` }
    }

    // Default response
    return {
      role: 'assistant',
      content: `I can help you with:\n\n` +
        `- **Create content idea about [topic]** - adds to Creative Hub\n` +
        `- **Generate script for [topic]** - creates a content script\n` +
        `- **Research [topic]** - runs Narrative Engine research\n` +
        `- **Create task [title]** - adds a new task\n\n` +
        `Try one of these commands!`,
    }
  }

  async function executeAction(action: JuruAction) {
    if (action.executed) return
    // Actions are executed during processCommand, this is for future use
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
        >
          <Sparkles size={24} />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[32rem] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
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
                    : 'bg-muted/50 dark:bg-white/5 text-foreground'
                )}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.action?.executed && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-xs opacity-70 flex items-center gap-1">
                    ✓ Action completed
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-white/10 rounded-lg text-[11px] text-muted-foreground whitespace-nowrap transition-colors"
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
                className="flex-1 px-3 py-2 bg-background/50 dark:bg-white/5 border border-border/50 dark:border-white/10 rounded-lg text-sm outline-none focus:border-primary/50"
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
