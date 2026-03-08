"use client";

import { useState, useEffect } from "react";
import { Search, Filter, TrendingUp, Target, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Lead = {
  id: string;
  source: string;
  platform: string;
  subreddit: string;
  title: string;
  body: string;
  url: string;
  upvotes: number;
  comments: number;
  author: string;
  created_at: string;
  scraped_at: string;
  pain_score: number;
  category: string;
  opportunity_level: string;
  jadisatu_solution: string;
  target_market: string;
  estimated_value: number;
  urgency: string;
  status: string;
  matching_keywords: string[];
  keywords_extracted: string[];
  analyzed_at: string;
};

type Stats = {
  total_collected: number;
  today_new: number;
  high_opportunity: number;
  avg_pain_score: number;
  categories: Record<string, number>;
  sources_active: number;
  keywords_tracked: number;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Very High": { bg: "rgba(16,185,129,0.15)", text: "#10b981", dot: "#10b981" },
  "High": { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", dot: "#f59e0b" },
  "Medium": { bg: "rgba(99,102,241,0.15)", text: "#6366f1", dot: "#6366f1" },
  "Low": { bg: "rgba(100,116,139,0.15)", text: "#64748b", dot: "#64748b" },
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [categories, setCategories] = useState<string[]>(["All"]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch leads
        const leadsRes = await fetch("/api/leads");
        if (!leadsRes.ok) throw new Error("Failed to fetch leads");
        const leadsData = await leadsRes.json();
        setLeads(leadsData.data || []);

        // Fetch stats
        const statsRes = await fetch("/api/leads?stats=true");
        if (!statsRes.ok) throw new Error("Failed to fetch stats");
        const statsData = await statsRes.json();
        setStats(statsData);

        // Extract categories
        const cats = ["All", ...Object.keys(statsData.categories || {})];
        setCategories(cats);
      } catch (err) {
        console.error("Error fetching leads:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const filtered = leads.filter((l) => {
    const matchCat = activeFilter === "All" || l.category === activeFilter;
    const matchSearch =
      !searchTerm ||
      l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.body.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-gray-400">Loading leads...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
      <div className="bg-[#0d0d16] border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Dashboard</span>
            </Link>
            <div className="w-px h-6 bg-gray-700" />
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Target className="text-indigo-500" size={28} />
              Leads Tracker
              <span className="text-sm font-normal text-gray-500">
                Hunter Agent Pain Points
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded px-3 py-1 text-green-400 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Agent Active
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {stats && (
          <div className="grid grid-cols-6 gap-4">
            {[
              { label: "TOTAL COLLECTED", value: stats.total_collected.toLocaleString(), color: "#6366f1", icon: "📦" },
              { label: "NEW TODAY", value: "+" + stats.today_new, color: "#10b981", icon: "⚡" },
              { label: "HIGH OPPORTUNITY", value: stats.high_opportunity, color: "#f59e0b", icon: "🔥" },
              { label: "AVG PAIN SCORE", value: stats.avg_pain_score, color: "#10b981", icon: "📊" },
              { label: "SOURCES ACTIVE", value: stats.sources_active, color: "#6366f1", icon: "🌐" },
              { label: "KEYWORDS TRACKED", value: stats.keywords_tracked, color: "#a78bfa", icon: "🎯" },
            ].map((s, i) => (
              <div key={i} className="bg-[#111118] border border-gray-800 rounded-lg p-4">
                <div className="text-gray-500 text-xs mb-2">
                  {s.icon} {s.label}
                </div>
                <div className="text-2xl font-bold" style={{ color: s.color }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search leads..."
              className="w-full bg-[#111118] border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === cat
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
                  : "bg-[#111118] text-gray-400 border border-gray-800 hover:border-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
          <div className="ml-auto text-sm text-gray-500">{filtered.length} results</div>
        </div>

        <div className="bg-[#111118] border border-gray-800 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[2fr_100px_100px_100px_120px_100px] gap-4 px-6 py-3 border-b border-gray-800 text-xs text-gray-500 font-medium">
            <div>PROBLEM / TITLE</div>
            <div>SOURCE</div>
            <div>PAIN SCORE</div>
            <div>ENGAGEMENT</div>
            <div>OPPORTUNITY</div>
            <div>STATUS</div>
          </div>

          <div className="divide-y divide-gray-800">
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No leads found matching your filters
              </div>
            ) : (
              filtered.map((lead) => (
                <div key={lead.id}>
                  <div
                    onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                    className="grid grid-cols-[2fr_100px_100px_100px_120px_100px] gap-4 px-6 py-4 cursor-pointer hover:bg-white/5 transition-colors items-center"
                  >
                    <div>
                      <div className="font-medium mb-1 line-clamp-2">{lead.title}</div>
                      <div className="flex gap-2 flex-wrap">
                        {lead.keywords_extracted?.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm">{lead.source === "Reddit" ? "🔴" : "🔵"} {lead.source}</div>
                      <div className="text-xs text-gray-500">{lead.subreddit || lead.platform}</div>
                    </div>

                    <div>
                      <div
                        className="text-xl font-bold"
                        style={{
                          color:
                            lead.pain_score >= 90
                              ? "#10b981"
                              : lead.pain_score >= 80
                              ? "#f59e0b"
                              : "#6366f1",
                        }}
                      >
                        {lead.pain_score}
                      </div>
                      <div className="bg-gray-700 rounded-full h-1 mt-1">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: lead.pain_score + "%",
                            background:
                              lead.pain_score >= 90
                                ? "#10b981"
                                : lead.pain_score >= 80
                                ? "#f59e0b"
                                : "#6366f1",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold">
                        {lead.upvotes >= 1000 ? (lead.upvotes / 1000).toFixed(1) + "k" : lead.upvotes}
                      </div>
                      <div className="text-xs text-gray-500">{lead.comments} comments</div>
                    </div>

                    <div>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: STATUS_COLORS[lead.opportunity_level || "Medium"].bg,
                          color: STATUS_COLORS[lead.opportunity_level || "Medium"].text,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: STATUS_COLORS[lead.opportunity_level || "Medium"].dot,
                          }}
                        />
                        {lead.opportunity_level || "Medium"}
                      </span>
                    </div>

                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          lead.status === "validated"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-indigo-500/10 text-indigo-400"
                        }`}
                      >
                        {lead.status === "validated" ? "✓ Valid" : "◷ Queue"}
                      </span>
                    </div>
                  </div>

                  {selectedLead?.id === lead.id && (
                    <div className="px-6 py-4 bg-[#0d0d16] border-t border-gray-800 space-y-3">
                      <div className="text-sm text-indigo-400 font-medium">▸ FULL ANALYSIS</div>
                      <div className="text-gray-300 leading-relaxed">{lead.body}</div>
                      <div className="flex gap-4 text-sm">
                        <div className="text-gray-500">
                          Category: <span className="text-gray-300">{lead.category}</span>
                        </div>
                        <div className="text-gray-500">
                          Platform: <span className="text-gray-300">{lead.source} / {lead.subreddit || lead.platform}</span>
                        </div>
                        <div className="text-gray-500">
                          Pain Score: <span className="text-orange-400">{lead.pain_score}/100</span>
                        </div>
                      </div>
                      {lead.jadisatu_solution && (
                        <div className="bg-[#111118] border border-gray-800 rounded-lg p-4">
                          <div className="text-sm text-green-400 font-medium mb-2">💡 JadiSatu Solution</div>
                          <div className="text-gray-300 text-sm">{lead.jadisatu_solution}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
