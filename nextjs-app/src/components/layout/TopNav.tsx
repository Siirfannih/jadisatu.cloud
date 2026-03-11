'use client'

import { useState, useEffect } from 'react'
import { Search, Bell, ChevronDown, LogOut, Moon, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'

type TopNavProps = {
  isMobile?: boolean
  onMenuClick?: () => void
}

export default function TopNav({ isMobile = false, onMenuClick }: TopNavProps) {
  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const { theme, toggleTheme } = useTheme()
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
    <header className="h-14 sm:h-16 bg-card border-b border-border sticky top-0 z-10 flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        {isMobile && onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}
        <div className="flex-1 max-w-xl min-w-0 hidden sm:block">
          <div className="relative group flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects, tasks..."
              className="w-full bg-muted border-none rounded-xl pl-10 pr-10 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground text-foreground"
            />
            <div className="absolute right-2 px-1.5 py-0.5 bg-card rounded-md border border-border text-[10px] font-medium text-muted-foreground hidden md:block">
              ⌘K
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-4 shrink-0">
        <button
          onClick={() => window.location.href = 'https://jadisatu.cloud/'}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Switch to Dark Mode (Jadisatu Focus)"
        >
          <Moon className="w-[18px] h-[18px]" />
        </button>

        <button className="relative text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full border-2 border-card"></span>
        </button>

        <div className="h-6 w-px bg-border"></div>

        <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 sm:gap-3 hover:bg-muted p-1.5 rounded-xl transition-colors min-w-0"
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="text-left hidden md:block min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[140px]">{user?.email || 'Creator'}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
        </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-card rounded-xl shadow-lg border border-border py-2 z-50">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted transition-colors"
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
