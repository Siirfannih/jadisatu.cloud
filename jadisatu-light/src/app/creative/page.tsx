"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { createClient } from "@/lib/supabase-browser";
import {
  Plus, Search, Type, List, Image as ImageIcon, Link as LinkIcon,
  Bold, Italic, Hash, Trash2, Save, ChevronDown,
  Twitter, Youtube, Instagram, LayoutTemplate
} from "lucide-react";

interface Content {
  id: string;
  title: string;
  content: string | null;
  tags: string[] | null;
  source: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

const STATUS_OPTIONS = ["idea", "draft", "script", "ready", "published"];
const FILTER_TABS = ["All", "Ideas", "Drafts", "Scripts", "Ready"];
const PLATFORMS = [
  { name: "Twitter", icon: Twitter, color: "text-blue-400" },
  { name: "YouTube", icon: Youtube, color: "text-red-500" },
  { name: "Instagram", icon: Instagram, color: "text-pink-500" },
  { name: "Blog", icon: LayoutTemplate, color: "text-emerald-500" },
];

export default function CreativeHubPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Content[]>([]);
  const [selected, setSelected] = useState<Content | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [userId, setUserId] = useState<string | null>(null);

  // Editor state
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editStatus, setEditStatus] = useState("idea");
  const [editTags, setEditTags] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { setUserId(data.user.id); loadItems(data.user.id); }
    });
  }, []);

  async function loadItems(uid?: string) {
    const id = uid || userId;
    if (!id) return;
    const { data } = await supabase
      .from("ideas")
      .select("*")
      .eq("user_id", id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });
    if (data) setItems(data);
  }

  function selectItem(item: Content) {
    setSelected(item);
    setEditTitle(item.title);
    setEditContent(item.content || "");
    setEditStatus(item.status || "idea");
    setEditTags(item.tags?.join(", ") || "");
    setEditPlatform(item.source || "");
    setShowNew(false);
  }

  function startNew() {
    setSelected(null);
    setEditTitle("");
    setEditContent("");
    setEditStatus("idea");
    setEditTags("");
    setEditPlatform("");
    setShowNew(true);
  }

  async function saveContent() {
    if (!editTitle.trim() || !userId) return;
    setSaving(true);
    const tags = editTags.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean);
    const payload = {
      title: editTitle.trim(),
      content: editContent.trim() || null,
      tags: tags.length > 0 ? tags : null,
      source: editPlatform || "creative-hub",
      status: editStatus,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    if (selected) {
      await supabase.from("ideas").update(payload).eq("id", selected.id);
    } else {
      const { data } = await supabase.from("ideas").insert(payload).select().single();
      if (data) { setSelected(data); setShowNew(false); }
    }
    await loadItems();
    setSaving(false);
  }

  async function deleteItem(id: string) {
    await supabase.from("ideas").update({ status: "deleted" }).eq("id", id);
    if (selected?.id === id) { setSelected(null); setShowNew(false); }
    await loadItems();
  }

  const tabToStatus: Record<string, string> = { Ideas: "idea", Drafts: "draft", Scripts: "script", Ready: "ready" };
  const filtered = items.filter(i => {
    const matchesSearch = i.title.toLowerCase().includes(search.toLowerCase()) || i.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesTab = activeTab === "All" || i.status === tabToStatus[activeTab];
    return matchesSearch && matchesTab;
  });

  const statusColor = (s: string) => {
    if (s === "ready" || s === "published") return "bg-emerald-100 text-emerald-700";
    if (s === "script") return "bg-purple-100 text-purple-700";
    if (s === "draft") return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-600";
  };

  const isEditing = selected || showNew;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-hidden flex flex-col p-6">
          <div className="max-w-[1600px] mx-auto w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-5 shrink-0">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">Creative Hub</h1>
                <p className="text-slate-500">Manage ideas, scripts, and content across platforms.</p>
              </div>
              <button onClick={startNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm">
                <Plus className="w-5 h-5" /><span>New Content</span>
              </button>
            </div>

            <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
              {/* Left: Content List */}
              <div className="w-72 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
                <div className="p-3 border-b border-slate-100 space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search content..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                    {FILTER_TABS.map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)} className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${activeTab === tab ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>{tab}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filtered.map(item => (
                    <div key={item.id} onClick={() => selectItem(item)} className={`p-3 rounded-xl cursor-pointer transition-colors group relative ${selected?.id === item.id ? "bg-blue-50 border border-blue-100" : "hover:bg-slate-50 border border-transparent"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-semibold text-sm mb-1 line-clamp-1 ${selected?.id === item.id ? "text-blue-900" : "text-slate-900"}`}>{item.title}</h3>
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${statusColor(item.status)}`}>{item.status}</span>
                            <span className="text-[10px] text-slate-400">{item.source}</span>
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); deleteItem(item.id); }} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-400 mb-2">No content yet</p>
                      <button onClick={startNew} className="text-sm text-blue-600 font-medium">+ Create content</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Center: Editor */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                {isEditing ? (
                  <>
                    <div className="h-12 border-b border-slate-100 flex items-center justify-between px-5 shrink-0">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><Bold className="w-4 h-4" /></button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><Italic className="w-4 h-4" /></button>
                        <div className="w-px h-4 bg-slate-200 mx-1.5"></div>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><List className="w-4 h-4" /></button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><ImageIcon className="w-4 h-4" /></button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><LinkIcon className="w-4 h-4" /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        {selected && <span className="text-xs text-slate-400">Last saved {selected.updated_at ? new Date(selected.updated_at).toLocaleTimeString() : "—"}</span>}
                        <button onClick={saveContent} disabled={saving || !editTitle.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg transition-colors">
                          <Save className="w-3.5 h-3.5" />{saving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8">
                      <div className="max-w-3xl mx-auto">
                        <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Content Title" className="w-full text-3xl font-bold text-slate-900 border-none focus:outline-none p-0 mb-5 placeholder:text-slate-300 bg-transparent" />
                        <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Start writing your content, script, or idea here..." className="w-full min-h-[400px] text-slate-600 text-base leading-relaxed border-none focus:outline-none p-0 resize-none placeholder:text-slate-400 bg-transparent" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-slate-400 mb-3">Select content from the list or create new</p>
                      <button onClick={startNew} className="text-blue-600 font-medium hover:text-blue-700 text-sm">+ New Content</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Metadata Panel */}
              {isEditing && (
                <div className="w-64 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
                  <div className="h-12 border-b border-slate-100 flex items-center px-5">
                    <h3 className="font-semibold text-slate-900 text-sm">Content Details</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Status */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium capitalize">
                        {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                      </select>
                    </div>

                    {/* Platform */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Platform</label>
                      <div className="grid grid-cols-2 gap-2">
                        {PLATFORMS.map(p => {
                          const Icon = p.icon;
                          const isActive = editPlatform === p.name.toLowerCase();
                          return (
                            <button key={p.name} onClick={() => setEditPlatform(isActive ? "" : p.name.toLowerCase())} className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${isActive ? "bg-blue-50 border border-blue-200 text-blue-700" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-blue-600" : p.color}`} />{p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tags</label>
                      <input type="text" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="marketing, video, draft" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" />
                    </div>

                    {/* Publish Date */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Publish Date</label>
                      <input type="date" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium" />
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <button onClick={saveContent} disabled={saving || !editTitle.trim()} className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
                        <Save className="w-4 h-4" />{saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>

                    {selected && (
                      <button onClick={() => deleteItem(selected.id)} className="w-full text-center text-xs text-red-500 hover:text-red-600 font-medium py-2">Delete this content</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
