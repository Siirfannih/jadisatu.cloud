'use client'

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Edit3, Save } from "lucide-react"

export default function ContextHub() {
  const [profile, setProfile] = useState<any[]>([])
  const [decisions, setDecisions] = useState<any[]>([])
  const [memory, setMemory] = useState<any[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [pRes, dRes, mRes] = await Promise.all([
      supabase.from("context_profile").select("*").order("category"),
      supabase.from("decisions").select("*").order("created_at", { ascending: false }),
      supabase.from("shared_memory").select("*").order("key"),
    ])
    if (pRes.data) setProfile(pRes.data)
    if (dRes.data) setDecisions(dRes.data)
    if (mRes.data) setMemory(mRes.data)
  }

  async function saveMemory(key: string) {
    await supabase.from("shared_memory").update({ value: editValue, updated_at: new Date().toISOString() }).eq("key", key)
    setEditingKey(null)
    loadData()
  }

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Context Hub</h1>
          <p className="text-muted-foreground">Shared brain for all Agents. Single source of truth.</p>
        </div>
      </div>

      <div className="flex-1 flex bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="w-64 border-r border-border bg-muted/10 p-4 space-y-6">
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-2">Core Context</h3>
            <nav className="space-y-1">
              {["Profile & Goals", "Decision Log"].map(item => (
                <button key={item} className="w-full text-left px-3 py-2 rounded-md text-sm font-medium hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">{item}</button>
              ))}
            </nav>
          </div>
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-2">Shared Memory</h3>
            <div className="space-y-2 px-2">
              {memory.map(m => (
                <div key={m.key} className="bg-background border border-border rounded p-2 text-xs font-mono">
                  {editingKey === m.key ? (
                    <div className="flex gap-1">
                      <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="flex-1 bg-transparent outline-none" autoFocus />
                      <button onClick={() => saveMemory(m.key)} className="text-primary"><Save size={12} /></button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => { setEditingKey(m.key); setEditValue(m.value) }}>
                      <div><span className="text-purple-400">{m.key}</span>: &quot;{m.value}&quot;</div>
                      <Edit3 size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4">Profile & Goals</h2>
              <div className="bg-muted/20 p-6 rounded-lg border border-border/50 space-y-4">
                {profile.map(p => (
                  <div key={p.key} className="flex gap-4">
                    <span className="text-sm text-muted-foreground w-32 capitalize">{p.key.replace(/_/g, " ")}</span>
                    <span className="text-sm font-medium">{p.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Decision Log</h2>
              <div className="space-y-4">
                {decisions.length === 0 ? <p className="text-muted-foreground text-sm">No decisions logged yet.</p> :
                  decisions.map(d => (
                    <div key={d.id} className="border-l-2 border-primary pl-4 py-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
                        <span className="font-medium">{d.decision}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{d.reason}</p>
                    </div>
                  ))
                }
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
