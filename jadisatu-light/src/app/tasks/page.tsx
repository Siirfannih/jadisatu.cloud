"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Plus, Filter, SortDesc, Check, MoreHorizontal, Calendar, Folder, Flag, Trash2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  domain: string;
  created_at: string;
  project_id?: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState("all");
  const [newTitle, setNewTitle] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const loadTasks = () => {
    fetch("/api/tasks?limit=50")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setTasks(data); })
      .catch(() => {});
  };

  useEffect(() => { loadTasks(); }, []);

  const addTask = async () => {
    if (!newTitle.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, status: "todo", priority: "medium" }),
    });
    setNewTitle("");
    setShowAdd(false);
    loadTasks();
  };

  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";

    if (newStatus === "done") {
      setCompletingIds((prev) => new Set(prev).add(task.id));
      setTimeout(() => {
        setFadingIds((prev) => new Set(prev).add(task.id));
      }, 800);
      setTimeout(async () => {
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task.id, status: newStatus }),
        });
        setCompletingIds((prev) => { const s = new Set(prev); s.delete(task.id); return s; });
        setFadingIds((prev) => { const s = new Set(prev); s.delete(task.id); return s; });
        loadTasks();
      }, 1400);
    } else {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      });
      loadTasks();
    }
  };

  const deleteTask = async (id: string) => {
    setFadingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      setFadingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      loadTasks();
    }, 600);
  };

  const filtered = tab === "all" ? tasks :
    tab === "todo" ? tasks.filter((t) => t.status === "todo") :
    tab === "in_progress" ? tasks.filter((t) => t.status === "in-progress") :
    tasks.filter((t) => t.status === "done");

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Tasks</h1>
                <p className="text-slate-500">Manage your to-dos and priorities.</p>
              </div>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                <span>New Task</span>
              </button>
            </div>

            {showAdd && (
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTask()}
                    placeholder="Task title..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                  />
                  <button onClick={addTask} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">Add</button>
                  <button onClick={() => setShowAdd(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
                  {[
                    { key: "all", label: "All Tasks" },
                    { key: "todo", label: "To Do" },
                    { key: "in_progress", label: "In Progress" },
                    { key: "done", label: "Done" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`pb-4 -mb-[18px] ${tab === t.key ? "text-blue-600 border-b-2 border-blue-600" : "hover:text-slate-900"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {filtered.map((task) => {
                  const isCompleting = completingIds.has(task.id);
                  const isFading = fadingIds.has(task.id);
                  return (
                  <div key={task.id} className={`group flex items-start gap-4 p-4 rounded-2xl border border-slate-100 hover:border-blue-100 hover:shadow-sm transition-all bg-white ${isCompleting ? "task-completing bg-emerald-50/50 border-emerald-100" : ""} ${isFading ? "task-fade-out" : ""}`}>
                    <button
                      onClick={() => toggleTask(task)}
                      className={`mt-1 w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${task.status === "done" || isCompleting ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-blue-500"} ${isCompleting ? "check-pop" : ""}`}
                    >
                      {(task.status === "done" || isCompleting) && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </button>
                    {isCompleting && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 rounded-full bg-emerald-400/20 confetti-burst" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <h4 className={`task-title text-base font-semibold ${task.status === "done" ? "text-slate-500 line-through" : isCompleting ? "text-slate-500" : "text-slate-900"}`}>
                          {task.title}
                        </h4>
                        <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium">
                        <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg">
                          <Folder className="w-3.5 h-3.5" />
                          <span>{task.domain || "personal"}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                          task.priority === "high" ? "bg-red-50 text-red-600" :
                          task.priority === "medium" ? "bg-orange-50 text-orange-600" :
                          "bg-blue-50 text-blue-600"
                        }`}>
                          <Flag className="w-3.5 h-3.5" />
                          <span>{task.priority}</span>
                        </div>
                        <div className={`ml-auto px-2.5 py-1 rounded-lg uppercase tracking-wider text-[10px] font-bold ${
                          task.status === "done" ? "bg-emerald-50 text-emerald-600" :
                          task.status === "in-progress" ? "bg-blue-50 text-blue-600" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {task.status.replace("-", " ")}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-center text-slate-400 py-8 text-sm">No tasks in this category.</p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
