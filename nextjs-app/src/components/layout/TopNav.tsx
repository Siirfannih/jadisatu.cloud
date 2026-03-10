'use client'

import { useState, useEffect } from 'react'
import { Search, Bell, ChevronDown, LogOut, Sun, Moon } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme'

export default function TopNav() {
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
    <header className="h-16 bg-card border-b border-border sticky top-0 z-10 flex items-center justify-between px-8 transition-colors">
      <div className="flex-1 max-w-xl">
        <div className="relative group flex items-center">
          <Search className="absolute left-4 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects, tasks, or creative assets..."
            className="w-full bg-muted border-none rounded-xl pl-11 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground text-foreground"
          />
          <div className="absolute right-3 px-2 py-0.5 bg-card rounded-md border border-border text-xs font-medium text-muted-foreground shadow-sm">
            ⌘K
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <button
          onClick={toggleTheme}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        <button className="relative text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full border-2 border-card"></span>
        </button>

        <div className="h-6 w-px bg-border"></div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-3 hover:bg-muted p-1.5 rounded-xl transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-foreground leading-tight">{displayName}</p>
              <p className="text-xs text-muted-foreground">{user?.email || 'Creator'}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
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
