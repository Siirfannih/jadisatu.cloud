'use client'

import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { Separator } from '@/components/ui/separator'
import { Bell } from 'lucide-react'

const JuruCopilot = dynamic(() => import('../JuruCopilot'), {
  ssr: false,
  loading: () => null,
})

const NO_SHELL_ROUTES = ['/login', '/auth']

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isNoShell = NO_SHELL_ROUTES.some(r => pathname?.startsWith(r))

  if (isNoShell) {
    return <>{children}</>
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Top header bar */}
        <header className="flex h-12 items-center gap-3 border-b border-slate-100 bg-white px-4 sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />

          <div className="flex-1" />

          <div className="flex items-center gap-2 ml-auto">
            <button className="relative text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted">
              <Bell className="size-5" />
              <span className="absolute top-1.5 right-1.5 size-2 bg-orange-500 rounded-full border-2 border-background" />
            </button>
          </div>
        </header>

        {/* Main content — off-white background for eye comfort */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F8FAFC]">
          {children}
        </div>
      </SidebarInset>
      <JuruCopilot />
    </SidebarProvider>
  )
}
