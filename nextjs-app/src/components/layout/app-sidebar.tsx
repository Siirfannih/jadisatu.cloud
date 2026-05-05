'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase-browser'
import {
  LayoutDashboard, Bot, Settings, PenTool, BarChart3,
  Users, Target, Sparkles, LogOut,
  MessageSquare, GitBranch, Send, ListTodo,
  MessageCircle, BookOpen, Shield,
  ChevronRight,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { useState, useEffect, useRef } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@radix-ui/react-collapsible'

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  {
    icon: Bot, label: 'Mandala', href: '/mandala', accent: true,
    subItems: [
      { icon: MessageSquare, label: 'Percakapan', href: '/mandala/conversations' },
      { icon: Send, label: 'Pencarian Prospek', href: '/mandala/outreach' },
      { icon: ListTodo, label: 'Tugas AI', href: '/mandala/tasks' },
      { icon: MessageCircle, label: 'WhatsApp', href: '/mandala/whatsapp' },
      { icon: BookOpen, label: 'Pengetahuan', href: '/mandala/knowledge' },
      { icon: Shield, label: 'Pengaturan AI', href: '/mandala/policies' },
    ],
  },
  { icon: Users, label: 'CRM', href: '/crm' },
  { icon: Target, label: 'Leads', href: '/leads' },
  { icon: PenTool, label: 'Konten', href: '/content' },
  { icon: BarChart3, label: 'Analitik', href: '/analytics' },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string } } | null>(null)

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

  const [mandalaFlyout, setMandalaFlyout] = useState(false)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const flyoutTriggerRef = useRef<HTMLButtonElement>(null)

  // Close flyout on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node) && !flyoutTriggerRef.current?.contains(e.target as Node)) {
        setMandalaFlyout(false)
      }
    }
    if (mandalaFlyout) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mandalaFlyout])

  // Close flyout when navigating
  useEffect(() => { setMandalaFlyout(false) }, [pathname])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname?.startsWith(href) ?? false
  }

  return (
    <Sidebar collapsible="icon">
      {/* Logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Jadisatu</span>
                  <span className="text-xs text-muted-foreground">Business OS</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const active = isActive(item.href)

                if (item.subItems) {
                  const mandalaActive = pathname?.startsWith('/mandala') ?? false

                  // When sidebar is collapsed: show flyout popup on hover/click
                  if (isCollapsed) {
                    return (
                      <SidebarMenuItem key={item.href} className="relative">
                        <SidebarMenuButton
                          ref={flyoutTriggerRef}
                          isActive={mandalaActive}
                          tooltip={item.label}
                          onClick={() => setMandalaFlyout(!mandalaFlyout)}
                          onMouseEnter={() => setMandalaFlyout(true)}
                        >
                          <item.icon className="size-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>

                        {mandalaFlyout && (
                          <div
                            ref={flyoutRef}
                            onMouseLeave={() => setMandalaFlyout(false)}
                            className="fixed z-50 ml-1 w-52 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 py-2 animate-in fade-in slide-in-from-left-2 duration-150"
                            style={{ left: '52px', top: flyoutTriggerRef.current ? flyoutTriggerRef.current.getBoundingClientRect().top : 0 }}
                          >
                            <div className="px-3 py-1.5 mb-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mandala AI</p>
                            </div>
                            {item.subItems.map((sub) => (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className={cn(
                                  'flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg text-[13px] transition-colors',
                                  pathname === sub.href
                                    ? 'bg-blue-50 text-blue-700 font-semibold'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                )}
                              >
                                <sub.icon className="size-4 flex-shrink-0" />
                                {sub.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </SidebarMenuItem>
                    )
                  }

                  // When sidebar is expanded: normal collapsible
                  return (
                    <Collapsible key={item.href} defaultOpen={mandalaActive} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={mandalaActive} tooltip={item.label}>
                            <item.icon className="size-4" />
                            <span className="flex items-center gap-2">
                              {item.label}
                              {item.accent && !mandalaActive && (
                                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                              )}
                            </span>
                            <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.subItems.map((sub) => (
                              <SidebarMenuSubItem key={sub.href}>
                                <SidebarMenuSubButton asChild isActive={pathname === sub.href}>
                                  <Link href={sub.href}>
                                    <sub.icon className="size-4" />
                                    <span>{sub.label}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                }

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/settings')} tooltip="Pengaturan">
                  <Link href="/settings">
                    <Settings className="size-4" />
                    <span>Pengaturan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: User + Logout */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={displayName}>
              <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-sm font-medium truncate">{displayName}</span>
                <span className="text-xs text-muted-foreground truncate">{user?.email || ''}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Logout"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
