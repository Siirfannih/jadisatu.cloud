"use client";

import React, { useState, useEffect } from "react";
import { Check, Plus } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  domain: string;
  created_at: string;
}

export function TasksList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [filter, setFilter] = useState<"all" | "pending">("pending");

  const loadTasks = () => {
    fetch("/api/tasks?limit=20&status=active")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
      })
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
    loadTasks();
  };

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status: newStatus }),
    });
    loadTasks();
  };

  const displayTasks = filter === "pending" ? tasks.filter((t) => t.status !== "done") : tasks;
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Today&apos;s Tasks</h2>
          <p className="text-sm text-slate-500 mt-1">{today}</p>
        </div>
        <div className="flex items-center bg-slate-50 p-1 rounded-xl">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${filter === "all" ? "bg-blue-100 text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${filter === "pending" ? "bg-blue-100 text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            Pending
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {displayTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-blue-100 transition-colors bg-white"
          >
            <button
              onClick={() => toggleTask(task)}
              className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                task.status === "done"
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-slate-300 hover:border-blue-500"
              }`}
            >
              {task.status === "done" && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${
                    task.priority === "high" ? "bg-red-50 text-red-600" :
                    task.priority === "medium" ? "bg-orange-50 text-orange-600" :
                    "bg-blue-50 text-blue-600"
                  }`}
                >
                  {task.priority}
                </span>
                <h4 className={`text-sm font-semibold ${task.status === "done" ? "text-slate-900 line-through opacity-70" : "text-slate-900"}`}>
                  {task.title}
                </h4>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <span>{task.domain || "personal"}</span>
                <span>•</span>
                <span>{task.status}</span>
              </div>
            </div>
          </div>
        ))}

        {displayTasks.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">No tasks yet. Add one below!</p>
        )}

        <div className="flex gap-2 mt-4">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add a new task..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
          />
          <button
            onClick={addTask}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
