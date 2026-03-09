"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Search, Plus, Hash, Type, List, Image as ImageIcon, Link as LinkIcon, MoreVertical } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

interface Note {
  id: string;
  title: string;
  content?: string;
  tags?: string;
  status: string;
  created_at: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from("ideas").select("*").eq("user_id", data.user.id).eq("status", "active").order("created_at", { ascending: false })
          .then(({ data: notes }) => {
            if (notes) { setNotes(notes); if (notes.length > 0) setSelected(notes[0]); }
          });
      }
    });
  }, []);

  const filtered = notes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-hidden flex flex-col p-8">
          <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-8 shrink-0">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Notes</h1>
                <p className="text-slate-500">Capture ideas, meeting minutes, and drafts.</p>
              </div>
              <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-sm">
                <Plus className="w-5 h-5" /><span>New Note</span>
              </button>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
              <div className="w-80 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes..." className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filtered.map((note) => (
                    <div key={note.id} onClick={() => setSelected(note)} className={`p-4 rounded-2xl cursor-pointer transition-colors ${selected?.id === note.id ? "bg-blue-50 border border-blue-100" : "hover:bg-slate-50 border border-transparent"}`}>
                      <h3 className={`font-semibold text-sm mb-1 line-clamp-1 ${selected?.id === note.id ? "text-blue-900" : "text-slate-900"}`}>{note.title}</h3>
                      <p className={`text-xs line-clamp-2 mb-3 ${selected?.id === note.id ? "text-blue-700/70" : "text-slate-500"}`}>{note.content || "Empty note"}</p>
                      <span className={`text-[10px] font-medium ${selected?.id === note.id ? "text-blue-600" : "text-slate-400"}`}>{new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                  {filtered.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No notes yet</p>}
                </div>
              </div>

              <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 shrink-0">
                  <div className="flex items-center gap-1">
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><Type className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><List className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-slate-200 mx-2"></div>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><ImageIcon className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><LinkIcon className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-10">
                  <div className="max-w-2xl mx-auto">
                    {selected ? (
                      <>
                        {selected.tags && (
                          <div className="flex items-center gap-2 mb-6">
                            {selected.tags.split(",").map((tag) => (
                              <span key={tag} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <Hash className="w-3 h-3" /> {tag.trim().replace("#", "")}
                              </span>
                            ))}
                          </div>
                        )}
                        <h1 className="text-4xl font-bold text-slate-900 mb-6">{selected.title}</h1>
                        <div className="prose prose-slate prose-blue max-w-none">
                          <p className="text-slate-600 text-lg leading-relaxed">{selected.content || "Start writing..."}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-400 text-center py-20">Select a note or create a new one</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
