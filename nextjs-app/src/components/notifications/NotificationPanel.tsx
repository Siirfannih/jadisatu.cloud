'use client'

import { useNotifications } from '@/hooks/useNotifications'
import { AlertTriangle, Sparkles, Info, CheckCircle, X, Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'

const TYPE_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  flag: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50' },
  onboarding: { icon: Sparkles, color: 'text-blue-500', bg: 'bg-blue-50' },
  system: { icon: Info, color: 'text-slate-500', bg: 'bg-slate-50' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}j`
  return `${Math.floor(hours / 24)}h`
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function NotificationPanel({ open, onClose }: Props) {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications()
  const router = useRouter()

  if (!open) return null

  return (
    <div className="absolute right-0 top-12 w-[360px] bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-slate-100 z-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#0060E1]" />
          <span className="text-sm font-bold text-slate-800">Notifikasi</span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold text-white bg-[#0060E1] px-1.5 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-[10px] font-bold text-[#0060E1] uppercase tracking-wider hover:underline">
              Tandai semua dibaca
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Tidak ada notifikasi</p>
          </div>
        ) : (
          notifications.map(n => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.system
            const Icon = config.icon
            return (
              <div
                key={n.id}
                className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-all flex gap-3 ${!n.read ? 'bg-blue-50/30' : ''}`}
                onClick={() => {
                  markAsRead(n.id)
                  if (n.conversation_id) router.push(`/mandala/conversations`)
                  onClose()
                }}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-[13px] truncate ${!n.read ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>{n.title}</p>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-[#0060E1] flex-shrink-0" />}
                  </div>
                  {n.body && <p className="text-[11px] text-slate-400 truncate mt-0.5">{n.body}</p>}
                  <p className="text-[10px] text-slate-300 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
