"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check, Rocket, Clock, PenTool, Plus, Calendar as CalendarIcon,
  MessageSquare, GitCommit, FileEdit, CheckCircle2, Circle,
  ArrowRight, Trash2, ChevronLeft, ChevronRight as ChevronRightIcon
} from "lucide-react";

type Task = { id: string; title: string; status: string; domain: string; priority: string; created_at: string; };
type Project = { id: string; name: string; description: string | null; status: string; };
type ActivityItem = { id: string; type?: string; action?: string; description: string; created_at: string; };
type Idea = { id: string; title: string; tags?: string[]; source: string; status: string; created_at: string; };
type ScheduleBlock = { id: string; title: string; start_time: string; end_time: string; domain: string | null; type: string; date: string; };

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [taskFilter, setTaskFilter] = useState<"all" | "pending">("pending");
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => { checkUser(); }, []);

  async function checkUser() {
    const { data: { user: u }, error } = await supabase.auth.getUser();
    if (error || !u) { router.push("/login"); return; }
    setUser(u);
    fetch("/api/init-user", { method: "POST" }).catch(() => {});
    await loadData();
  }

  async function loadData() {
    setLoading(true);
    const todayStr = new Date().toISOString().split("T")[0];
    const [tRes, pRes, aRes, sRes] = await Promise.all([
      fetch("/api/tasks?status=active&limit=100"),
      fetch("/api/projects"),
      fetch("/api/activities?limit=5"),
      fetch(`/api/schedule?date=${todayStr}`),
    ]);
    if (tRes.ok) { const d = await tRes.json(); setTasks(Array.isArray(d) ? d : []); }
    if (pRes.ok) { const d = await pRes.json(); setProjects(Array.isArray(d) ? d : []); }
    if (aRes.ok) { const d = await aRes.json(); setActivities(Array.isArray(d) ? d : []); }
    if (sRes.ok) { const d = await sRes.json(); setSchedule(Array.isArray(d) ? d : []); }

    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      const { data: ideasData } = await supabase.from("ideas").select("*").eq("user_id", u.id).neq("status", "deleted").order("created_at", { ascending: false }).limit(3);
      if (ideasData) setIdeas(ideasData);
    }
    setLoading(false);
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return;
    await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTaskTitle, status: "todo", priority: "medium", domain: "personal" }) });
    setNewTaskTitle("");
    await loadData();
  }

  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  async function toggleTask(id: string, status: string) {
    const ns = status === "done" ? "todo" : "done";
    if (ns === "done") {
      setCompletingIds(prev => new Set(prev).add(id));
      setTimeout(() => setFadingIds(prev => new Set(prev).add(id)), 800);
      setTimeout(async () => {
        await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: ns }) });
        setCompletingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
        setFadingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
        await loadData();
      }, 1400);
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: ns } : t));
      await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: ns }) });
      await loadData();
    }
  }

  async function deleteTask(id: string) {
    setFadingIds(prev => new Set(prev).add(id));
    setTimeout(async () => {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      setFadingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      setTasks(prev => prev.filter(t => t.id !== id));
    }, 600);
  }

  async function saveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      const tags = noteText.match(/#\w+/g)?.map(t => t.slice(1)) || [];
      const title = noteText.replace(/#\w+/g, "").trim();
      await supabase.from("ideas").insert({ title: title || noteText, tags, source: "quick-note", status: "active", user_id: u.id });
      setNoteText("");
    }
    setSavingNote(false);
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Creator";
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
  const completedCount = tasks.filter(t => t.status === "done").length;
  const activeProjectCount = projects.filter(p => p.status === "active").length;
  const pendingTasks = tasks.filter(t => t.status !== "done" && t.status !== "completed");
  const displayTasks = taskFilter === "pending" ? pendingTasks : tasks;
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const activityIcons: Record<string, { icon: typeof FileEdit; color: string; bg: string }> = {
    comment: { icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-50" },
    commit: { icon: GitCommit, color: "text-purple-500", bg: "bg-purple-50" },
    edit: { icon: FileEdit, color: "text-orange-500", bg: "bg-orange-50" },
    complete: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50" },
  };

  const ideaStyles = [
    { color: "text-purple-600", bg: "bg-purple-50" },
    { color: "text-blue-600", bg: "bg-blue-50" },
    { color: "text-orange-600", bg: "bg-orange-50" },
  ];

  if (loading) return <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center"><p className="text-slate-500 text-lg">Loading your dashboard...</p></div>;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 font-medium mb-1">{greeting()}</p>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">Welcome back, {userName}! 👋</h1>
                <p className="text-slate-500 text-lg">You have <span className="text-blue-600 font-medium">{pendingTasks.length} tasks</span> due today and <span className="text-purple-600 font-medium">{activeProjectCount} projects</span> in progress.</p>
              </div>
              <Link href="/projects" className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-medium transition-colors shadow-sm"><Plus className="w-5 h-5" /><span>New Project</span></Link>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-50 rounded-full opacity-50"></div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-6 relative z-10"><Check className="w-6 h-6 text-blue-600" strokeWidth={3} /></div>
                <p className="text-sm text-slate-500 font-medium mb-2 relative z-10">Tasks Completed</p>
                <div className="flex items-baseline gap-3 relative z-10"><h3 className="text-4xl font-bold text-slate-900 tracking-tight">{completedCount}</h3></div>
                <p className="text-xs text-slate-400 mt-2 relative z-10">this session</p>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-50 rounded-full opacity-50"></div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mb-6 relative z-10"><Rocket className="w-6 h-6 text-purple-600" /></div>
                <p className="text-sm text-slate-500 font-medium mb-2 relative z-10">Active Projects</p>
                <div className="flex items-baseline gap-3 relative z-10"><h3 className="text-4xl font-bold text-slate-900 tracking-tight">{activeProjectCount}</h3><span className="text-sm font-medium text-slate-400">{projects.length} total</span></div>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-orange-50 rounded-full opacity-50"></div>
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-6 relative z-10"><Clock className="w-6 h-6 text-orange-500" /></div>
                <p className="text-sm text-slate-500 font-medium mb-2 relative z-10">Pending Tasks</p>
                <div className="flex items-baseline gap-3 relative z-10 mb-4"><h3 className="text-4xl font-bold text-slate-900 tracking-tight">{pendingTasks.length}</h3></div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative z-10"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${tasks.length > 0 ? (pendingTasks.length / tasks.length) * 100 : 0}%` }}></div></div>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-pink-50 rounded-full opacity-50"></div>
                <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center mb-6 relative z-10"><PenTool className="w-6 h-6 text-pink-500" /></div>
                <p className="text-sm text-slate-500 font-medium mb-2 relative z-10">Creative Output</p>
                <div className="flex items-baseline gap-3 relative z-10"><h3 className="text-4xl font-bold text-slate-900 tracking-tight">{ideas.length}</h3><span className="text-sm font-medium text-slate-400">items</span></div>
              </div>
            </div>

            {/* Main Grid: 2/3 + 1/3 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* Today's Tasks */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div><h2 className="text-xl font-bold text-slate-900">Today&apos;s Tasks</h2><p className="text-sm text-slate-500 mt-1">{today}</p></div>
                    <div className="flex items-center bg-slate-50 p-1 rounded-xl">
                      <button onClick={() => setTaskFilter("all")} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${taskFilter === "all" ? "bg-blue-100 text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>All</button>
                      <button onClick={() => setTaskFilter("pending")} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${taskFilter === "pending" ? "bg-blue-100 text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>Pending</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {displayTasks.slice(0, 6).map(task => {
                      const isC = completingIds.has(task.id);
                      const isF = fadingIds.has(task.id);
                      return (
                      <div key={task.id} className={`group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-blue-100 transition-colors bg-white relative ${isC ? "task-completing bg-emerald-50/50 border-emerald-100" : ""} ${isF ? "task-fade-out" : ""}`}>
                        <button onClick={() => toggleTask(task.id, task.status)} className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${task.status === "done" || isC ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-blue-500"} ${isC ? "check-pop" : ""}`}>
                          {(task.status === "done" || isC) && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                        </button>
                        {isC && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-8 h-8 rounded-full bg-emerald-400/20 confetti-burst" /></div>}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${task.priority === "high" ? "bg-red-50 text-red-600" : task.priority === "medium" ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"}`}>{task.priority}</span>
                            <h4 className={`task-title text-sm font-semibold ${task.status === "done" ? "text-slate-500 line-through" : isC ? "text-slate-500" : "text-slate-900"}`}>{task.title}</h4>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5"><span>{task.domain}</span><span>•</span><span>{task.status}</span></div>
                        </div>
                        <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      );
                    })}
                    {displayTasks.length === 0 && <p className="text-center text-sm text-slate-400 py-6">No tasks yet</p>}
                    <div className="flex gap-2 mt-2">
                      <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Add a new task..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" />
                      <button onClick={addTask} disabled={!newTaskTitle.trim()} className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"><Plus className="w-4 h-4" />Add</button>
                    </div>
                  </div>
                </div>

                {/* Creative Preview */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div><h2 className="text-xl font-bold text-slate-900">Creative Hub</h2><p className="text-sm text-slate-500 mt-1">Recent drafts and ideas</p></div>
                    <Link href="/creative" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 bg-blue-50 px-4 py-2 rounded-xl">Open Hub <ArrowRight className="w-4 h-4" /></Link>
                  </div>
                  {ideas.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {ideas.map((idea, i) => {
                        const style = ideaStyles[i % ideaStyles.length];
                        return (
                          <Link href="/creative" key={idea.id} className="group rounded-2xl overflow-hidden border border-slate-100 hover:border-blue-100 hover:shadow-md transition-all cursor-pointer bg-white flex flex-col">
                            <div className={`aspect-[4/3] relative w-full overflow-hidden ${style.bg} flex items-center justify-center`}>
                              <PenTool className={`w-10 h-10 ${style.color} opacity-30`} />
                              {idea.tags && idea.tags[0] && (
                                <div className="absolute top-3 left-3"><span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/90 ${style.color}`}>{idea.tags[0]}</span></div>
                              )}
                            </div>
                            <div className="p-4"><h4 className="text-sm font-semibold text-slate-900 line-clamp-1">{idea.title}</h4></div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8"><PenTool className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-400">No creative content yet</p><Link href="/creative" className="text-sm text-blue-600 font-medium mt-1 inline-block">Create your first content →</Link></div>
                  )}
                </div>
              </div>

              {/* Right Sidebar Widgets */}
              <div className="space-y-8">
                {/* Calendar Widget */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-900">Calendar</h2>
                    <Link href="/calendar" className="text-sm font-medium text-blue-600 hover:text-blue-700">Full View</Link>
                  </div>
                  {/* Mini Calendar Header */}
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))} className="p-1 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-4 h-4 text-slate-400" /></button>
                    <span className="text-sm font-semibold text-slate-900">{selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                    <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))} className="p-1 hover:bg-slate-100 rounded-lg"><ChevronRightIcon className="w-4 h-4 text-slate-400" /></button>
                  </div>
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <div key={i} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
                    ))}
                  </div>
                  {/* Calendar Grid */}
                  {(() => {
                    const year = selectedDate.getFullYear();
                    const month = selectedDate.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const todayDate = new Date();
                    const isToday = (d: number) => todayDate.getFullYear() === year && todayDate.getMonth() === month && todayDate.getDate() === d;
                    const cells = [];
                    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
                    for (let d = 1; d <= daysInMonth; d++) {
                      cells.push(
                        <button key={d} className={`text-xs py-1.5 rounded-lg transition-colors ${isToday(d) ? "bg-blue-600 text-white font-bold" : "text-slate-700 hover:bg-slate-100"}`}>{d}</button>
                      );
                    }
                    return <div className="grid grid-cols-7 gap-1">{cells}</div>;
                  })()}
                  {/* Today's Schedule */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Today&apos;s Schedule</p>
                    {schedule.length > 0 ? (
                      <div className="space-y-2">
                        {schedule.map(s => (
                          <div key={s.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50">
                            <div className="w-1 h-8 rounded-full bg-blue-500 shrink-0"></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 line-clamp-1">{s.title}</p>
                              <p className="text-[10px] text-slate-400">{s.start_time} – {s.end_time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-2">No events today</p>
                    )}
                  </div>
                </div>

                {/* Activity */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6"><h2 className="text-lg font-bold text-slate-900">Activity</h2><Link href="/history" className="text-sm font-medium text-blue-600 hover:text-blue-700">View All</Link></div>
                  {activities.length > 0 ? (
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-100">
                      {activities.map(a => {
                        const ai = activityIcons[a.type || "edit"] || activityIcons.edit;
                        const Icon = ai.icon;
                        return (
                          <div key={a.id} className="relative flex items-start gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-white shrink-0 relative z-10"><div className={`w-8 h-8 rounded-full flex items-center justify-center ${ai.bg}`}><Icon className={`w-4 h-4 ${ai.color}`} /></div></div>
                            <div className="flex-1 pt-1.5"><p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{a.action || "Action"}</span> {a.description}</p><span className="text-xs text-slate-400 mt-1 block">{new Date(a.created_at).toLocaleString()}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>
                  )}
                </div>

                {/* Quick Note */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-slate-900">Quick Note</h2></div>
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)} className="w-full h-32 resize-none bg-slate-50 border-none rounded-2xl p-4 text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all" placeholder="Jot down an idea... (use #tags)"></textarea>
                  <div className="mt-4 flex justify-end"><button onClick={saveNote} disabled={savingNote || !noteText.trim()} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">{savingNote ? "Saving..." : "Save Note"}</button></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
