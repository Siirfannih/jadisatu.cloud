"use client";

import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    "Very High": { bg: "rgba(16,185,129,0.15)", text: "#10b981", dot: "#10b981" },
    "High": { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", dot: "#f59e0b" },
    "Medium": { bg: "rgba(99,102,241,0.15)", text: "#6366f1", dot: "#6366f1" },
};

export default function HunterAgentDashboard() {
    const [activeFilter, setActiveFilter] = useState("All");
    const [selectedProblem, setSelectedProblem] = useState<any>(null);
    const [agentRunning, setAgentRunning] = useState(true);
    const [pulseActive, setPulseActive] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [tab, setTab] = useState("problems");

    // Real data states
    const [problems, setProblems] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [categories, setCategories] = useState<string[]>(["All"]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch data from API
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                // Fetch stats
                const statsRes = await fetch(`${API_BASE}/api/stats`);
                if (!statsRes.ok) throw new Error("Failed to fetch stats");
                const statsData = await statsRes.json();
                setStats(statsData);

                // Fetch problems
                const problemsRes = await fetch(`${API_BASE}/api/problems`);
                if (!problemsRes.ok) throw new Error("Failed to fetch problems");
                const problemsData = await problemsRes.json();

                // Transform data to match UI format
                const transformedProblems = (problemsData.data || []).map((p: any) => ({
                    id: p.id,
                    source: p.source,
                    subreddit: p.subreddit || p.category,
                    platform_icon: p.source === "Reddit" ? "🔴" : "🔵",
                    title: p.title,
                    body: p.body || p.summary || "",
                    upvotes: p.upvotes || 0,
                    comments: p.comments || 0,
                    pain_score: p.pain_score,
                    category: p.category,
                    keywords: p.keywords_extracted || [],
                    timestamp: p.timestamp || "Unknown",
                    validated: p.validated || false,
                    opportunity: p.opportunity_level || (p.pain_score >= 90 ? "Very High" : p.pain_score >= 80 ? "High" : "Medium"),
                }));

                setProblems(transformedProblems);

                // Extract unique categories
                const cats = ["All", ...Object.keys(statsData.categories || {})];
                setCategories(cats);

                setError(null);
            } catch (err: any) {
                console.error("Error fetching data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            if (agentRunning) {
                setPulseActive(p => !p);
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [agentRunning]);

    const filtered = problems.filter(p => {
        const matchCat = activeFilter === "All" || p.category === activeFilter;
        const matchSearch = !searchTerm ||
            p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.body.toLowerCase().includes(searchTerm.toLowerCase());
        return matchCat && matchSearch;
    });

    return (
        <div style={{
            minHeight: "100vh",
            background: "#0a0a0f",
            color: "#e2e8f0",
            fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
            fontSize: "13px",
        }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .card { background: #111118; border: 1px solid #1e1e2e; border-radius: 8px; }
        .card:hover { border-color: #2a2a3e; transition: border-color 0.2s; }
        .btn { cursor: pointer; border: none; border-radius: 6px; padding: 6px 14px; font-family: inherit; font-size: 12px; transition: all 0.15s; }
        .pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        .pulse { animation: pulseAnim 2s ease-in-out infinite; }
        @keyframes pulseAnim { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        .scan-line { position: relative; overflow: hidden; }
        .scan-line::after { content:''; position:absolute; top:0;left:-100%;width:60%;height:100%; background: linear-gradient(90deg, transparent, rgba(99,102,241,0.06), transparent); animation: scan 3s linear infinite; }
        @keyframes scan { to{left:200%;} }
        .row-hover:hover { background: rgba(255,255,255,0.02); cursor: pointer; }
        .tab-active { border-bottom: 2px solid #6366f1; color: #6366f1; }
      `}</style>

            {/* TOP NAV */}
            <div style={{ background: "#0d0d16", borderBottom: "1px solid #1a1a28", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 18, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
                        ◈ HUNTER<span style={{ color: "#6366f1" }}>AGENT</span>
                    </div>
                    <div style={{ background: agentRunning ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${agentRunning ? "#10b981" : "#ef4444"}33`, borderRadius: 4, padding: "2px 10px", fontSize: 11, color: agentRunning ? "#10b981" : "#ef4444", display: "flex", alignItems: "center", gap: 5 }}>
                        <span className={agentRunning ? "pulse" : ""} style={{ width: 6, height: 6, background: agentRunning ? "#10b981" : "#ef4444", borderRadius: "50%", display: "inline-block" }} />
                        {agentRunning ? "AGENT RUNNING 24/7" : "AGENT STOPPED"}
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ color: "#666", fontSize: 11 }}>
                        🕐 {new Date().toLocaleTimeString()}
                    </div>
                    <button
                        className="btn"
                        onClick={() => setAgentRunning(r => !r)}
                        style={{ background: agentRunning ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", color: agentRunning ? "#ef4444" : "#10b981", border: `1px solid ${agentRunning ? "#ef444433" : "#10b98133"}` }}
                    >
                        {agentRunning ? "⏸ Pause Agent" : "▶ Start Agent"}
                    </button>
                </div>
            </div>

            <div style={{ padding: "20px 24px", maxWidth: 1400, margin: "0 auto" }}>

                {/* Loading State */}
                {loading && (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "#666" }}>
                        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
                        <div style={{ fontSize: 16 }}>Loading Hunter Agent data...</div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div style={{ textAlign: "center", padding: "60px 20px" }}>
                        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
                        <div style={{ color: "#ef4444", fontSize: 16, marginBottom: 8 }}>Failed to load data</div>
                        <div style={{ color: "#666", fontSize: 14 }}>{error}</div>
                    </div>
                )}

                {/* Data Loaded */}
                {!loading && !error && stats && (
                    <>
                        {/* STATS ROW */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
                            {[
                                { label: "TOTAL COLLECTED", value: stats.total_collected?.toLocaleString() || "0", color: "#6366f1", icon: "📦" },
                                { label: "NEW TODAY", value: `+${stats.today_new || 0}`, color: "#10b981", icon: "⚡" },
                                { label: "VERY HIGH OPP.", value: stats.high_opportunity || 0, color: "#f59e0b", icon: "🔥" },
                                { label: "AVG PAIN SCORE", value: stats.avg_pain_score || 0, color: "#10b981", icon: "📊" },
                                { label: "SOURCES ACTIVE", value: stats.sources_active || 0, color: "#6366f1", icon: "🌐" },
                                { label: "KEYWORDS", value: stats.keywords_tracked || 0, color: "#a78bfa", icon: "🎯" },
                            ].map((s, i) => (
                                <div key={i} className="card scan-line" style={{ padding: "14px 16px" }}>
                                    <div style={{ color: "#444", fontSize: 10, letterSpacing: "1px", marginBottom: 8 }}>{s.icon} {s.label}</div>
                                    <div style={{ fontSize: 22, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, color: s.color }}>{s.value}</div>
                                </div>
                            ))}
                        </div>

                        {/* FILTERS */}
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                            <input
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="🔎 Search problems..."
                                style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 6, padding: "7px 12px", color: "#e2e8f0", fontFamily: "inherit", fontSize: 12, width: 220, outline: "none" }}
                            />
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    className="btn"
                                    onClick={() => setActiveFilter(cat)}
                                    style={{
                                        background: activeFilter === cat ? "rgba(99,102,241,0.2)" : "#111118",
                                        color: activeFilter === cat ? "#a78bfa" : "#555",
                                        border: `1px solid ${activeFilter === cat ? "#6366f144" : "#1e1e2e"}`,
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                            <span style={{ color: "#333", marginLeft: "auto" }}>{filtered.length} results</span>
                        </div>

                        {/* PROBLEMS TABLE */}
                        <div className="card" style={{ overflow: "hidden" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "2fr 90px 80px 80px 100px 80px", gap: 12, padding: "10px 16px", borderBottom: "1px solid #1a1a28", color: "#444", fontSize: 10, letterSpacing: "0.8px" }}>
                                <span>PROBLEM / TITLE</span>
                                <span>SOURCE</span>
                                <span>PAIN SCORE</span>
                                <span>UPVOTES</span>
                                <span>OPPORTUNITY</span>
                                <span>STATUS</span>
                            </div>
                            {filtered.map((p) => (
                                <div
                                    key={p.id}
                                    className="row-hover"
                                    style={{ display: "grid", gridTemplateColumns: "2fr 90px 80px 80px 100px 80px", gap: 12, padding: "12px 16px", borderBottom: "1px solid #111", alignItems: "center" }}
                                    onClick={() => setSelectedProblem(selectedProblem?.id === p.id ? null : p)}
                                >
                                    <div>
                                        <div style={{ color: "#e2e8f0", marginBottom: 4, lineHeight: 1.4 }}>{p.title}</div>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            {p.keywords.slice(0, 3).map(k => (
                                                <span key={k} style={{ background: "#1a1a2e", color: "#6366f1", padding: "1px 7px", borderRadius: 10, fontSize: 10 }}>#{k}</span>
                                            ))}
                                            <span style={{ color: "#444", fontSize: 10 }}>{p.timestamp}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span>{p.platform_icon}</span>
                                        <div>
                                            <div style={{ color: "#aaa", fontSize: 11 }}>{p.source}</div>
                                            <div style={{ color: "#555", fontSize: 10 }}>{p.subreddit}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 16, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, color: p.pain_score >= 90 ? "#10b981" : p.pain_score >= 80 ? "#f59e0b" : "#6366f1" }}>{p.pain_score}</div>
                                        <div style={{ background: "#1a1a1a", borderRadius: 10, height: 3, marginTop: 4 }}>
                                            <div style={{ width: `${p.pain_score}%`, height: "100%", background: p.pain_score >= 90 ? "#10b981" : p.pain_score >= 80 ? "#f59e0b" : "#6366f1", borderRadius: 10 }} />
                                        </div>
                                    </div>
                                    <div style={{ color: "#e2e8f0", fontWeight: 600 }}>
                                        {p.upvotes >= 1000 ? `${(p.upvotes / 1000).toFixed(1)}k` : p.upvotes}
                                        <div style={{ color: "#555", fontSize: 10 }}>{p.comments} cmts</div>
                                    </div>
                                    <div>
                                        <span className="pill" style={{ background: STATUS_COLORS[p.opportunity].bg, color: STATUS_COLORS[p.opportunity].text }}>
                                            <span style={{ width: 5, height: 5, background: STATUS_COLORS[p.opportunity].dot, borderRadius: "50%" }} />
                                            {p.opportunity}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="pill" style={p.validated ? { background: "rgba(16,185,129,0.1)", color: "#10b981" } : { background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                                            {p.validated ? "✓ Valid" : "◷ Queue"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {selectedProblem && (
                                <div style={{ padding: "16px 20px", background: "#0d0d16", borderTop: "1px solid #1a1a28" }}>
                                    <div style={{ color: "#a78bfa", fontSize: 11, marginBottom: 6 }}>▸ FULL ANALYSIS — {selectedProblem.title}</div>
                                    <div style={{ color: "#aaa", lineHeight: 1.7, marginBottom: 10 }}>{selectedProblem.body}</div>
                                    <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
                                        <div className="pill" style={{ background: "rgba(99,102,241,0.1)", color: "#a78bfa" }}>📂 {selectedProblem.category}</div>
                                        <div style={{ color: "#555" }}>Platform: <span style={{ color: "#e2e8f0" }}>{selectedProblem.source} / {selectedProblem.subreddit}</span></div>
                                        <div style={{ color: "#555" }}>Pain Score: <span style={{ color: "#f59e0b" }}>{selectedProblem.pain_score}/100</span></div>
                                    </div>
                                    <div style={{ marginTop: 10, padding: 12, background: "#111118", borderRadius: 6, border: "1px solid #1e1e2e" }}>
                                        <div style={{ color: "#10b981", fontSize: 11, marginBottom: 4 }}>💡 Jadisatu Solution</div>
                                        <div style={{ color: "#aaa", fontSize: 12 }}>
                                            This pain point is <strong style={{ color: "#e2e8f0" }}>highly relevant</strong> to Jadisatu's services.
                                            We can offer: <strong style={{ color: "#10b981" }}>Affordable {selectedProblem.category.replace(" Gap", "")} Solutions</strong> starting from Rp 375k/month.
                                            Opportunity level: <strong style={{ color: STATUS_COLORS[selectedProblem.opportunity].text }}>{selectedProblem.opportunity}</strong>.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
