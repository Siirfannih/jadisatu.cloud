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

        const leadsRes = await fetch("/light/api/leads");
        if (!leadsRes.ok) throw new Error("Failed to fetch leads");
        const leadsData = await leadsRes.json();
        setLeads(leadsData.data || []);

        const statsRes = await fetch("/light/api/leads?stats=true");
        if (!statsRes.ok) throw new Error("Failed to fetch stats");
        const statsData = await statsRes.json();
        setStats(statsData);

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4">&#x23F3;</div>
          <div className="text-muted-foreground">Loading leads...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
            <Target className="text-primary" size={28} />
            Leads Tracker
          </h1>
          <span className="text-sm text-muted-foreground">
            Hunter Agent Pain Points
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded px-3 py-1 text-green-500 text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Agent Active
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "TOTAL COLLECTED", value: stats.total_collected.toLocaleString(), color: "#6366f1", icon: "\u{1F4E6}" },
            { label: "NEW TODAY", value: "+" + stats.today_new, color: "#10b981", icon: "\u{26A1}" },
            { label: "HIGH OPPORTUNITY", value: stats.high_opportunity, color: "#f59e0b", icon: "\u{1F525}" },
            { label: "AVG PAIN SCORE", value: stats.avg_pain_score, color: "#10b981", icon: "\u{1F4CA}" },
            { label: "SOURCES ACTIVE", value: stats.sources_active, color: "#6366f1", icon: "\u{1F310}" },
            { label: "KEYWORDS TRACKED", value: stats.keywords_tracked, color: "#a78bfa", icon: "\u{1F3AF}" },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="text-muted-foreground text-xs mb-2">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search leads..."
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
          />
        </div>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === cat
                ? "bg-primary/20 text-primary border border-primary/40"
                : "bg-card text-muted-foreground border border-border hover:border-muted-foreground/30"
            }`}
          >
            {cat}
          </button>
        ))}
        <div className="ml-auto text-sm text-muted-foreground">{filtered.length} results</div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[2fr_100px_100px_100px_120px_100px] gap-4 px-6 py-3 border-b border-border text-xs text-muted-foreground font-medium">
          <div>PROBLEM / TITLE</div>
          <div>SOURCE</div>
          <div>PAIN SCORE</div>
          <div>ENGAGEMENT</div>
          <div>OPPORTUNITY</div>
          <div>STATUS</div>
        </div>

        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              No leads found matching your filters
            </div>
          ) : (
            filtered.map((lead) => (
              <div key={lead.id}>
                <div
                  onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                  className="grid grid-cols-[2fr_100px_100px_100px_120px_100px] gap-4 px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors items-center"
                >
                  <div>
                    <div className="font-medium mb-1 line-clamp-2 text-foreground">{lead.title}</div>
                    <div className="flex gap-2 flex-wrap">
                      {lead.keywords_extracted?.slice(0, 3).map((kw) => (
                        <span
                          key={kw}
                          className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-foreground">{lead.source === "Reddit" ? "\u{1F534}" : "\u{1F535}"} {lead.source}</div>
                    <div className="text-xs text-muted-foreground">{lead.subreddit || lead.platform}</div>
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
                    <div className="bg-muted rounded-full h-1 mt-1">
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
                    <div className="font-semibold text-foreground">
                      {lead.upvotes >= 1000 ? (lead.upvotes / 1000).toFixed(1) + "k" : lead.upvotes}
                    </div>
                    <div className="text-xs text-muted-foreground">{lead.comments} comments</div>
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
                          ? "bg-green-500/10 text-green-500"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {lead.status === "validated" ? "\u2713 Valid" : "\u25F7 Queue"}
                    </span>
                  </div>
                </div>

                {selectedLead?.id === lead.id && (
                  <div className="px-6 py-4 bg-muted/30 border-t border-border space-y-3">
                    <div className="text-sm text-primary font-medium">&#x25B8; FULL ANALYSIS</div>
                    <div className="text-foreground/80 leading-relaxed">{lead.body}</div>
                    <div className="flex gap-4 text-sm">
                      <div className="text-muted-foreground">
                        Category: <span className="text-foreground">{lead.category}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Platform: <span className="text-foreground">{lead.source} / {lead.subreddit || lead.platform}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Pain Score: <span className="text-orange-400">{lead.pain_score}/100</span>
                      </div>
                    </div>
                    {lead.jadisatu_solution && (
                      <div className="bg-card border border-border rounded-lg p-4">
                        <div className="text-sm text-green-500 font-medium mb-2">&#x1F4A1; JadiSatu Solution</div>
                        <div className="text-foreground/80 text-sm">{lead.jadisatu_solution}</div>
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
  );
}
