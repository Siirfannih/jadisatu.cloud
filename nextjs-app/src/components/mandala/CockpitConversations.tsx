'use client'

import { cn } from '@/lib/utils'
import { MessageSquare, Users, UserCheck, Bot } from 'lucide-react'
import type { Conversation } from './types'
import { PHASES } from './types'

interface Props {
  conversations: Conversation[]
  onTakeover: (id: string) => void
  onRelease: (id: string) => void
}

export default function CockpitConversations({ conversations, onTakeover, onRelease }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Active Conversations</h3>
        <span className="text-sm text-muted-foreground">{conversations.length} active</span>
      </div>
      {conversations.length === 0 ? (
        <div className="p-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No active conversations.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Conversations appear here when customers message via WhatsApp or Telegram.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {conversations.map((conv) => {
            const phaseConfig = PHASES.find(p => p.key === conv.phase) || PHASES[0]
            const timeAgo = getTimeAgo(conv.updated_at)
            return (
              <div key={conv.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", phaseConfig.lightBg)}>
                      <Users className={cn("w-5 h-5", phaseConfig.text)} />
                    </div>
                    <div>
                      <p className="font-medium">{conv.customer_name || conv.customer_number}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", phaseConfig.lightBg, phaseConfig.text)}>
                          {phaseConfig.label}
                        </span>
                        <span className="text-xs text-muted-foreground">Score: {conv.score || 0}/100</span>
                        <span className="text-xs text-muted-foreground">{conv.channel}</span>
                        <span className="text-xs text-muted-foreground/60">{timeAgo}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1",
                      conv.current_handler === 'owner'
                        ? "bg-blue-50 text-blue-600"
                        : "bg-purple-50 text-purple-600"
                    )}>
                      {conv.current_handler === 'owner'
                        ? <><UserCheck className="w-3 h-3" /> You</>
                        : <><Bot className="w-3 h-3" /> Mandala</>
                      }
                    </span>
                    {conv.current_handler === 'mandala' ? (
                      <button
                        onClick={() => onTakeover(conv.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
                      >
                        Take Over
                      </button>
                    ) : (
                      <button
                        onClick={() => onRelease(conv.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors font-medium"
                      >
                        Let Mandala
                      </button>
                    )}
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

function getTimeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
