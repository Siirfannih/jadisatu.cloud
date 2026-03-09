"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { Users, Search, TrendingUp, Target, Zap, BarChart3, Radio, Hash, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

type Lead = { id: string; source: string; platform: string; subreddit: string; title: string; body: string; url: string; upvotes: number; comments: number; author: string; pain_score: number; category: string; opportunity_level: string; jadisatu_solution: string; keywords_extracted: string[]; status: string; scraped_at: string; };
type Stats = { total_collected: number; today_new: number; high_opportunity: number; avg_pain_score: number; categories: Record<string, number>; sources_active: number; keywords_tracked: number; };

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [leadsRes, statsRes] = await Promise.all([
        fetch(activeFilter === "All" ? "/api/leads?limit=100" : `/api/leads?limit=100&category=${activeFilter}`),
        fetch("/api/leads?stats=true"),
      ]);
      if (leadsRes.ok) { const d = await leadsRes.json(); setLeads(d.data || []); }
      if (statsRes.ok) { const d = await statsRes.json(); setStats(d); setCategories(["All", ...Object.keys(d.categories || {})]); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [activeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const interval = setInterval(fetchData, 60000); return () => clearInterval(interval); }, [fetchData]);

  const filtered = leads.filter((l) => l.title.toLowerCase().includes(search.toLowerCase()));

  const opportunityColor = (level: string) => {
    if (level === "Very High") return "bg-emerald-50 text-emerald-600";
    if (level === "High") return "bg-blue-50 text-blue-600";
    if (level === "Medium") return "bg-orange-50 text-orange-600";
    return "bg-slate-100 text-slate-600";
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div><h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Leads Tracker</h1><p className="text-slate-500">Monitor pain points and opportunities from the market.</p></div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
              </div>
            </div>

            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Total Collected", value: stats.total_collected, icon: Users, color: "blue" },
                  { label: "New Today", value: stats.today_new, icon: TrendingUp, color: "emerald" },
                  { label: "High Opportunity", value: stats.high_opportunity, icon: Target, color: "orange" },
                  { label: "Avg Pain Score", value: stats.avg_pain_score, icon: Zap, color: "red" },
                  { label: "Sources Active", value: stats.sources_active, icon: Radio, color: "purple" },
                  { label: "Keywords Tracked", value: stats.keywords_tracked, icon: Hash, color: "slate" },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                      <Icon className={`w-4 h-4 text-${s.color}-500 mb-2`} />
                      <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                      <h3 className="text-2xl font-bold text-slate-900">{s.value}</h3>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Category Filters */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setActiveFilter(cat)} className={`px-4 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === cat ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{cat}</button>
              ))}
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="py-3 px-4 font-semibold text-slate-600 text-sm w-8"></th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-sm">Title</th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-sm">Category</th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-sm">Pain</th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-sm">Opportunity</th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-sm">Source</th>
                      <th className="py-3 px-4 font-semibold text-slate-600 text-sm">Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((lead) => (
                      <React.Fragment key={lead.id}>
                        <tr onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer">
                          <td className="py-3 px-4">{expandedLead === lead.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}</td>
                          <td className="py-3 px-4"><span className="font-medium text-slate-900 line-clamp-1 text-sm">{lead.title}</span></td>
                          <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600">{lead.category || "—"}</span></td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-12 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${lead.pain_score >= 7 ? "bg-red-500" : lead.pain_score >= 4 ? "bg-orange-500" : "bg-blue-500"}`} style={{ width: `${lead.pain_score * 10}%` }}></div></div>
                              <span className="text-xs font-medium text-slate-700">{lead.pain_score}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${opportunityColor(lead.opportunity_level)}`}>{lead.opportunity_level || "—"}</span></td>
                          <td className="py-3 px-4 text-sm text-slate-500">{lead.platform || lead.source}</td>
                          <td className="py-3 px-4 text-sm text-slate-500">↑{lead.upvotes} 💬{lead.comments}</td>
                        </tr>
                        {expandedLead === lead.id && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                <div>
                                  <h4 className="font-semibold text-slate-900 mb-2">Summary</h4>
                                  <p className="text-slate-600 mb-3 line-clamp-4">{lead.body || "No content"}</p>
                                  {lead.url && <a href={lead.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1"><ExternalLink className="w-3 h-3" />View source</a>}
                                </div>
                                <div className="space-y-3">
                                  {lead.jadisatu_solution && (
                                    <div><h4 className="font-semibold text-slate-900 mb-1">JadiSatu Solution</h4><p className="text-slate-600">{lead.jadisatu_solution}</p></div>
                                  )}
                                  {lead.keywords_extracted && lead.keywords_extracted.length > 0 && (
                                    <div><h4 className="font-semibold text-slate-900 mb-1">Keywords</h4><div className="flex flex-wrap gap-1">{lead.keywords_extracted.map((kw, i) => (<span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{kw}</span>))}</div></div>
                                  )}
                                  <div className="flex gap-4 text-xs text-slate-500">
                                    <span>By: {lead.author}</span>
                                    {lead.subreddit && <span>r/{lead.subreddit}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    {filtered.length === 0 && (<tr><td colSpan={7} className="py-12 text-center text-slate-400">No leads found</td></tr>)}
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
