"use client";

import { useState, useEffect } from "react";
import { Search, TrendingUp, Target, Radar, Zap, Loader2, Users, ArrowUpRight } from "lucide-react";
import { leadToOutreach } from '@/lib/mandala-outreach';

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

const OPPORTUNITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Very High": { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-600" },
  "High": { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-600" },
  "Medium": { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500" },
  "Low": { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400" },
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("Semua");
  const [categories, setCategories] = useState<string[]>(["Semua"]);
  const [sendingToMandala, setSendingToMandala] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const leadsRes = await fetch("/api/leads");
        if (!leadsRes.ok) throw new Error("Failed to fetch leads");
        const leadsData = await leadsRes.json();
        setLeads(leadsData.data || []);

        const statsRes = await fetch("/api/leads?stats=true");
        if (!statsRes.ok) throw new Error("Failed to fetch stats");
        const statsData = await statsRes.json();
        setStats(statsData);

        const cats = ["Semua", ...Object.keys(statsData.categories || {})];
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

  async function sendToMandala(lead: Lead) {
    setSendingToMandala(lead.id);
    try {
      const outreach = leadToOutreach({
        id: lead.id,
        title: lead.title,
        body: lead.body,
        platform: lead.platform,
        category: lead.category,
        pain_score: lead.pain_score,
        status: lead.status,
      });
      const res = await fetch('/api/mandala/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outreach),
      });
      if (!res.ok) throw new Error('Failed to queue');
    } catch (err) {
      console.error('Failed to send to Mandala:', err);
    }
    setSendingToMandala(null);
  }

  const filtered = leads.filter((l) => {
    const matchCat = activeFilter === "Semua" || l.category === activeFilter;
    const matchSearch =
      !searchTerm ||
      l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.body.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <div className="text-slate-500 font-medium tracking-wide">Mencari leads terbaik...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationFillMode: 'both' }}>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight text-slate-900">
            <Radar className="text-blue-600" size={32} />
            Trend Hunter
          </h1>
          <p className="text-slate-500 font-light">
            Mendeteksi <span className="text-blue-600 font-medium">{stats?.total_collected || 0} peluang</span> bisnis dalam 24 jam terakhir.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-4 py-2 text-blue-600 text-xs font-bold tracking-widest uppercase">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            Hunter Aktif
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.1s', animationFillMode: 'both' }}>
          {[
            { label: "TOTAL PELUANG", value: stats.total_collected.toLocaleString(), change: "+24h", color: "text-blue-600", icon: Target },
            { label: "DITEMUKAN HARI INI", value: stats.today_new, change: "new", color: "text-emerald-600", icon: TrendingUp },
            { label: "PELUANG TINGGI", value: stats.high_opportunity, change: "leads", color: "text-blue-600", icon: Zap },
            { label: "RATA-RATA SKOR", value: stats.avg_pain_score, change: "skor", color: "text-purple-600", icon: Radar },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_8px_24px_rgba(0,96,225,0.08)]">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-slate-50">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{s.change}</span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold tracking-[0.15em] uppercase mb-2">
                {s.label}
              </div>
              <div className={`text-3xl font-bold tracking-tight ${s.color}`}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center gap-4" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.2s', animationFillMode: 'both' }}>
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari kata kunci problem..."
            className="w-full bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] pl-12 pr-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto no-scrollbar py-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all whitespace-nowrap ${
                activeFilter === cat
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                  : "bg-white text-slate-500 shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-md hover:text-slate-900"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.05)]" style={{ animation: 'slide-up 0.5s cubic-bezier(0.16,1,0.3,1)', animationDelay: '0.3s', animationFillMode: 'both' }}>
        <div className="hidden md:grid grid-cols-[1fr_120px_100px_140px_100px] gap-6 px-8 py-4 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em]">
          <div>Analisis Masalah</div>
          <div>Sumber</div>
          <div className="text-center">Skor Kebutuhan</div>
          <div>Level Peluang</div>
          <div className="text-right">Aksi</div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="px-8 py-20 text-center text-slate-400 space-y-4">
              <Users className="w-12 h-12 mx-auto opacity-20" />
              <p className="text-sm">Tidak ada leads yang sesuai kriteria saat ini.</p>
            </div>
          ) : (
            filtered.map((lead) => (
              <div key={lead.id} className="group transition-all">
                <div
                  onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                  className="grid grid-cols-1 md:grid-cols-[1fr_120px_100px_140px_100px] gap-4 md:gap-6 px-6 md:px-8 py-5 md:py-6 cursor-pointer hover:bg-slate-50 items-center"
                >
                  <div className="min-w-0 space-y-2">
                    <h3 className="font-semibold text-sm line-clamp-1 text-slate-900 group-hover:text-blue-600 transition-colors">{lead.title}</h3>
                    <div className="flex gap-1.5 flex-wrap">
                      {lead.keywords_extracted?.slice(0, 3).map((kw) => (
                        <span key={kw} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${lead.source === "Reddit" ? "bg-orange-500" : "bg-blue-500"}`} />
                      {lead.source}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold truncate">
                      {lead.subreddit || lead.platform}
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className={`text-lg font-bold ${lead.pain_score >= 80 ? 'text-emerald-600' : lead.pain_score >= 50 ? 'text-blue-600' : 'text-slate-400'}`}>
                      {lead.pain_score}
                    </div>
                    <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full rounded-full ${lead.pain_score >= 80 ? 'bg-emerald-500' : lead.pain_score >= 50 ? 'bg-blue-500' : 'bg-slate-300'}`} style={{ width: lead.pain_score + "%" }} />
                    </div>
                  </div>

                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${OPPORTUNITY_COLORS[lead.opportunity_level || "Medium"].bg} ${OPPORTUNITY_COLORS[lead.opportunity_level || "Medium"].text}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${OPPORTUNITY_COLORS[lead.opportunity_level || "Medium"].dot}`} />
                      {lead.opportunity_level || "Medium"}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <div className="p-2.5 rounded-xl bg-slate-50 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all text-slate-400">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {selectedLead?.id === lead.id && (
                  <div className="px-6 md:px-8 py-8 bg-slate-50/50 border-t border-slate-100 space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">Analisis Konteks</h4>
                        <p className="text-slate-600 text-sm leading-relaxed">{lead.body}</p>
                        <div className="flex gap-6 py-4 border-t border-slate-200">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Interaksi</p>
                            <p className="text-sm font-bold text-slate-900">{lead.upvotes} Upvote / {lead.comments} Komentar</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Target Pasar</p>
                            <p className="text-sm font-bold text-slate-900">{lead.category}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em]">Rekomendasi JadiSatu</h4>
                        <div className="bg-emerald-50/50 p-6 rounded-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Zap className="w-12 h-12 text-emerald-500" />
                          </div>
                          <p className="text-slate-700 text-sm font-medium leading-relaxed relative z-10">
                            {lead.jadisatu_solution || "Sistem mendeteksi urgensi tinggi. Mandala menyarankan pendekatan 'Value-First' dengan mengirimkan case study yang relevan."}
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); sendToMandala(lead); }}
                            disabled={sendingToMandala === lead.id}
                            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
                          >
                            {sendingToMandala === lead.id ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Zap size={18} />
                            )}
                            Kirim ke Mandala
                          </button>
                          <a
                            href={lead.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3.5 rounded-2xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all text-slate-600"
                          >
                            <ArrowUpRight className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                    </div>
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
