"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { createClient } from "@/lib/supabase-browser";
import { Plus, Search, Type, List, Image as ImageIcon, Link as LinkIcon, Hash, Loader2, Trash2 } from "lucide-react";

interface Idea {
  id: string;
  title: string;
  content?: string;
  tags?: string[];
  source: string;
  status: string;
  created_at: string;
}

export default function CreativeHubPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selected, setSelected] = useState<Idea | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        loadIdeas(data.user.id);
      }
    });
  }, []);

  async function loadIdeas(uid?: string) {
    const id = uid || userId;
    if (!id) return;
    const { data } = await supabase
      .from("ideas")
      .select("*")
      .eq("user_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (data) {
      setIdeas(data);
      if (data.length > 0 && !selected) setSelected(data[0]);
    }
  }

  async function addContent() {
    if (!newTitle.trim() || !userId) return;
    setCreating(true);

    const tags = newTags
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    const { error } = await supabase.from("ideas").insert({
      title: newTitle.trim(),
      content: newContent.trim() || null,
      tags: tags.length > 0 ? tags : null,
      source: "creative-hub",
      status: "active",
      user_id: userId,
    });

    if (!error) {
      setNewTitle("");
      setNewContent("");
      setNewTags("");
      setShowAdd(false);
      await loadIdeas();
    }
    setCreating(false);
  }

  async function deleteIdea(id: string) {
    await supabase.from("ideas").update({ status: "deleted" }).eq("id", id);
    if (selected?.id === id) setSelected(null);
    await loadIdeas();
  }

  const filtered = ideas.filter((i) =>
    i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-hidden flex flex-col p-8">
          <div className="max-w-[1600px] mx-auto w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Creative Hub</h1>
                <p className="text-slate-500">Manage ideas, scripts, and content across platforms.</p>
              </div>
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-sm">
                <Plus className="w-5 h-5" /><span>New Content</span>
              </button>
            </div>

            {/* New Content Modal */}
            {showAdd && (
              <div className="mb-6 shrink-0 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Create New Content</h3>
                <input
                  type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Content title..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  autoFocus disabled={creating}
                />
                <textarea
                  value={newContent} onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Write your content, script, or idea..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none h-32"
                  disabled={creating}
                />
                <input
                  type="text" value={newTags} onChange={(e) => setNewTags(e.target.value)}
                  placeholder="Tags (comma separated, e.g. marketing, video, draft)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  disabled={creating}
                />
                <div className="flex gap-3">
                  <button onClick={addContent} disabled={creating || !newTitle.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2">
                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {creating ? "Creating..." : "Create Content"}
                  </button>
                  <button onClick={() => setShowAdd(false)} disabled={creating} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}

            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
              {/* Content List */}
              <div className="w-80 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text" value={search} onChange={(e) => setSearch(e.target.value)}
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
                      className={`p-3 rounded-2xl cursor-pointer transition-colors group ${
                        selected?.id === item.id ? "bg-blue-50 border border-blue-100" : "hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 py-0.5">
                          <h3 className={`font-semibold text-sm mb-1 line-clamp-1 ${selected?.id === item.id ? "text-blue-900" : "text-slate-900"}`}>
                            {item.title}
                          </h3>
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex gap-1 mb-1 flex-wrap">
                              {item.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold">#{tag}</span>
                              ))}
                            </div>
                          )}
                          <span className={`text-[10px] font-medium ${selected?.id === item.id ? "text-blue-600" : "text-slate-400"}`}>
                            {item.source} · {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteIdea(item.id); }}
                          className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-400 mb-2">No content yet</p>
                      <button onClick={() => setShowAdd(true)} className="text-sm text-blue-600 font-medium hover:text-blue-700">Create your first content →</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Editor */}
              <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 shrink-0">
                  <div className="flex items-center gap-1">
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><Type className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><List className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-slate-200 mx-2"></div>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><ImageIcon className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><LinkIcon className="w-4 h-4" /></button>
                  </div>
                  {selected && <span className="text-xs text-slate-400">Source: {selected.source}</span>}
                </div>
                <div className="flex-1 overflow-y-auto p-10">
                  <div className="max-w-3xl mx-auto">
                    {selected ? (
                      <>
                        {selected.tags && selected.tags.length > 0 && (
                          <div className="flex items-center gap-2 mb-6 flex-wrap">
                            {selected.tags.map((tag) => (
                              <span key={tag} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <Hash className="w-3 h-3" />{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <h1 className="text-4xl font-bold text-slate-900 mb-6">{selected.title}</h1>
                        <div className="prose prose-slate prose-blue max-w-none">
                          <p className="text-slate-600 text-lg leading-relaxed whitespace-pre-wrap">
                            {selected.content || "Start writing..."}
                          </p>
                        </div>
                        <div className="mt-8 text-xs text-slate-400">
                          Created: {new Date(selected.created_at).toLocaleString()}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-20">
                        <p className="text-slate-400 mb-2">Select content from the list or create new</p>
                        <button onClick={() => setShowAdd(true)} className="text-blue-600 font-medium hover:text-blue-700">+ New Content</button>
                      </div>
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
