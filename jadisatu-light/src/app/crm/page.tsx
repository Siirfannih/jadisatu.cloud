"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Users, Mail, Search, Plus, TrendingUp, Target, Zap, BarChart3 } from "lucide-react";

interface Lead {
  id: string;
  title: string;
  source: string;
  category: string;
  pain_score: number;
  opportunity_level: string;
  jadisatu_solution: string;
  status: string;
  scraped_at: string;
}

interface Stats {
  total_collected: number;
  today_new: number;
  high_opportunity: number;
  avg_pain_score: number;
}

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    fetch("/api/leads?stats=true").then((r) => r.json()).then(setStats).catch(() => {});
    loadLeads();
  }, []);

  const loadLeads = (cat = "All") => {
    const url = cat === "All" ? "/api/leads?limit=50" : `/api/leads?limit=50&category=${cat}`;
    fetch(url).then((r) => r.json()).then((data) => {
      if (data.data) setLeads(data.data);
    }).catch(() => {});
  };

  const filtered = leads.filter((l) =>
    l.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">CRM</h1>
                <p className="text-slate-500">Manage leads and opportunities.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
                </div>
              </div>
            </div>

            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3"><Users className="w-5 h-5 text-blue-600" /></div>
                  <p className="text-sm text-slate-500 font-medium">Total Leads</p>
                  <h3 className="text-3xl font-bold text-slate-900">{stats.total_collected}</h3>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                  <p className="text-sm text-slate-500 font-medium">New Today</p>
                  <h3 className="text-3xl font-bold text-slate-900">{stats.today_new}</h3>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3"><Target className="w-5 h-5 text-orange-600" /></div>
                  <p className="text-sm text-slate-500 font-medium">High Opportunity</p>
                  <h3 className="text-3xl font-bold text-slate-900">{stats.high_opportunity}</h3>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-3"><BarChart3 className="w-5 h-5 text-purple-600" /></div>
                  <p className="text-sm text-slate-500 font-medium">Avg Pain Score</p>
                  <h3 className="text-3xl font-bold text-slate-900">{stats.avg_pain_score}</h3>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="py-4 px-6 font-semibold text-slate-600 text-sm">Title</th>
                      <th className="py-4 px-6 font-semibold text-slate-600 text-sm">Category</th>
                      <th className="py-4 px-6 font-semibold text-slate-600 text-sm">Pain Score</th>
                      <th className="py-4 px-6 font-semibold text-slate-600 text-sm">Opportunity</th>
                      <th className="py-4 px-6 font-semibold text-slate-600 text-sm">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((lead) => (
                      <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <span className="font-medium text-slate-900 line-clamp-1">{lead.title}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600">
                            {lead.category || "—"}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${lead.pain_score >= 7 ? "bg-red-500" : lead.pain_score >= 4 ? "bg-orange-500" : "bg-blue-500"}`} style={{ width: `${lead.pain_score * 10}%` }}></div>
                            </div>
                            <span className="text-sm font-medium text-slate-700">{lead.pain_score}/10</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            lead.opportunity_level === "Very High" ? "bg-emerald-50 text-emerald-600" :
                            lead.opportunity_level === "High" ? "bg-blue-50 text-blue-600" :
                            "bg-slate-100 text-slate-600"
                          }`}>{lead.opportunity_level || "—"}</span>
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-500">{lead.source}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={5} className="py-12 text-center text-slate-400">No leads found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
