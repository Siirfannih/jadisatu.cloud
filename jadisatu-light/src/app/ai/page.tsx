"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/lib/supabase";
import { Bot, Cpu, Activity, Power, Zap } from "lucide-react";

interface Agent {
  id: string; name: string; role: string; status: string; location: string; model: string;
  last_active: string | null; stats: { cpu?: string; memory?: string; cost?: string };
}
interface AgentLog { id: string; agent_id: string; action: string; created_at: string; }

export default function AIAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [agentsRes, logsRes] = await Promise.all([
      supabase.from("agents").select("*"),
      supabase.from("agent_logs").select("*").order("created_at", { ascending: false }).limit(10),
    ]);
    if (agentsRes.data) setAgents(agentsRes.data);
    if (logsRes.data) setLogs(logsRes.data);
  }

  const statusStyle = (s: string) => {
    const map: Record<string, { text: string; bg: string; border: string; dot: string }> = {
      online: { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
      idle: { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
      offline: { text: "text-red-600", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" },
    };
    return map[s] || { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400" };
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Agent Control Center</h1>
              <p className="text-slate-500">Monitor and manage your AI workforce.</p>
            </div>

            {agents.length === 0 && (
              <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
                <Bot className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">No agents configured</h3>
                <p className="text-slate-500">Agents will appear here once configured in Supabase.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {agents.map((agent) => {
                const sc = statusStyle(agent.status);
                return (
                  <div key={agent.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-6 border-b border-slate-100 relative">
                      <div className={`absolute top-0 right-0 px-3 py-1.5 rounded-bl-xl border-b border-l text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${sc.bg} ${sc.border} ${sc.text}`}>
                        <span className={`w-2 h-2 rounded-full animate-pulse ${sc.dot}`} />
                        {agent.status}
                      </div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 ${sc.bg} ${sc.border} ${sc.text}`}>
                          <Bot className="w-7 h-7" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{agent.name}</h3>
                          <p className="text-sm text-slate-500">{agent.role}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                        <div><p className="text-slate-400 text-xs uppercase tracking-wider">Location</p><p className="font-medium text-slate-700">{agent.location}</p></div>
                        <div><p className="text-slate-400 text-xs uppercase tracking-wider">Model</p><p className="font-medium text-slate-700">{agent.model}</p></div>
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50/50 space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-white rounded-xl border border-slate-100"><Cpu className="w-3.5 h-3.5 mx-auto mb-1 text-slate-400" /><span className="text-xs font-mono text-slate-700">{agent.stats?.cpu || "N/A"}</span></div>
                        <div className="p-2 bg-white rounded-xl border border-slate-100"><Activity className="w-3.5 h-3.5 mx-auto mb-1 text-slate-400" /><span className="text-xs font-mono text-slate-700">{agent.stats?.memory || "N/A"}</span></div>
                        <div className="p-2 bg-white rounded-xl border border-slate-100"><Zap className="w-3.5 h-3.5 mx-auto mb-1 text-slate-400" /><span className="text-xs font-mono text-slate-700">{agent.stats?.cost || "$0"}</span></div>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-sm font-medium transition-colors">Console</button>
                        <button className="flex-1 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"><Power className="w-3.5 h-3.5" /> Restart</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">System Activity Log</h3>
              <div className="font-mono text-sm space-y-2 max-h-[300px] overflow-y-auto">
                {logs.length === 0 ? <p className="text-slate-400">No logs yet.</p> : logs.map((log) => (
                  <div key={log.id} className="flex gap-4 border-b border-slate-50 pb-2 last:border-0">
                    <span className="text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                    <span className="font-bold text-blue-600 w-24">{log.agent_id}</span>
                    <span className="text-slate-700">{log.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
