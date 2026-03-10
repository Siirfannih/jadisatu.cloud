'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import JuruCopilot from '../JuruCopilot'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Pages that should not show the sidebar
  const noShellRoutes = ['/login', '/auth']
  const isNoShell = noShellRoutes.some(r => pathname?.startsWith(r))

  // Creative Hub has its own full-width layout
  const isFullWidth = pathname === '/creative'

  if (isNoShell) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className={isFullWidth ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto p-6 lg:p-8'}>
        {children}
      </main>
      <JuruCopilot />
    </div>
  )
}
