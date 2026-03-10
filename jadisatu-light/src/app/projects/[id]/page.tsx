"use client";

import React, { useState, useEffect, use } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { createClient } from "@/lib/supabase-browser";
import {
  ArrowLeft, Plus, Check, Circle, Trash2, Folder,
  Flag, Edit3, Save, CheckCircle2, MoreVertical
} from "lucide-react";
import Link from "next/link";

interface Project {
  id: string; title: string; description: string | null; status: string; created_at: string;
}
interface Task {
  id: string; title: string; status: string; priority: string; domain: string; created_at: string;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { setUserId(data.user.id); loadProject(data.user.id); }
    });
  }, [id]);

  async function loadProject(uid?: string) {
    setLoading(true);
    const userIdToUse = uid || userId;
    if (!userIdToUse) return;

    const { data: proj } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (proj) {
      setProject(proj);
      setEditName(proj.title);
      setEditDesc(proj.description || "");
    }

    const { data: projectTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", id)
      .eq("user_id", userIdToUse)
      .order("created_at", { ascending: false });

    if (projectTasks) setTasks(projectTasks);
    setLoading(false);
  }

  async function saveProject() {
    if (!project || !editName.trim()) return;
    await supabase.from("projects").update({ title: editName.trim(), description: editDesc.trim() || null }).eq("id", project.id);
    setEditingName(false);
    await loadProject();
  }

  async function addTask() {
    if (!newTaskTitle.trim() || !userId) return;
    await supabase.from("tasks").insert({
      title: newTaskTitle.trim(),
      status: "todo",
      priority: "medium",
      domain: "personal",
      project_id: id,
      user_id: userId,
    });
    setNewTaskTitle("");
    await loadProject();
  }

  async function toggleTask(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === "done" ? "todo" : "done";
    await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    await loadProject();
  }

  async function deleteTask(taskId: string) {
    await supabase.from("tasks").delete().eq("id", taskId);
    await loadProject();
  }

  async function updateTaskStatus(taskId: string, status: string) {
    await supabase.from("tasks").update({ status }).eq("id", taskId);
    await loadProject();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopNav />
          <main className="flex-1 flex items-center justify-center"><p className="text-slate-500">Loading project...</p></main>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFC]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopNav />
          <main className="flex-1 flex items-center justify-center flex-col gap-4">
            <p className="text-slate-500">Project not found</p>
            <Link href="/projects" className="text-blue-600 font-medium hover:text-blue-700">← Back to Projects</Link>
          </main>
        </div>
      </div>
    );
  }

  const todoTasks = tasks.filter(t => t.status === "todo");
  const inProgressTasks = tasks.filter(t => t.status === "in-progress");
  const doneTasks = tasks.filter(t => t.status === "done");
  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Back + Header */}
            <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors">
              <ArrowLeft className="w-4 h-4" />Back to Projects
            </Link>

            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
              {editingName ? (
                <div className="space-y-3">
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full text-3xl font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20" autoFocus />
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Add a description..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none h-20" />
                  <div className="flex gap-2">
                    <button onClick={saveProject} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium"><Save className="w-4 h-4" />Save</button>
                    <button onClick={() => setEditingName(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Folder className="w-6 h-6 text-blue-600" />
                      <h1 className="text-3xl font-bold text-slate-900">{project.title}</h1>
                    </div>
                    <p className="text-slate-500 mb-4">{project.description || "No description"}</p>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${project.status === "active" ? "bg-blue-50 text-blue-600" : project.status === "completed" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>{project.status}</span>
                      <span className="text-sm text-slate-400">{new Date(project.created_at).toLocaleDateString()}</span>
                      <span className="text-sm text-slate-400">{tasks.length} tasks</span>
                    </div>
                  </div>
                  <button onClick={() => setEditingName(true)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"><Edit3 className="w-5 h-5" /></button>
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700">Progress</span>
                <span className="text-sm font-bold text-slate-900">{completionRate}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
              </div>
              <div className="flex gap-6 mt-3 text-xs text-slate-500">
                <span>{todoTasks.length} To Do</span>
                <span>{inProgressTasks.length} In Progress</span>
                <span>{doneTasks.length} Done</span>
              </div>
            </div>

            {/* Add Task */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Tasks</h2>
              <div className="flex gap-2 mb-4">
                <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Add a task to this project..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" />
                <button onClick={addTask} disabled={!newTaskTitle.trim()} className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"><Plus className="w-4 h-4" />Add</button>
              </div>

              {/* Task List */}
              <div className="space-y-2">
                {tasks.length === 0 && <p className="text-center text-sm text-slate-400 py-6">No tasks yet. Add one above!</p>}
                {tasks.map(task => (
                  <div key={task.id} className="group flex items-center gap-3 p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-100 rounded-xl transition-all">
                    <button onClick={() => toggleTask(task.id, task.status)} className="shrink-0">
                      {task.status === "done" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-slate-400 hover:text-blue-600" />}
                    </button>
                    <span className={`flex-1 text-sm font-medium ${task.status === "done" ? "line-through text-slate-400" : "text-slate-900"}`}>{task.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${task.priority === "high" ? "bg-red-50 text-red-600" : task.priority === "medium" ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"}`}>{task.priority}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${task.status === "done" ? "bg-emerald-50 text-emerald-600" : task.status === "in-progress" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>{task.status}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => updateTaskStatus(task.id, "in-progress")} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] rounded-md font-medium">Dikerjakan</button>
                      <button onClick={() => updateTaskStatus(task.id, "backlog")} className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 text-[10px] rounded-md font-medium">Ditunda</button>
                      <button onClick={() => deleteTask(task.id)} className="p-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
