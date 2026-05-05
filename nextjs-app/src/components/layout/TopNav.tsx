'use client'

import { useState, useEffect } from 'react'
import { Search, Bell, ChevronDown, LogOut, Moon, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'
import { useNotifications } from '@/hooks/useNotifications'
import NotificationPanel from '@/components/notifications/NotificationPanel'

type TopNavProps = {
  isMobile?: boolean
  onMenuClick?: () => void
}

export default function TopNav({ isMobile = false, onMenuClick }: TopNavProps) {
  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { unreadCount } = useNotifications()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user)
    })
  }, [])

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 sticky top-0 z-10 flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        {isMobile && onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}
        <div className="flex-1 max-w-xl min-w-0 hidden sm:block">
          <div className="relative group flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects, tasks..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all placeholder:text-slate-400 text-slate-900"
            />
            <div className="absolute right-2 px-1.5 py-0.5 bg-white rounded-md border border-slate-200 text-[10px] font-medium text-slate-400 hidden md:block">
              ⌘K
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-4 shrink-0">
        <button
          onClick={() => window.location.href = 'https://jadisatu.cloud/'}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Switch to Dark Mode (Jadisatu Focus)"
        >
          <Moon className="w-[18px] h-[18px]" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#0060E1] text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <NotificationPanel open={showNotif} onClose={() => setShowNotif(false)} />
        </div>

        <div className="h-6 w-px bg-slate-200"></div>

        <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 sm:gap-3 hover:bg-slate-50 p-1.5 rounded-xl transition-colors min-w-0"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="text-left hidden md:block min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{displayName}</p>
            <p className="text-xs text-slate-500 truncate max-w-[140px]">{user?.email || 'Creator'}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
        </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
