'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  GraduationCap, ChevronLeft, MessageSquare, ThumbsUp,
  ThumbsDown, Minus, Send, BookOpen, Shield, X, ChevronRight
} from 'lucide-react'
import Link from 'next/link'

interface ReviewConversation {
  id: string
  customer_name: string | null
  customer_number: string
  status: string
  phase: string
  lead_score: number
  message_count: number
  annotation_count: number
  updated_at: string
}

interface ChatMessage {
  id: string
  conversation_id: string
  direction: string
  sender: string
  content: string
  created_at: string
}

type AnnotationAction = 'annotate' | 'correct_to_policy' | 'correct_to_knowledge'

export default function TrainingPage() {
  const [conversations, setConversations] = useState<ReviewConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  // Selected conversation for review
  const [selectedConv, setSelectedConv] = useState<ReviewConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  // Annotation state
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null)
  const [annotationAction, setAnnotationAction] = useState<AnnotationAction>('annotate')
  const [rating, setRating] = useState<'good' | 'bad' | 'neutral'>('neutral')
  const [suggestedResponse, setSuggestedResponse] = useState('')
  const [notes, setNotes] = useState('')
  const [policyTitle, setPolicyTitle] = useState('')
  const [policyRules, setPolicyRules] = useState('')
  const [knowledgeTitle, setKnowledgeTitle] = useState('')
  const [knowledgeContent, setKnowledgeContent] = useState('')
  const [knowledgeCategory, setKnowledgeCategory] = useState('custom')
  const [submitting, setSubmitting] = useState(false)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/mandala/training?type=conversations')
      if (res.status === 403) { setForbidden(true); return }
      const json = await res.json()
      setConversations(json.data || [])
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchConversations().finally(() => setLoading(false))
  }, [fetchConversations])

  const selectConversation = async (conv: ReviewConversation) => {
    setSelectedConv(conv)
    setSelectedMessage(null)
    setLoadingMessages(true)
    try {
      const res = await fetch('/api/mandala/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_messages', conversation_id: conv.id }),
      })
      const json = await res.json()
      setMessages(json.data || [])
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    }
    setLoadingMessages(false)
  }

  const resetAnnotationForm = () => {
    setSelectedMessage(null)
    setAnnotationAction('annotate')
    setRating('neutral')
    setSuggestedResponse('')
    setNotes('')
    setPolicyTitle('')
    setPolicyRules('')
    setKnowledgeTitle('')
    setKnowledgeContent('')
    setKnowledgeCategory('custom')
  }

  const handleSubmitAnnotation = async () => {
    if (!selectedConv) return
    setSubmitting(true)

    try {
      const base = {
        conversation_id: selectedConv.id,
        message_id: selectedMessage?.id,
      }

      if (annotationAction === 'annotate') {
        await fetch('/api/mandala/training', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'annotate',
            ...base,
            rating,
            suggested_response: suggestedResponse || null,
            notes: notes || null,
          }),
        })
      } else if (annotationAction === 'correct_to_policy') {
        await fetch('/api/mandala/training', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'correct_to_policy',
            ...base,
            suggested_response: suggestedResponse || null,
            notes,
            policy_title: policyTitle,
            policy_rules: policyRules,
          }),
        })
      } else if (annotationAction === 'correct_to_knowledge') {
        await fetch('/api/mandala/training', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'correct_to_knowledge',
            ...base,
            notes,
            knowledge_title: knowledgeTitle,
            knowledge_content: knowledgeContent,
            knowledge_category: knowledgeCategory,
          }),
        })
      }

      resetAnnotationForm()
      await fetchConversations()
    } catch (err) {
      console.error('Annotation failed:', err)
    }
    setSubmitting(false)
  }

  if (forbidden) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <GraduationCap className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Training is only available for the owner account.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/mandala" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-orange-500" />
            Training & Review
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Review conversations, correct responses, and turn corrections into policies or knowledge
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation List (left panel) */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-sm">Conversations to Review</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{conversations.length} conversations</p>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No conversations to review.</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={cn(
                      "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                      selectedConv?.id === conv.id && "bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">
                        {conv.customer_name || conv.customer_number}
                      </p>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {conv.phase}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {conv.message_count} msgs
                      </span>
                      {conv.annotation_count > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600">
                          {conv.annotation_count} reviewed
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Conversation Review (center + right panels) */}
        <div className="lg:col-span-2">
          {!selectedConv ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
              <GraduationCap className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground">Select a conversation to review</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Click on a conversation to view messages and provide training feedback
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chat messages */}
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">
                      {selectedConv.customer_name || selectedConv.customer_number}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Phase: {selectedConv.phase} · Score: {selectedConv.lead_score}/100
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-lg font-medium",
                    selectedConv.status === 'active'
                      ? "bg-green-50 text-green-600"
                      : "bg-slate-100 text-slate-500"
                  )}>
                    {selectedConv.status}
                  </span>
                </div>

                <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                  {loadingMessages ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No messages found.</p>
                  ) : (
                    messages.map((msg) => {
                      const isMandala = msg.sender === 'mandala'
                      const isCustomer = msg.sender === 'customer'
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            isCustomer ? "justify-start" : "justify-end"
                          )}
                        >
                          <button
                            onClick={() => {
                              if (isMandala) {
                                setSelectedMessage(msg)
                                setAnnotationAction('annotate')
                              }
                            }}
                            className={cn(
                              "max-w-[80%] rounded-xl px-4 py-2.5 text-sm text-left transition-all",
                              isCustomer
                                ? "bg-muted text-foreground"
                                : "bg-purple-50 text-purple-900 border border-purple-100",
                              isMandala && "hover:ring-2 hover:ring-purple-300 cursor-pointer",
                              selectedMessage?.id === msg.id && "ring-2 ring-orange-400",
                              !isMandala && !isCustomer && "bg-blue-50 text-blue-900 border border-blue-100"
                            )}
                          >
                            <p className="text-xs font-medium mb-0.5 opacity-60">
                              {msg.sender === 'mandala' ? 'Mandala' : msg.sender === 'customer' ? 'Customer' : msg.sender}
                            </p>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <p className="text-[10px] opacity-40 mt-1">
                              {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Annotation Panel */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">
                    {selectedMessage ? 'Review Selected Message' : 'Review Conversation'}
                  </h3>
                  {selectedMessage && (
                    <button
                      onClick={() => setSelectedMessage(null)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Clear selection
                    </button>
                  )}
                </div>

                {/* Action type selector */}
                <div className="flex gap-1 bg-muted/50 rounded-lg p-1 mb-4">
                  {[
                    { key: 'annotate' as const, label: 'Rate & Comment', icon: ThumbsUp },
                    { key: 'correct_to_policy' as const, label: 'Create Policy', icon: Shield },
                    { key: 'correct_to_knowledge' as const, label: 'Add Knowledge', icon: BookOpen },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setAnnotationAction(tab.key)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all",
                        annotationAction === tab.key
                          ? "bg-card shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Rating (for annotate action) */}
                {annotationAction === 'annotate' && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium mb-2">Rating</label>
                    <div className="flex gap-2">
                      {[
                        { key: 'good' as const, icon: ThumbsUp, label: 'Good', color: 'bg-green-50 text-green-600 border-green-200' },
                        { key: 'neutral' as const, icon: Minus, label: 'Neutral', color: 'bg-slate-50 text-slate-500 border-slate-200' },
                        { key: 'bad' as const, icon: ThumbsDown, label: 'Bad', color: 'bg-red-50 text-red-600 border-red-200' },
                      ].map((r) => (
                        <button
                          key={r.key}
                          onClick={() => setRating(r.key)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                            rating === r.key ? r.color + ' ring-2 ring-offset-1' : 'border-border hover:bg-muted'
                          )}
                        >
                          <r.icon className="w-4 h-4" />
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested response (for annotate) */}
                {annotationAction === 'annotate' && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium mb-1">What should Mandala have said instead? (optional)</label>
                    <textarea
                      value={suggestedResponse}
                      onChange={(e) => setSuggestedResponse(e.target.value)}
                      rows={2}
                      placeholder="Type the ideal response..."
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y"
                    />
                  </div>
                )}

                {/* Policy fields */}
                {annotationAction === 'correct_to_policy' && (
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">Policy Title</label>
                      <input
                        type="text"
                        value={policyTitle}
                        onChange={(e) => setPolicyTitle(e.target.value)}
                        placeholder="e.g. Always mention free trial when customer hesitates"
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Policy Rules (injected into prompt)</label>
                      <textarea
                        value={policyRules}
                        onChange={(e) => setPolicyRules(e.target.value)}
                        rows={4}
                        placeholder="Write the behavioral rule..."
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Suggested Response (optional)</label>
                      <textarea
                        value={suggestedResponse}
                        onChange={(e) => setSuggestedResponse(e.target.value)}
                        rows={2}
                        placeholder="What should Mandala have said?"
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y"
                      />
                    </div>
                  </div>
                )}

                {/* Knowledge fields */}
                {annotationAction === 'correct_to_knowledge' && (
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">Knowledge Title</label>
                      <input
                        type="text"
                        value={knowledgeTitle}
                        onChange={(e) => setKnowledgeTitle(e.target.value)}
                        placeholder="e.g. New pricing for Enterprise plan"
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Knowledge Content (markdown)</label>
                      <textarea
                        value={knowledgeContent}
                        onChange={(e) => setKnowledgeContent(e.target.value)}
                        rows={4}
                        placeholder="Write the knowledge content..."
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Category</label>
                      <select
                        value={knowledgeCategory}
                        onChange={(e) => setKnowledgeCategory(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-muted border border-border text-sm"
                      >
                        <option value="product">Product</option>
                        <option value="faq">FAQ</option>
                        <option value="competitor">Competitor</option>
                        <option value="process">Process</option>
                        <option value="general">General</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Notes (always available) */}
                <div className="mb-4">
                  <label className="block text-xs font-medium mb-1">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Additional context or reasoning..."
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y"
                  />
                </div>

                {/* Submit */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitAnnotation}
                    disabled={submitting || (annotationAction === 'correct_to_policy' && (!policyTitle || !policyRules)) || (annotationAction === 'correct_to_knowledge' && (!knowledgeTitle || !knowledgeContent))}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 text-sm font-medium transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Submitting...' : annotationAction === 'annotate' ? 'Submit Review' : annotationAction === 'correct_to_policy' ? 'Create Candidate Policy' : 'Add Knowledge Entry'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
