'use client'

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Bot, Cpu, Activity, Power, Zap } from "lucide-react"

interface Agent {
  id: string
  name: string
  role: string
  status: string
  location: string
  model: string
  last_active: string | null
  stats: { cpu?: string; memory?: string; cost?: string }
}

interface AgentLog {
  id: string
  agent_id: string
  action: string
  created_at: string
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [logs, setLogs] = useState<AgentLog[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [agentsRes, logsRes] = await Promise.all([
      supabase.from("agents").select("*"),
      supabase.from("agent_logs").select("*").order("created_at", { ascending: false }).limit(10),
    ])
    if (agentsRes.data) setAgents(agentsRes.data)
    if (logsRes.data) setLogs(logsRes.data)
  }

  const statusColor = (s: string) => ({
    online: { text: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20", dot: "bg-green-500" },
    idle: { text: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20", dot: "bg-yellow-500" },
    offline: { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-500" },
    error: { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-500" },
  }[s] || { text: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/20", dot: "bg-zinc-500" })

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Control Center</h1>
          <p className="text-muted-foreground">Monitor and manage your AI workforce.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {agents.map((agent) => {
          const sc = statusColor(agent.status)
          return (
            <div key={agent.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
              <div className="p-6 border-b border-border/50 relative">
                <div className={cn("absolute top-0 right-0 p-2 rounded-bl-xl border-b border-l text-xs font-mono flex items-center gap-2", sc.bg, sc.border, sc.text)}>
                  <span className={cn("w-2 h-2 rounded-full animate-pulse", sc.dot)} />
                  {agent.status.toUpperCase()}
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center border-2", sc.bg, sc.border, sc.text)}>
                    <Bot size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{agent.name}</h3>
                    <p className="text-sm text-muted-foreground">{agent.role}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider">Location</p>
                    <p className="font-medium">{agent.location}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider">Model</p>
                    <p className="font-medium">{agent.model}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-muted/10 space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-background rounded-lg border border-border">
                    <Cpu size={14} className="mx-auto mb-1 text-muted-foreground" />
                    <span className="text-xs font-mono">{agent.stats?.cpu || "N/A"}</span>
                  </div>
                  <div className="p-2 bg-background rounded-lg border border-border">
                    <Activity size={14} className="mx-auto mb-1 text-muted-foreground" />
                    <span className="text-xs font-mono">{agent.stats?.memory || "N/A"}</span>
                  </div>
                  <div className="p-2 bg-background rounded-lg border border-border">
                    <Zap size={14} className="mx-auto mb-1 text-muted-foreground" />
                    <span className="text-xs font-mono">{agent.stats?.cost || "$0"}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors">Console</button>
                  <button className="flex-1 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    <Power size={14} /> Restart
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">System Activity Log</h3>
        <div className="font-mono text-sm space-y-2 max-h-[300px] overflow-y-auto">
          {logs.length === 0 ? <p className="text-muted-foreground">No logs yet.</p> : logs.map((log) => (
            <div key={log.id} className="flex gap-4 border-b border-border/30 pb-2 last:border-0">
              <span className="text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</span>
              <span className="font-bold text-green-500 w-24">{log.agent_id}</span>
              <span className="text-foreground/80">{log.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
