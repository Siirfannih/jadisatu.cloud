"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  KanbanSquare,
  FolderKanban,
  Lightbulb,
  Bot,
  Users,
  StickyNote,
  History,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LogOut,
} from "lucide-react";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase-browser";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Calendar, label: "Calendar", href: "/calendar" },
  { icon: CheckSquare, label: "Tasks", href: "/tasks" },
  { icon: KanbanSquare, label: "Kanban", href: "/kanban" },
  { icon: FolderKanban, label: "Projects", href: "/projects" },
  { icon: Lightbulb, label: "Creative Hub", href: "/creative" },
  { icon: Bot, label: "AI Agents", href: "/ai" },
  { icon: Users, label: "CRM", href: "/crm" },
  { icon: StickyNote, label: "Notes", href: "/notes" },
  { icon: History, label: "History", href: "/history" },
  { icon: Brain, label: "Context Hub", href: "/context" },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 260 }}
      className="h-screen sticky top-0 bg-white border-r border-slate-200 flex flex-col z-20 transition-all duration-300 ease-in-out"
    >
      <div className="p-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-semibold text-lg tracking-tight whitespace-nowrap text-slate-900"
            >
              Jadisatu
            </motion.span>
          )}
        </Link>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors absolute -right-3 top-7 bg-white border border-slate-200 shadow-sm"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={index}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`}
              />
              {!isCollapsed && (
                <span className="font-medium text-sm whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="p-3 mt-auto border-t border-slate-100 space-y-1">
        <Link
          href="/settings"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 group"
        >
          <Settings className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-slate-600" />
          {!isCollapsed && (
            <span className="font-medium text-sm whitespace-nowrap">Settings</span>
          )}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
        >
          <LogOut className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-red-500" />
          {!isCollapsed && (
            <span className="font-medium text-sm whitespace-nowrap">Logout</span>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
