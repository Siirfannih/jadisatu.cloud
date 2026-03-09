"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Bot, Sparkles, MessageSquare, Code, Image as ImageIcon, FileText } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: string;
  type?: string;
}

const iconMap: Record<string, typeof FileText> = {
  writer: FileText,
  design: ImageIcon,
  code: Code,
  default: Sparkles,
};

export default function AIAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAgents(data); })
      .catch(() => {});
  }, []);

  const colorSchemes = [
    "bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-orange-500",
  ];

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">AI Agents</h1>
                <p className="text-slate-500">Your specialized AI assistants ready to help.</p>
              </div>
              <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-sm">
                <Bot className="w-5 h-5" />
                <span>Create Custom Agent</span>
              </button>
            </div>

            {agents.length === 0 && (
              <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
                <Bot className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">No agents configured</h3>
                <p className="text-slate-500">Create your first AI agent to get started.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agents.map((agent, i) => {
                const Icon = iconMap[agent.type || "default"] || Sparkles;
                return (
                  <div key={agent.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex gap-6">
                    <div className={`w-16 h-16 rounded-2xl ${colorSchemes[i % colorSchemes.length]} bg-opacity-10 flex items-center justify-center shrink-0`}>
                      <Icon className="w-8 h-8 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-slate-900">{agent.name}</h3>
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          agent.status === "online" ? "bg-emerald-50 text-emerald-600" :
                          agent.status === "idle" ? "bg-orange-50 text-orange-600" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {agent.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mb-4">{agent.description || "AI Agent"}</p>
                      <div className="flex gap-3">
                        <button className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Chat
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
