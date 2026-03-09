"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/lib/supabase";
import { Search, Plus, LayoutGrid, List, Tag, Hash, Type, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Idea { id: string; title: string; content: string; tags: string[]; source: string; status: string; created_at: string; }

export default function NotesPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [newIdea, setNewIdea] = useState("");
  const [selected, setSelected] = useState<Idea | null>(null);

  useEffect(() => { loadIdeas(); }, []);

  async function loadIdeas() {
    const { data } = await supabase.from("ideas").select("*").eq("status", "active").order("created_at", { ascending: false });
    if (data) { setIdeas(data); if (data.length > 0 && !selected) setSelected(data[0]); }
  }

  async function addIdea() {
    if (!newIdea.trim()) return;
    const tags = newIdea.match(/#\w+/g)?.map((t) => t.slice(1)) || [];
    const title = newIdea.replace(/#\w+/g, "").trim();
    await supabase.from("ideas").insert({ title, tags, source: "manual", status: "active" });
    setNewIdea("");
    loadIdeas();
  }

  const filtered = ideas.filter((i) =>
    i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-hidden flex flex-col p-8">
          <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div><h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Ideas & Notes</h1><p className="text-slate-500">Capture everything, organize later.</p></div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl">
                <button onClick={() => setViewMode("grid")} className={cn("p-2 rounded-lg transition-colors", viewMode === "grid" ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600")}><LayoutGrid className="w-4 h-4" /></button>
                <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-lg transition-colors", viewMode === "list" ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600")}><List className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Quick Add */}
            <div className="relative mb-6 shrink-0">
              <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <Plus className="text-slate-400 ml-2 shrink-0" size={20} />
                <input type="text" value={newIdea} onChange={(e) => setNewIdea(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addIdea()} placeholder="Capture a quick idea... (Press Enter to save, use #tags)" className="flex-1 bg-transparent border-none outline-none py-3 text-base placeholder:text-slate-400" />
              </div>
            </div>

            {viewMode === "list" ? (
              <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                {/* Notes List */}
                <div className="w-80 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
                  <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search ideas..." className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filtered.map((idea) => (
                      <div key={idea.id} onClick={() => setSelected(idea)} className={`p-4 rounded-2xl cursor-pointer transition-colors ${selected?.id === idea.id ? "bg-blue-50 border border-blue-100" : "hover:bg-slate-50 border border-transparent"}`}>
                        <h3 className={`font-semibold text-sm mb-1 line-clamp-1 ${selected?.id === idea.id ? "text-blue-900" : "text-slate-900"}`}>{idea.title}</h3>
                        {idea.tags && idea.tags.length > 0 && (
                          <div className="flex gap-1 mb-2 flex-wrap">{idea.tags.slice(0, 3).map((tag) => (<span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold uppercase">#{tag}</span>))}</div>
                        )}
                        <span className={`text-[10px] font-medium ${selected?.id === idea.id ? "text-blue-600" : "text-slate-400"}`}>{new Date(idea.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                    {filtered.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No ideas yet. Capture one above!</p>}
                  </div>
                </div>

                {/* Editor */}
                <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                  <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-1">
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><Type className="w-4 h-4" /></button>
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><ImageIcon className="w-4 h-4" /></button>
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><LinkIcon className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10">
                    <div className="max-w-2xl mx-auto">
                      {selected ? (
                        <>
                          {selected.tags && selected.tags.length > 0 && (
                            <div className="flex items-center gap-2 mb-6 flex-wrap">{selected.tags.map((tag) => (<span key={tag} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Hash className="w-3 h-3" />{tag}</span>))}</div>
                          )}
                          <h1 className="text-4xl font-bold text-slate-900 mb-6">{selected.title}</h1>
                          <div className="prose prose-slate prose-blue max-w-none">
                            <p className="text-slate-600 text-lg leading-relaxed">{selected.content || "Start writing..."}</p>
                          </div>
                          <div className="mt-6 text-xs text-slate-400">Source: {selected.source || "manual"} • {new Date(selected.created_at).toLocaleString()}</div>
                        </>
                      ) : (
                        <p className="text-slate-400 text-center py-20">Select a note or create a new one</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Grid View */
              <div className="flex-1 overflow-y-auto">
                <div className="relative mb-4">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search ideas..." className="w-full max-w-xs pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((idea) => (
                    <div key={idea.id} onClick={() => { setSelected(idea); setViewMode("list"); }} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer">
                      <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2">{idea.title}</h3>
                      {idea.content && <p className="text-sm text-slate-500 mb-3 line-clamp-3">{idea.content}</p>}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1 flex-wrap">{(idea.tags || []).slice(0, 3).map((tag) => (<span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold">#{tag}</span>))}</div>
                        <span className="text-[10px] text-slate-400">{new Date(idea.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && <div className="col-span-3 py-12 text-center text-slate-400">No ideas yet</div>}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
