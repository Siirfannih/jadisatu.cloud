"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Plus, Search, Type, List, Image as ImageIcon, Link as LinkIcon, Hash } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

interface Idea {
  id: string;
  title: string;
  content?: string;
  tags?: string;
  status: string;
  created_at: string;
}

export default function CreativeHubPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selected, setSelected] = useState<Idea | null>(null);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from("ideas")
          .select("*")
          .eq("user_id", data.user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .then(({ data: ideas }) => {
            if (ideas) {
              setIdeas(ideas);
              if (ideas.length > 0) setSelected(ideas[0]);
            }
          });
      }
    });
  }, []);

  const filtered = ideas.filter((i) =>
    i.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-hidden flex flex-col p-8">
          <div className="max-w-[1600px] mx-auto w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-8 shrink-0">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Creative Hub</h1>
                <p className="text-slate-500">Manage ideas, scripts, and content across platforms.</p>
              </div>
              <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-sm">
                <Plus className="w-5 h-5" />
                <span>New Content</span>
              </button>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
              <div className="w-80 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search content..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filtered.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className={`p-3 rounded-2xl cursor-pointer transition-colors flex gap-3 ${
                        selected?.id === item.id ? "bg-blue-50 border border-blue-100" : "hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      <div className="flex-1 min-w-0 py-0.5">
                        <h3 className={`font-semibold text-sm mb-1 line-clamp-1 ${selected?.id === item.id ? "text-blue-900" : "text-slate-900"}`}>
                          {item.title}
                        </h3>
                        <span className={`text-[10px] font-medium ${selected?.id === item.id ? "text-blue-600" : "text-slate-400"}`}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-center text-sm text-slate-400 py-8">No content yet</p>
                  )}
                </div>
              </div>

              <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 shrink-0">
                  <div className="flex items-center gap-1">
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><Type className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><List className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-slate-200 mx-2"></div>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><ImageIcon className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><LinkIcon className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-10">
                  <div className="max-w-3xl mx-auto">
                    {selected ? (
                      <>
                        <h1 className="text-4xl font-bold text-slate-900 mb-6">{selected.title}</h1>
                        <div className="prose prose-slate prose-blue max-w-none">
                          <p className="text-slate-600 text-lg leading-relaxed">
                            {selected.content || "No content yet. Start writing..."}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-400 text-center py-20">Select a note to view</p>
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
