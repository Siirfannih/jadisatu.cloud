"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { createClient } from "@/lib/supabase-browser";
import { Edit3, Save, Brain, FileText, Database } from "lucide-react";

export default function ContextHub() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [memory, setMemory] = useState<any[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [pRes, dRes, mRes] = await Promise.all([
      supabase.from("context_profile").select("*").order("category"),
      supabase.from("decisions").select("*").order("created_at", { ascending: false }),
      supabase.from("shared_memory").select("*").order("key"),
    ]);
    if (pRes.data) setProfile(pRes.data);
    if (dRes.data) setDecisions(dRes.data);
    if (mRes.data) setMemory(mRes.data);
  }

  async function saveMemory(key: string) {
    await supabase.from("shared_memory").update({ value: editValue, updated_at: new Date().toISOString() }).eq("key", key);
    setEditingKey(null);
    loadData();
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-hidden flex flex-col p-8">
          <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-8 shrink-0">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Context Hub</h1>
                <p className="text-slate-500">Shared brain for all Agents. Single source of truth.</p>
              </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
              {/* Left Panel - Shared Memory */}
              <div className="w-72 flex flex-col bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden shrink-0">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shared Memory</h3>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {memory.map((m) => (
                    <div key={m.key} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-mono">
                      {editingKey === m.key ? (
                        <div className="flex gap-2 items-center">
                          <input value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveMemory(m.key)} className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" autoFocus />
                          <button onClick={() => saveMemory(m.key)} className="text-blue-600 hover:text-blue-700"><Save className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start cursor-pointer group" onClick={() => { setEditingKey(m.key); setEditValue(m.value); }}>
                          <div className="flex-1 min-w-0">
                            <span className="text-blue-600 font-semibold">{m.key}</span>
                            <p className="text-slate-600 mt-1 break-words">&quot;{m.value}&quot;</p>
                          </div>
                          <Edit3 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 ml-2" />
                        </div>
                      )}
                    </div>
                  ))}
                  {memory.length === 0 && <p className="text-center text-sm text-slate-400 py-4">No shared memory</p>}
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8">
                  <div className="max-w-3xl mx-auto space-y-10">
                    {/* Profile & Goals */}
                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <Brain className="w-5 h-5 text-blue-600" />
                        <h2 className="text-2xl font-bold text-slate-900">Profile & Goals</h2>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3">
                        {profile.length === 0 && <p className="text-sm text-slate-400">No profile data yet.</p>}
                        {profile.map((p) => (
                          <div key={p.key} className="flex gap-4">
                            <span className="text-sm text-slate-500 w-36 capitalize font-medium">{p.key.replace(/_/g, " ")}</span>
                            <span className="text-sm text-slate-900">{p.value}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Decision Log */}
                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-bold text-slate-900">Decision Log</h2>
                      </div>
                      <div className="space-y-4">
                        {decisions.length === 0 && <p className="text-sm text-slate-400">No decisions logged yet.</p>}
                        {decisions.map((d) => (
                          <div key={d.id} className="border-l-3 border-blue-500 pl-4 py-2">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-xs text-slate-400 font-mono">{new Date(d.created_at).toLocaleDateString()}</span>
                              <span className="font-semibold text-slate-900">{d.decision}</span>
                            </div>
                            <p className="text-sm text-slate-500">{d.reason}</p>
                          </div>
                        ))}
                      </div>
                    </section>
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
