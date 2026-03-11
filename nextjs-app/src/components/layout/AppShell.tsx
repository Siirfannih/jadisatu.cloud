'use client'

import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import Sidebar from './Sidebar'
import TopNav from './TopNav'

// Lazy load JuruCopilot - it's not needed for initial page render
const JuruCopilot = dynamic(() => import('../JuruCopilot'), {
  ssr: false,
  loading: () => null,
})

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Pages that should not show the sidebar
  const noShellRoutes = ['/login', '/auth']
  const isNoShell = noShellRoutes.some(r => pathname?.startsWith(r))

  // Creative Hub has its own full-width layout
  const isFullWidth = pathname === '/creative' || pathname === '/notes'

  if (isNoShell) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className={isFullWidth ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto p-6 lg:p-8'}>
          {children}
        </main>
      </div>
      <JuruCopilot />
    </div>
  )
}
