"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { createClient } from "@/lib/supabase-browser";
import {
  Plus, Search, Bold, Italic, List, Image as ImageIcon, Link as LinkIcon,
  Hash, Trash2, Save, Loader2, ChevronRight,
  Twitter, Youtube, Instagram, LayoutTemplate,
  Lightbulb, FileText, Video, Rocket, CheckCircle2,
  PenTool, Type, AlignLeft
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

const PIPELINE_STAGES = [
  { key: "idea", label: "Idea", icon: Lightbulb, color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200" },
  { key: "draft", label: "Draft", icon: PenTool, color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-200" },
  { key: "script", label: "Script", icon: FileText, color: "text-purple-600", bg: "bg-purple-50", ring: "ring-purple-200" },
  { key: "ready", label: "Ready", icon: Rocket, color: "text-orange-600", bg: "bg-orange-50", ring: "ring-orange-200" },
  { key: "published", label: "Published", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
];

const FILTER_TABS = ["All", "Idea", "Draft", "Script", "Ready", "Published"];

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

  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editStatus, setEditStatus] = useState("idea");
  const [editTags, setEditTags] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { setUserId(data.user.id); loadItems(data.user.id); }
    });
  }, []);

  async function loadItems(uid?: string) {
    const id = uid || userId;
    if (!id) return;
    const { data } = await supabase.from("ideas").select("*").eq("user_id", id).neq("status", "deleted").order("updated_at", { ascending: false });
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
    setLastSaved(item.updated_at ? new Date(item.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null);
  }

  function startNew() {
    setSelected(null);
    setEditTitle("");
    setEditContent("");
    setEditStatus("idea");
    setEditTags("");
    setEditPlatform("");
    setShowNew(true);
    setLastSaved(null);
  }

  async function saveContent() {
    if (!editTitle.trim() || !userId) return;
    setSaving(true);
    const tags = editTags.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean);
    const now = new Date().toISOString();
    const payload = {
      title: editTitle.trim(),
      content: editContent.trim() || null,
      tags: tags.length > 0 ? tags : null,
      source: editPlatform || "creative-hub",
      status: editStatus,
      user_id: userId,
      updated_at: now,
    };

    if (selected) {
      await supabase.from("ideas").update(payload).eq("id", selected.id);
      setSelected({ ...selected, ...payload });
    } else {
      const { data } = await supabase.from("ideas").insert(payload).select().single();
      if (data) { setSelected(data); setShowNew(false); }
    }
    setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    await loadItems();
    setSaving(false);
  }

  async function deleteItem(id: string) {
    await supabase.from("ideas").update({ status: "deleted" }).eq("id", id);
    if (selected?.id === id) { setSelected(null); setShowNew(false); }
    await loadItems();
  }

  function advanceStage() {
    const idx = PIPELINE_STAGES.findIndex(s => s.key === editStatus);
    if (idx < PIPELINE_STAGES.length - 1) {
      setEditStatus(PIPELINE_STAGES[idx + 1].key);
    }
  }

  const filtered = items.filter(i => {
    const matchesSearch = i.title.toLowerCase().includes(search.toLowerCase()) || i.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesTab = activeTab === "All" || i.status === activeTab.toLowerCase();
    return matchesSearch && matchesTab;
  });

  const stageColor = (s: string) => PIPELINE_STAGES.find(p => p.key === s) || PIPELINE_STAGES[0];
  const wordCount = editContent.trim().split(/\s+/).filter(Boolean).length;
  const charCount = editContent.length;
  const isEditing = selected || showNew;
  const currentStageIdx = PIPELINE_STAGES.findIndex(s => s.key === editStatus);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-hidden flex flex-col p-5">
          <div className="max-w-[1700px] mx-auto w-full h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Content Studio</h1>
                <p className="text-sm text-slate-500">Write, structure, and publish your content.</p>
              </div>
              <button onClick={startNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm">
                <Plus className="w-4 h-4" />New Content
              </button>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
              {/* ── Left: Content Library ── */}
              <div className="w-64 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
                <div className="p-3 space-y-2.5 border-b border-slate-100">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border-none text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                    {FILTER_TABS.map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)} className={`px-2 py-1 text-[10px] font-semibold rounded-md whitespace-nowrap transition-colors ${activeTab === tab ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{tab}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {filtered.map(item => {
                    const sc = stageColor(item.status);
                    return (
                      <div key={item.id} onClick={() => selectItem(item)} className={`p-2.5 rounded-xl cursor-pointer transition-all group ${selected?.id === item.id ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"}`}>
                        <div className="flex items-start gap-2">
                          <div className={`w-6 h-6 rounded-lg ${sc.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <sc.icon className={`w-3 h-3 ${sc.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-semibold text-slate-900 line-clamp-1">{item.title}</h3>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`px-1 py-0.5 rounded text-[8px] font-bold uppercase ${sc.bg} ${sc.color}`}>{item.status}</span>
                              {item.source && item.source !== "creative-hub" && <span className="text-[9px] text-slate-400">{item.source}</span>}
                            </div>
                          </div>
                          <button onClick={e => { e.stopPropagation(); deleteItem(item.id); }} className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-400 mb-1">No content</p>
                      <button onClick={startNew} className="text-xs text-blue-600 font-medium">+ Create</button>
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400">{items.length} items</span>
                </div>
              </div>

              {/* ── Center: Editor ── */}
              <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {isEditing ? (
                  <>
                    {/* Pipeline Stage Indicator */}
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {PIPELINE_STAGES.map((stage, i) => {
                            const isActive = i === currentStageIdx;
                            const isPast = i < currentStageIdx;
                            const Icon = stage.icon;
                            return (
                              <React.Fragment key={stage.key}>
                                <button
                                  onClick={() => setEditStatus(stage.key)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    isActive ? `${stage.bg} ${stage.color} ring-1 ${stage.ring}` :
                                    isPast ? "bg-slate-100 text-slate-500" :
                                    "text-slate-400 hover:bg-slate-50"
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">{stage.label}</span>
                                </button>
                                {i < PIPELINE_STAGES.length - 1 && (
                                  <ChevronRight className={`w-3 h-3 shrink-0 ${isPast ? "text-slate-400" : "text-slate-300"}`} />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        {currentStageIdx < PIPELINE_STAGES.length - 1 && (
                          <button onClick={() => { advanceStage(); saveContent(); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors">
                            Advance <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Toolbar */}
                    <div className="h-10 border-b border-slate-100 flex items-center justify-between px-5 shrink-0">
                      <div className="flex items-center gap-0.5">
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md"><Bold className="w-3.5 h-3.5" /></button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md"><Italic className="w-3.5 h-3.5" /></button>
                        <div className="w-px h-3.5 bg-slate-200 mx-1"></div>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md"><List className="w-3.5 h-3.5" /></button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md"><AlignLeft className="w-3.5 h-3.5" /></button>
                        <div className="w-px h-3.5 bg-slate-200 mx-1"></div>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md"><ImageIcon className="w-3.5 h-3.5" /></button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md"><LinkIcon className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400">{wordCount} words · {charCount} chars</span>
                        {lastSaved && <span className="text-[10px] text-slate-400">Saved {lastSaved}</span>}
                        <button onClick={saveContent} disabled={saving || !editTitle.trim()} className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-[11px] font-medium rounded-md transition-colors">
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          {saving ? "Saving" : "Save"}
                        </button>
                      </div>
                    </div>

                    {/* Writing Area */}
                    <div className="flex-1 overflow-y-auto">
                      <div className="max-w-2xl mx-auto px-8 py-10">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          placeholder="Untitled"
                          className="w-full text-3xl font-bold text-slate-900 border-none focus:outline-none p-0 mb-6 placeholder:text-slate-300 bg-transparent leading-tight"
                        />
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          placeholder="Start writing...&#10;&#10;Write your script, outline, caption, or content draft here. This is your creative workspace."
                          className="w-full min-h-[500px] text-slate-700 text-[15px] leading-[1.8] border-none focus:outline-none p-0 resize-none placeholder:text-slate-400/60 bg-transparent"
                          style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-xs">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                        <Type className="w-8 h-8 text-slate-300" />
                      </div>
                      <h3 className="font-semibold text-slate-900 mb-1">Your writing workspace</h3>
                      <p className="text-sm text-slate-500 mb-4">Select content from the library or start creating something new.</p>
                      <button onClick={startNew} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
                        <Plus className="w-4 h-4" />New Content
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right: Metadata & Production ── */}
              {isEditing && (
                <div className="w-56 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
                  <div className="h-10 border-b border-slate-100 flex items-center px-4">
                    <h3 className="font-semibold text-slate-900 text-xs">Production</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Status */}
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Stage</label>
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium capitalize">
                        {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>

                    {/* Platform */}
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Platform</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {PLATFORMS.map(p => {
                          const Icon = p.icon;
                          const isActive = editPlatform === p.name.toLowerCase();
                          return (
                            <button key={p.name} onClick={() => setEditPlatform(isActive ? "" : p.name.toLowerCase())} className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${isActive ? "bg-blue-50 border border-blue-200 text-blue-700" : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
                              <Icon className={`w-3 h-3 ${isActive ? "text-blue-600" : p.color}`} />{p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tags</label>
                      <input type="text" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="tag1, tag2" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400" />
                      {editTags && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {editTags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-bold flex items-center gap-0.5">
                              <Hash className="w-2 h-2" />{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Publish Date */}
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Publish Date</label>
                      <input type="date" className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>

                    {/* Save */}
                    <div className="pt-3 border-t border-slate-100">
                      <button onClick={saveContent} disabled={saving || !editTitle.trim()} className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg py-2 text-xs font-medium transition-colors">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>

                    {selected && (
                      <div className="pt-2">
                        <p className="text-[9px] text-slate-400 mb-2">Created {new Date(selected.created_at).toLocaleDateString()}</p>
                        <button onClick={() => deleteItem(selected.id)} className="text-[10px] text-red-500 hover:text-red-600 font-medium">Delete content</button>
                      </div>
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
