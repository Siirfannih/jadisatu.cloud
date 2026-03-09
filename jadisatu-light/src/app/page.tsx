"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { OverviewCards } from "@/components/OverviewCards";
import { TasksList } from "@/components/TasksList";
import { CreativePreview } from "@/components/CreativePreview";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { FocusWidget } from "@/components/FocusWidget";
import { QuickNote } from "@/components/QuickNote";
import { createClient } from "@/lib/supabase-browser";
import { Plus } from "lucide-react";

export default function Dashboard() {
  const [userName, setUserName] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserName(data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "Creator");
        fetch("/api/init-user", { method: "POST" }).catch(() => {});
      }
    });
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-slate-500 font-medium mb-1">{greeting()}</p>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">
                  Welcome back{userName ? `, ${userName}` : ""}! 👋
                </h1>
                <p className="text-slate-500 text-lg">
                  Your personal dashboard for managing everything.
                </p>
              </div>
              <a
                href="/projects"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-medium transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                <span>New Project</span>
              </a>
            </div>

            <OverviewCards />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <TasksList />
                <CreativePreview />
              </div>
              <div className="space-y-8">
                <FocusWidget />
                <ActivityTimeline />
                <QuickNote />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
