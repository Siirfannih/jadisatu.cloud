"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Filter, Calendar, FileEdit, CheckCircle2, MessageSquare, GitCommit } from "lucide-react";

interface Activity {
  id: string;
  action: string;
  description: string;
  created_at: string;
  type?: string;
}

export default function HistoryPage() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    fetch("/api/activities?limit=50")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setActivities(data); })
      .catch(() => {});
  }, []);

  const iconMap: Record<string, { icon: typeof FileEdit; color: string; bg: string }> = {
    comment: { icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-50" },
    commit: { icon: GitCommit, color: "text-purple-500", bg: "bg-purple-50" },
    edit: { icon: FileEdit, color: "text-orange-500", bg: "bg-orange-50" },
    complete: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
  };

  const grouped = activities.reduce((acc, a) => {
    const date = new Date(a.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    if (!acc[date]) acc[date] = [];
    acc[date].push(a);
    return acc;
  }, {} as Record<string, Activity[]>);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">History</h1>
                <p className="text-slate-500">A timeline of all your activities and updates.</p>
              </div>
            </div>

            {Object.keys(grouped).length === 0 && (
              <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
                <p className="text-slate-400">No activity recorded yet</p>
              </div>
            )}

            {Object.entries(grouped).map(([date, acts]) => (
              <div key={date}>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">{date}</h3>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-100">
                    {acts.map((activity) => {
                      const { icon: Icon, color, bg } = iconMap[activity.type || "edit"] || iconMap.edit;
                      return (
                        <div key={activity.id} className="relative flex items-start gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-white shrink-0 relative z-10">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bg}`}>
                              <Icon className={`w-4 h-4 ${color}`} />
                            </div>
                          </div>
                          <div className="flex-1 pt-1.5">
                            <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{activity.action}</span> {activity.description}</p>
                            <span className="text-xs text-slate-400 mt-1 block">{new Date(activity.created_at).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
