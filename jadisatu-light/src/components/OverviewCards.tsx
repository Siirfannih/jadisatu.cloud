"use client";

import React, { useState, useEffect } from "react";
import { Check, Rocket, Clock, PenTool } from "lucide-react";

interface Stats {
  tasksCompleted: number;
  activeProjects: number;
  totalTasks: number;
}

export function OverviewCards() {
  const [stats, setStats] = useState<Stats>({ tasksCompleted: 0, activeProjects: 0, totalTasks: 0 });

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks?limit=100&status=done").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/tasks?limit=100").then((r) => r.json()),
    ]).then(([doneTasks, projects, allTasks]) => {
      setStats({
        tasksCompleted: Array.isArray(doneTasks) ? doneTasks.length : 0,
        activeProjects: Array.isArray(projects) ? projects.filter((p: any) => p.status === "active").length : 0,
        totalTasks: Array.isArray(allTasks) ? allTasks.length : 0,
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-50 rounded-full opacity-50"></div>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 relative z-10">
          <Check className="w-6 h-6 text-blue-600" strokeWidth={3} />
        </div>
        <p className="text-sm text-slate-500 font-medium mb-2 relative z-10">Tasks Completed</p>
        <div className="flex items-baseline gap-3 relative z-10">
          <h3 className="text-4xl font-bold text-slate-900 tracking-tight">{stats.tasksCompleted}</h3>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-50 rounded-full opacity-50"></div>
        <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mb-6 relative z-10">
          <Rocket className="w-6 h-6 text-purple-600" />
        </div>
        <p className="text-sm text-slate-500 font-medium mb-2 relative z-10">Active Projects</p>
        <div className="flex items-baseline gap-3 relative z-10">
          <h3 className="text-4xl font-bold text-slate-900 tracking-tight">{stats.activeProjects}</h3>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-orange-50 rounded-full opacity-50"></div>
        <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-6 relative z-10">
          <Clock className="w-6 h-6 text-orange-500" />
        </div>
        <p className="text-sm text-slate-500 font-medium mb-2 relative z-10">Total Tasks</p>
        <div className="flex items-baseline gap-3 relative z-10">
          <h3 className="text-4xl font-bold text-slate-900 tracking-tight">{stats.totalTasks}</h3>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-pink-50 rounded-full opacity-50"></div>
        <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center mb-6 relative z-10">
          <PenTool className="w-6 h-6 text-pink-500" />
        </div>
        <p className="text-sm text-slate-500 font-medium mb-2 relative z-10">Domains</p>
        <div className="flex items-baseline gap-3 relative z-10">
          <h3 className="text-4xl font-bold text-slate-900 tracking-tight">—</h3>
        </div>
      </div>
    </div>
  );
}
