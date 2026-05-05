'use client'

import { usePathname } from 'next/navigation'
import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import { useIsMobile } from '@/hooks/useMediaQuery'

const JuruCopilot = dynamic(() => import('../JuruCopilot'), {
  ssr: false,
  loading: () => null,
})

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  const noShellRoutes = ['/login', '/auth']
  const isNoShell = noShellRoutes.some(r => pathname?.startsWith(r))
  const isFullWidth = pathname === '/creative' || pathname === '/notes'

  if (isNoShell) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar
        isMobile={isMobile}
        mobileOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-screen">
        <TopNav
          isMobile={isMobile}
          onMenuClick={() => setMobileMenuOpen(prev => !prev)}
        />
        <main className={isFullWidth ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8'}>
          {children}
        </main>
      </div>
      <JuruCopilot />
    </div>
  )
}
