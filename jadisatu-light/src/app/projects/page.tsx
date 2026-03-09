"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Plus, Folder, Clock, ListTodo, CheckCircle2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
}

const colors = [
  { color: "bg-blue-500", textColor: "text-blue-600", bgColor: "bg-blue-50" },
  { color: "bg-purple-500", textColor: "text-purple-600", bgColor: "bg-purple-50" },
  { color: "bg-orange-500", textColor: "text-orange-600", bgColor: "bg-orange-50" },
  { color: "bg-emerald-500", textColor: "text-emerald-600", bgColor: "bg-emerald-50" },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const loadProjects = () => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setProjects(data); })
      .catch(() => {});
  };

  useEffect(() => { loadProjects(); }, []);

  const addProject = async () => {
    if (!newName.trim()) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc, status: "active" }),
    });
    setNewName("");
    setNewDesc("");
    setShowAdd(false);
    loadProjects();
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
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Projects</h1>
                <p className="text-slate-500">Track and manage all your active projects.</p>
              </div>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5" />
                <span>New Project</span>
              </button>
            </div>

            {showAdd && (
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Project name..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" autoFocus />
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none h-20" />
                <div className="flex gap-3">
                  <button onClick={addProject} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium transition-colors">Create</button>
                  <button onClick={() => setShowAdd(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project, i) => {
                const c = colors[i % colors.length];
                return (
                  <div key={project.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-2xl ${c.bgColor} flex items-center justify-center ${c.textColor}`}>
                        <Folder className="w-6 h-6" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{project.name}</h3>
                    <p className="text-sm text-slate-500 mb-6 line-clamp-2 flex-1">{project.description || "No description"}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                        project.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                        project.status === "active" ? "bg-blue-50 text-blue-600" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {project.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                        {project.status}
                      </span>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => setShowAdd(true)}
                className="bg-slate-50 rounded-3xl p-6 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer min-h-[240px]"
              >
                <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm mb-4">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="font-semibold text-lg">Create New Project</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
