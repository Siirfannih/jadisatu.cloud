"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import {
  Target, Plus, CheckCircle2, Circle, Trash2, ChevronRight,
  Briefcase, GraduationCap, DollarSign, User, Clock, Activity,
  LayoutDashboard
} from "lucide-react";

type Task = { id: string; title: string; status: string; domain: string; priority: string; project_id: string | null; created_at: string; };
type Domain = { id: string; name: string; display_name: string; color: string | null; total_tasks: number; completed_tasks: number; progress_percentage: number; };
type Project = { id: string; name: string; description: string | null; status: string; };
type ActivityItem = { id: string; type: string; description: string; created_at: string; };

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    if (error || !authUser) { router.push("/login"); return; }
    setUser(authUser);
    fetch("/api/init-user", { method: "POST" }).catch(() => {});
    await loadDashboardData();
  }

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [tasksRes, domainsRes, projectsRes, activitiesRes] = await Promise.all([
        fetch("/api/tasks?status=active&limit=100"),
        fetch("/api/domains"),
        fetch("/api/projects"),
        fetch("/api/activities?limit=5"),
      ]);
      if (tasksRes.ok) { const d = await tasksRes.json(); setTasks(Array.isArray(d) ? d : []); }
      if (domainsRes.ok) { const d = await domainsRes.json(); setDomains(Array.isArray(d) ? d : []); }
      if (projectsRes.ok) { const d = await projectsRes.json(); setProjects(Array.isArray(d) ? d : []); }
      if (activitiesRes.ok) { const d = await activitiesRes.json(); setActivities(Array.isArray(d) ? d : []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTaskTitle, status: "todo", priority: "medium", domain: "personal" }) });
    setNewTaskTitle("");
    setAddingTask(false);
    await loadDashboardData();
  }

  async function handleToggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === "done" ? "todo" : "done";
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, status: newStatus }) });
    await loadDashboardData();
  }

  async function handleUpdateTaskStatus(taskId: string, status: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, status }) });
    await loadDashboardData();
  }

  async function handleDeleteTask(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
  }

  const getDomainIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case "work": return <Briefcase className="w-5 h-5" />;
      case "learn": return <GraduationCap className="w-5 h-5" />;
      case "business": return <DollarSign className="w-5 h-5" />;
      case "personal": return <User className="w-5 h-5" />;
      default: return <Target className="w-5 h-5" />;
    }
  };

  const getDomainStyle = (name: string) => {
    const n = name.toLowerCase();
    if (n === "work") return { icon: "text-blue-600 bg-blue-50", bar: "bg-blue-500", card: "border-blue-100" };
    if (n === "learn") return { icon: "text-amber-600 bg-amber-50", bar: "bg-amber-500", card: "border-amber-100" };
    if (n === "business") return { icon: "text-emerald-600 bg-emerald-50", bar: "bg-emerald-500", card: "border-emerald-100" };
    if (n === "personal") return { icon: "text-violet-600 bg-violet-50", bar: "bg-violet-500", card: "border-violet-100" };
    return { icon: "text-slate-600 bg-slate-50", bar: "bg-slate-500", card: "border-slate-100" };
  };

  const focusTasks = tasks.filter(t => t.status !== "done" && t.status !== "completed").slice(0, 3);
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Creator";
  const greeting = () => { const h = new Date().getHours(); if (h < 12) return "Good morning"; if (h < 17) return "Good afternoon"; return "Good evening"; };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <p className="text-slate-500 text-lg">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 font-medium mb-1">{greeting()}</p>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">Welcome back, {userName}! 👋</h1>
                <p className="text-slate-500 text-lg">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
              <a href="/projects" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-medium transition-colors shadow-sm">
                <Plus className="w-5 h-5" /><span>New Project</span>
              </a>
            </div>

            {/* Domain Cards */}
            {domains.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {domains.map((domain) => {
                  const style = getDomainStyle(domain.name);
                  return (
                    <div key={domain.id} className={`bg-white rounded-3xl p-6 border ${style.card} shadow-sm hover:shadow-md transition-all`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${style.icon}`}>{getDomainIcon(domain.name)}</div>
                        <span className="text-2xl font-bold text-slate-900">{domain.progress_percentage}%</span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">{domain.display_name}</h3>
                      <p className="text-sm text-slate-500 mb-3">{domain.completed_tasks} / {domain.total_tasks} tasks</p>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${domain.progress_percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {domains.length === 0 && (
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm text-center">
                <LayoutDashboard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No domains yet</h3>
                <p className="text-sm text-slate-500">Domains will be created automatically when you add tasks.</p>
              </div>
            )}

            {/* Today's Focus */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-bold text-slate-900">Today&apos;s Focus</h2>
                </div>
                {focusTasks.length > 0 && <span className="text-sm text-slate-500">{focusTasks.length} priority tasks</span>}
              </div>

              <div className="mb-4 flex gap-2">
                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddTask()} placeholder="Add a new task..." disabled={addingTask} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" />
                <button onClick={handleAddTask} disabled={addingTask || !newTaskTitle.trim()} className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />Add</button>
              </div>

              {focusTasks.length === 0 ? (
                <div className="text-center py-8"><Target className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-500">No tasks yet. Add your first task above!</p></div>
              ) : (
                <div className="space-y-2">
                  {focusTasks.map((task) => (
                    <div key={task.id} className="group flex items-center gap-3 p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-100 rounded-2xl transition-all">
                      <button onClick={() => handleToggleTask(task.id, task.status)} className="shrink-0">
                        {task.status === "done" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-slate-400 hover:text-blue-600" />}
                      </button>
                      <span className={`flex-1 text-sm font-medium ${task.status === "done" ? "line-through text-slate-400" : "text-slate-900"}`}>{task.title}</span>
                      <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-500">{task.domain}</span>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleUpdateTaskStatus(task.id, "in-progress")} className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs rounded-lg font-medium">Dikerjakan</button>
                        <button onClick={() => handleUpdateTaskStatus(task.id, "backlog")} className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 text-xs rounded-lg font-medium">Ditunda</button>
                        <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Projects */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3"><Briefcase className="w-5 h-5 text-blue-600" /><h2 className="text-xl font-bold text-slate-900">Active Projects</h2></div>
                <a href="/projects" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">View all<ChevronRight className="w-4 h-4" /></a>
              </div>
              {projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.slice(0, 3).map((project) => (
                    <div key={project.id} className="p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-100 rounded-2xl transition-all cursor-pointer">
                      <h3 className="font-semibold text-slate-900 mb-1">{project.name}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2">{project.description || "No description"}</p>
                      <div className="mt-3"><span className={`text-xs px-2 py-1 rounded-lg font-medium ${project.status === "active" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>{project.status}</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Briefcase className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500">No projects yet.</p>
                  <a href="/projects" className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1 inline-block">Create your first project →</a>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3"><Activity className="w-5 h-5 text-blue-600" /><h2 className="text-xl font-bold text-slate-900">Recent Activity</h2></div>
                <a href="/history" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">View all<ChevronRight className="w-4 h-4" /></a>
              </div>
              {activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900">{activity.description}</p>
                        <p className="text-xs text-slate-400 mt-1">{new Date(activity.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Activity className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500">No activity recorded yet. Actions you take will appear here.</p>
                </div>
              )}
            </div>

            {/* All Active Tasks */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-blue-600" /><h2 className="text-xl font-bold text-slate-900">All Active Tasks</h2></div>
                <span className="text-sm text-slate-500">{tasks.filter(t => t.status !== "done").length} remaining</span>
              </div>
              {tasks.filter(t => t.status !== "done" && t.status !== "completed").length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {tasks.filter(t => t.status !== "done" && t.status !== "completed").map((task) => (
                    <div key={task.id} className="group flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-100 rounded-xl transition-all">
                      <button onClick={() => handleToggleTask(task.id, task.status)} className="shrink-0"><Circle className="w-5 h-5 text-slate-400 hover:text-blue-600" /></button>
                      <span className="flex-1 text-sm text-slate-900">{task.title}</span>
                      <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-500">{task.domain}</span>
                      <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500">All caught up! Add tasks from Today&apos;s Focus above.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
