"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { createClient } from "@/lib/supabase-browser";
import { Search, Plus, LayoutGrid, List, Hash, ChevronDown, ChevronUp, Trash2, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface Note {
  id: string; title: string; content: string; tags: string[]; source: string; status: string; created_at: string;
}

export default function NotesPage() {
  const supabase = createClient();
  const [notes, setNotes] = useState<Note[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [newNote, setNewNote] = useState("");
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { setUserId(data.user.id); loadNotes(data.user.id); }
    });
  }, []);

  async function loadNotes(uid?: string) {
    const id = uid || userId;
    if (!id) return;
    const { data } = await supabase.from("ideas").select("*").eq("user_id", id).eq("status", "active").order("created_at", { ascending: false });
    if (data) setNotes(data);
  }

  async function addNote() {
    if (!newNote.trim() || !userId) return;
    const tags = newNote.match(/#\w+/g)?.map(t => t.slice(1)) || [];
    const title = newNote.replace(/#\w+/g, "").trim();
    await supabase.from("ideas").insert({ title: title || newNote.trim(), tags, source: "notes", status: "active", user_id: userId });
    setNewNote("");
    await loadNotes();
  }

  async function deleteNote(id: string) {
    await supabase.from("ideas").update({ status: "deleted" }).eq("id", id);
    if (expandedNote === id) setExpandedNote(null);
    await loadNotes();
  }

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">Notes</h1>
                <p className="text-slate-500">Capture ideas and thoughts quickly.</p>
              </div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl">
                <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-lg transition-colors", viewMode === "list" ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600")}><List className="w-4 h-4" /></button>
                <button onClick={() => setViewMode("grid")} className={cn("p-2 rounded-lg transition-colors", viewMode === "grid" ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600")}><LayoutGrid className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Quick Capture */}
            <div className="bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <Plus className="text-slate-400 ml-3 shrink-0" size={20} />
              <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()} placeholder="Capture a quick note... (Press Enter, use #tags)" className="flex-1 bg-transparent border-none outline-none py-3 text-base placeholder:text-slate-400" />
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search notes or #tags..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>

            {/* Notes */}
            {filtered.length === 0 && (
              <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
                <StickyNote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No notes yet</h3>
                <p className="text-sm text-slate-500">Capture your first thought above!</p>
              </div>
            )}

            {viewMode === "list" ? (
              <div className="space-y-3">
                {filtered.map(note => (
                  <div key={note.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:border-blue-100">
                    <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 mb-1">{note.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          {note.tags?.map(tag => <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">#{tag}</span>)}
                          <span className="text-xs text-slate-400">{new Date(note.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.stopPropagation(); deleteNote(note.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                        {expandedNote === note.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>
                    {expandedNote === note.id && (
                      <div className="px-4 pb-4 border-t border-slate-50">
                        <p className="text-slate-600 text-sm leading-relaxed pt-3 whitespace-pre-wrap">{note.content || "No content"}</p>
                        <div className="mt-3 text-xs text-slate-400">Source: {note.source} · {new Date(note.created_at).toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(note => (
                  <div key={note.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-900 line-clamp-2">{note.title}</h3>
                      <button onClick={() => deleteNote(note.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    {note.content && <p className="text-sm text-slate-500 mb-3 line-clamp-3">{note.content}</p>}
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex gap-1 flex-wrap">{(note.tags || []).slice(0, 3).map(tag => <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold">#{tag}</span>)}</div>
                      <span className="text-[10px] text-slate-400">{new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
