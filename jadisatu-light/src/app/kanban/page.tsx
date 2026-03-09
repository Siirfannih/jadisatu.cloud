"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Plus, Flag, Folder, Calendar } from "lucide-react";

interface Task { id: string; title: string; status: string; priority: string; domain: string; assignee?: string; }

const columnConfig = [
  { id: "backlog", title: "Backlog", color: "bg-slate-100 text-slate-600" },
  { id: "todo", title: "To Do", color: "bg-slate-100 text-slate-600" },
  { id: "in-progress", title: "In Progress", color: "bg-blue-100 text-blue-700" },
  { id: "review", title: "In Review", color: "bg-orange-100 text-orange-700" },
  { id: "done", title: "Done", color: "bg-emerald-100 text-emerald-700" },
];

export default function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  const loadTasks = () => {
    fetch("/api/tasks?limit=200").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setTasks(data); }).catch(() => {});
  };
  useEffect(() => { loadTasks(); }, []);

  const addTask = async (status: string) => {
    if (!newTitle.trim()) return;
    await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTitle, status, priority: "medium" }) });
    setNewTitle(""); setAddingTo(null); loadTasks();
  };

  const moveTask = async (taskId: string, newStatus: string) => {
    await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: taskId, status: newStatus }) });
    loadTasks();
  };

  const handleDragStart = (taskId: string) => setDraggedTask(taskId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (columnId: string) => { if (draggedTask) { moveTask(draggedTask, columnId); setDraggedTask(null); } };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-[1600px] mx-auto h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div><h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Kanban Board</h1><p className="text-slate-500">Visualize your workflow and progress.</p></div>
            </div>
            <div className="flex-1 overflow-x-auto pb-4">
              <div className="flex gap-5 min-w-max h-full">
                {columnConfig.map((column) => {
                  const colTasks = tasks.filter((t) => t.status === column.id);
                  return (
                    <div key={column.id} className="w-[300px] flex flex-col h-full" onDragOver={handleDragOver} onDrop={() => handleDrop(column.id)}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 text-sm">{column.title}</h3>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${column.color}`}>{colTasks.length}</span>
                        </div>
                      </div>
                      <div className="flex-1 bg-slate-100/50 rounded-2xl p-2.5 space-y-2.5">
                        {colTasks.map((task) => (
                          <div key={task.id} draggable onDragStart={() => handleDragStart(task.id)} className="group bg-white p-3.5 rounded-xl shadow-sm border border-slate-100 hover:border-blue-100 hover:shadow-md transition-all cursor-grab active:cursor-grabbing">
                            <div className="flex items-start justify-between mb-2">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide flex items-center gap-1 ${task.priority === "high" ? "bg-red-50 text-red-600" : task.priority === "medium" ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"}`}>
                                <Flag className="w-2.5 h-2.5" />{task.priority}
                              </span>
                            </div>
                            <h4 className="font-semibold text-slate-900 text-sm mb-3 leading-snug">{task.title}</h4>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                              <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md"><Folder className="w-3 h-3" /><span className="truncate max-w-[80px]">{task.domain || "personal"}</span></div>
                              {task.assignee && <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md">{task.assignee}</div>}
                            </div>
                          </div>
                        ))}
                        {addingTo === column.id ? (
                          <div className="p-2.5 bg-white rounded-xl border border-blue-200">
                            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask(column.id)} placeholder="Task title..." className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 mb-2" autoFocus />
                            <div className="flex gap-2">
                              <button onClick={() => addTask(column.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium">Add</button>
                              <button onClick={() => { setAddingTo(null); setNewTitle(""); }} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setAddingTo(column.id)} className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all font-medium text-xs">
                            <Plus className="w-3.5 h-3.5" />Add Task
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
