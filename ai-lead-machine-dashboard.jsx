import { useState, useEffect, useCallback } from "react";
import { Activity, Zap, Globe, Mail, MousePointerClick, MessageSquare, Rocket, RefreshCw, ChevronRight, Circle, ArrowUpRight, Layers, Target, Send, BarChart3, Clock, CheckCircle2, AlertCircle, XCircle, Sparkles } from "lucide-react";

const API = "http://localhost:3000";

const MOCK_STATS = { total_leads: 247, qualified: 183, demos_built: 94, contacted: 71, replied: 12, emails_today: 8 };
const MOCK_CAMPAIGNS = [
  { id: "1", name: "dentists-austin-tx", niche: "dentists", city: "Austin", country_code: "US", status: "active", keywords: ["dentist", "dental clinic"], send_limit: 15 },
  { id: "2", name: "plumbers-exeter-uk", niche: "plumbers", city: "Exeter", country_code: "GB", status: "active", keywords: ["plumber", "plumbing"], send_limit: 10 },
  { id: "3", name: "restaurants-nashik-in", niche: "restaurants", city: "Nashik", country_code: "IN", status: "paused", keywords: ["restaurant", "cafe"], send_limit: 10 },
];
const MOCK_ACTIVITY = [
  { id: "1", type: "scrape", message: "Found: Bright Smile Dental Clinic", created_at: new Date(Date.now() - 120000).toISOString() },
  { id: "2", type: "qualify", message: "Qualified (9/10): Austin Family Dentistry", created_at: new Date(Date.now() - 300000).toISOString() },
  { id: "3", type: "build", message: "Demo site built: River City Plumbing", created_at: new Date(Date.now() - 600000).toISOString() },
  { id: "4", type: "email", message: "Email #1 sent to Nashik Spice Garden", created_at: new Date(Date.now() - 900000).toISOString() },
  { id: "5", type: "reply", message: "REPLY from Lone Star Dental!", created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: "6", type: "qualify", message: "Rejected (3/10): TechHub Austin", created_at: new Date(Date.now() - 2400000).toISOString() },
  { id: "7", type: "build", message: "Demo site built: Exeter Emergency Plumber", created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "8", type: "email", message: "Email #2 sent to Devon Drains Ltd", created_at: new Date(Date.now() - 5400000).toISOString() },
];
const MOCK_LEADS = [
  { id: "1", business_name: "Bright Smile Dental", niche: "dentists", city: "Austin", website_score: 9, status: "qualified", demo_site_url: null },
  { id: "2", business_name: "River City Plumbing", niche: "plumbers", city: "Exeter", website_score: 10, status: "demo_built", demo_site_url: "https://river-city-demo.vercel.app" },
  { id: "3", business_name: "Nashik Spice Garden", niche: "restaurants", city: "Nashik", website_score: 8, status: "contacted", demo_site_url: "https://nashik-spice-demo.vercel.app" },
  { id: "4", business_name: "Lone Star Dental", niche: "dentists", city: "Austin", website_score: 7, status: "replied", demo_site_url: "https://lone-star-demo.vercel.app" },
  { id: "5", business_name: "Devon Drains Ltd", niche: "plumbers", city: "Exeter", website_score: 10, status: "contacted", demo_site_url: "https://devon-drains-demo.vercel.app" },
  { id: "6", business_name: "TechHub Austin", niche: "dentists", city: "Austin", website_score: 3, status: "archived", demo_site_url: null },
];

const typeColors = { scrape: "#6366f1", qualify: "#22d3ee", build: "#a78bfa", email: "#f59e0b", reply: "#10b981", convert: "#10b981" };
const typeIcons = { scrape: Globe, qualify: Target, build: Layers, email: Send, reply: MessageSquare, convert: CheckCircle2 };
const statusConfig = {
  new: { color: "#64748b", bg: "#1e293b", label: "New" },
  qualified: { color: "#22d3ee", bg: "#0e3a4a", label: "Qualified" },
  demo_built: { color: "#a78bfa", bg: "#2e1f5e", label: "Demo Built" },
  contacted: { color: "#f59e0b", bg: "#3d2e0a", label: "Contacted" },
  replied: { color: "#10b981", bg: "#0a3d2e", label: "Replied" },
  converted: { color: "#10b981", bg: "#0a3d2e", label: "Converted" },
  archived: { color: "#475569", bg: "#1e293b", label: "Archived" },
};

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Dashboard() {
  const [stats, setStats] = useState(MOCK_STATS);
  const [campaigns, setCampaigns] = useState(MOCK_CAMPAIGNS);
  const [activity, setActivity] = useState(MOCK_ACTIVITY);
  const [leads, setLeads] = useState(MOCK_LEADS);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(null);
  const [tab, setTab] = useState("overview");

  const fetchAll = useCallback(async () => {
    try {
      const [s, c, a, l] = await Promise.all([
        fetch(`${API}/api/stats`).then(r => r.json()),
        fetch(`${API}/api/campaigns`).then(r => r.json()),
        fetch(`${API}/api/activity?limit=20`).then(r => r.json()),
        fetch(`${API}/api/leads?limit=20`).then(r => r.json()),
      ]);
      setStats(s); setCampaigns(c); setActivity(a); setLeads(l);
      setConnected(true);
    } catch { setConnected(false); }
  }, []);

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 15000); return () => clearInterval(i); }, [fetchAll]);

  const triggerAction = async (endpoint, label) => {
    setRunning(label);
    try {
      await fetch(`${API}/api/run/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" } });
      setTimeout(fetchAll, 3000);
    } catch {}
    setTimeout(() => setRunning(null), 4000);
  };

  const funnelStages = [
    { key: "total_leads", label: "Discovered", value: stats.total_leads, icon: Globe, color: "#6366f1" },
    { key: "qualified", label: "Qualified", value: stats.qualified, icon: Target, color: "#22d3ee" },
    { key: "demos_built", label: "Demo Sites", value: stats.demos_built, icon: Layers, color: "#a78bfa" },
    { key: "contacted", label: "Contacted", value: stats.contacted, icon: Send, color: "#f59e0b" },
    { key: "replied", label: "Replied", value: stats.replied, icon: MessageSquare, color: "#10b981" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A", color: "#e2e8f0", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slide-in { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
        .stat-card:hover { transform: translateY(-2px); border-color: #2a3352; }
        .action-btn:hover { background: #1e293b !important; border-color: #6366f1 !important; }
        .action-btn:active { transform: scale(0.97); }
        .lead-row:hover { background: #141928 !important; }
        .tab-btn { cursor: pointer; padding: 8px 16px; border-radius: 8px; border: none; background: transparent; color: #64748b; font-size: 13px; font-weight: 500; font-family: inherit; transition: all .2s; }
        .tab-btn:hover { color: #e2e8f0; }
        .tab-active { background: #141928; color: #e2e8f0 !important; }
      `}</style>

      {/* ===== HEADER ===== */}
      <header style={{ padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #141928" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}>Lead Machine</h1>
            <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>ai-powered pipeline</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: connected ? "#10b981" : "#64748b" }}>
            <Circle size={7} fill={connected ? "#10b981" : "#64748b"} stroke="none" style={connected ? { animation: "pulse-dot 2s infinite" } : {}} />
            {connected ? "Live" : "Demo mode"}
          </div>
          <div style={{ padding: "6px 12px", borderRadius: 8, background: "#141928", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#f59e0b" }}>
            <Mail size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />{stats.emails_today} sent today
          </div>
          <button onClick={fetchAll} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* ===== TABS ===== */}
      <div style={{ padding: "16px 32px 0", display: "flex", gap: 4 }}>
        {[["overview", "Overview"], ["leads", "Leads"], ["campaigns", "Campaigns"]].map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? "tab-active" : ""}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      <main style={{ padding: "24px 32px", maxWidth: 1280, margin: "0 auto" }}>

        {tab === "overview" && <>
          {/* ===== PIPELINE FUNNEL ===== */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <BarChart3 size={14} color="#64748b" /><span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pipeline funnel</span>
            </div>
            <div style={{ display: "flex", gap: 2, alignItems: "stretch" }}>
              {funnelStages.map((stage, i) => {
                const pct = stats.total_leads > 0 ? Math.max(8, (stage.value / stats.total_leads) * 100) : 20;
                const Icon = stage.icon;
                return (
                  <div key={stage.key} style={{ flex: 1, background: "#141928", borderRadius: i === 0 ? "12px 0 0 12px" : i === funnelStages.length - 1 ? "0 12px 12px 0" : 0, padding: "20px 16px", position: "relative", overflow: "hidden", border: "1px solid #1a2035", borderLeft: i > 0 ? "none" : undefined }}>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${pct}%`, background: `${stage.color}10`, transition: "height 1s ease" }} />
                    <div style={{ position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <Icon size={13} color={stage.color} />
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{stage.label}</span>
                      </div>
                      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: stage.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{stage.value}</div>
                      {i > 0 && stats.total_leads > 0 && (
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                          {((stage.value / funnelStages[i - 1].value) * 100 || 0).toFixed(0)}% conv.
                        </div>
                      )}
                    </div>
                    {i < funnelStages.length - 1 && (
                      <ChevronRight size={14} color="#1e293b" style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", zIndex: 1 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== GRID: ACTIVITY + ACTIONS ===== */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, marginBottom: 32 }}>

            {/* Activity Feed */}
            <div style={{ background: "#141928", borderRadius: 12, border: "1px solid #1a2035", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a2035", display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={14} color="#64748b" />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8" }}>Live Activity</span>
                <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "pulse-dot 2s infinite" }} />
              </div>
              <div style={{ maxHeight: 340, overflowY: "auto", padding: "8px 0" }}>
                {activity.map((item, i) => {
                  const Icon = typeIcons[item.type] || Activity;
                  const clr = typeColors[item.type] || "#64748b";
                  return (
                    <div key={item.id || i} style={{ padding: "10px 20px", display: "flex", alignItems: "flex-start", gap: 12, animation: `slide-in 0.3s ease ${i * 0.05}s both` }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${clr}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        <Icon size={13} color={clr} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: item.type === "reply" ? "#10b981" : "#cbd5e1", fontWeight: item.type === "reply" ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.message}
                        </div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{timeAgo(item.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                {activity.length === 0 && (
                  <div style={{ padding: 40, textAlign: "center", color: "#475569", fontSize: 13 }}>No activity yet. Run the pipeline to get started.</div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Rocket size={14} color="#64748b" /><span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>Quick Actions</span>
              </div>
              {[
                { label: "Run Full Pipeline", desc: "Scrape → Qualify → Build → Email", endpoint: "full-pipeline", icon: Sparkles, color: "#6366f1" },
                { label: "Scrape Leads", desc: "Find new businesses", endpoint: "scrape", icon: Globe, color: "#22d3ee" },
                { label: "Qualify Leads", desc: "AI score & filter", endpoint: "qualify", icon: Target, color: "#a78bfa" },
                { label: "Build Demo Sites", desc: "Generate websites", endpoint: "build-sites", icon: Layers, color: "#f59e0b" },
                { label: "Send Outreach", desc: "Emails + follow-ups", endpoint: "outreach", icon: Send, color: "#10b981" },
              ].map(action => (
                <button key={action.endpoint} className="action-btn" onClick={() => triggerAction(action.endpoint, action.label)}
                  disabled={running === action.label}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#0f1424", border: "1px solid #1a2035", borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all .2s", width: "100%", opacity: running && running !== action.label ? 0.5 : 1 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `${action.color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <action.icon size={15} color={action.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{running === action.label ? "Running..." : action.label}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{action.desc}</div>
                  </div>
                  <ArrowUpRight size={14} color="#334155" />
                </button>
              ))}
            </div>
          </div>
        </>}

        {/* ===== LEADS TAB ===== */}
        {tab === "leads" && (
          <div style={{ background: "#141928", borderRadius: 12, border: "1px solid #1a2035", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a2035", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MousePointerClick size={14} color="#64748b" />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8" }}>Lead Pipeline</span>
                <span style={{ fontSize: 11, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>{leads.length} leads</span>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a2035" }}>
                    {["Business", "Niche", "City", "Score", "Status", "Demo Site"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#475569", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => {
                    const sc = statusConfig[lead.status] || statusConfig.new;
                    return (
                      <tr key={lead.id || i} className="lead-row" style={{ borderBottom: "1px solid #0f1424", transition: "background .15s", cursor: "default" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 500, color: "#e2e8f0" }}>{lead.business_name}</td>
                        <td style={{ padding: "12px 16px", color: "#94a3b8" }}>{lead.niche}</td>
                        <td style={{ padding: "12px 16px", color: "#94a3b8" }}>{lead.city}</td>
                        <td style={{ padding: "12px 16px" }}>
                          {lead.website_score != null ? (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: lead.website_score >= 8 ? "#10b981" : lead.website_score >= 6 ? "#f59e0b" : "#ef4444" }}>
                              {lead.website_score}/10
                            </span>
                          ) : <span style={{ color: "#334155" }}>—</span>}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, color: sc.color, background: sc.bg }}>{sc.label}</span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {lead.demo_site_url ? (
                            <a href={lead.demo_site_url} target="_blank" rel="noreferrer" style={{ color: "#6366f1", textDecoration: "none", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                              View <ArrowUpRight size={11} />
                            </a>
                          ) : <span style={{ color: "#334155" }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {leads.length === 0 && (
                <div style={{ padding: 48, textAlign: "center", color: "#475569" }}>No leads yet. Run the scraper to discover businesses.</div>
              )}
            </div>
          </div>
        )}

        {/* ===== CAMPAIGNS TAB ===== */}
        {tab === "campaigns" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {campaigns.map((c, i) => (
              <div key={c.id || i} style={{ background: "#141928", borderRadius: 12, border: "1px solid #1a2035", padding: 20, transition: "border-color .2s" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.status === "active" ? "#10b981" : "#475569" }} />
                    <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{c.name}</span>
                  </div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: c.status === "active" ? "#0a3d2e" : "#1e293b", color: c.status === "active" ? "#10b981" : "#64748b", fontWeight: 500 }}>
                    {c.status}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12, color: "#94a3b8" }}>
                  <div><span style={{ color: "#475569" }}>Niche:</span> {c.niche}</div>
                  <div><span style={{ color: "#475569" }}>Location:</span> {c.city}, {c.country_code}</div>
                  <div><span style={{ color: "#475569" }}>Keywords:</span> {(c.keywords || []).length}</div>
                  <div><span style={{ color: "#475569" }}>Daily limit:</span> {c.send_limit}</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={() => triggerAction("scrape", `scrape-${c.id}`)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Run Scrape
                  </button>
                  <button style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: c.status === "active" ? "#f59e0b" : "#10b981", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    {c.status === "active" ? "Pause" : "Resume"}
                  </button>
                </div>
              </div>
            ))}
            {/* Add campaign card */}
            <div style={{ background: "#0f1424", borderRadius: 12, border: "1px dashed #1e293b", padding: 20, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 180, cursor: "pointer" }}
              onClick={() => alert("Create campaign via API:\ncurl -X POST localhost:3000/api/campaigns ...")}>
              <div style={{ textAlign: "center", color: "#334155" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>+</div>
                <div style={{ fontSize: 13 }}>Add Campaign</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
