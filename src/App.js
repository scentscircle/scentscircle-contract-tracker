import React, { useState, useEffect, useMemo, useCallback } from "react";

const SHEET_URL = "https://script.google.com/macros/s/AKfycbyRFsmcWSx9Bw6v36Vz_emY5i-MANZ5C99FOADwGXeqYodER3ECLJYP7mR-3_ZNwF0OwA/exec";

const STATUS = {
  EXPIRED: { color: "#ef4444", bg: "#2d1515", dot: "#ef4444" },
  CRITICAL: { color: "#f97316", bg: "#2d1e0f", dot: "#f97316" },
  WARNING: { color: "#eab308", bg: "#2a2510", dot: "#eab308" },
  SOON: { color: "#3b82f6", bg: "#0f1e2d", dot: "#3b82f6" },
  ACTIVE: { color: "#22c55e", bg: "#0f2d1a", dot: "#22c55e" },
};

const EMIRATES = ["Abu Dhabi","Dubai","Sharjah","Ajman","Umm Al Quwain","Ras Al Khaimah","Fujairah"];

function getStatus(endDate) {
  const today = new Date(); today.setHours(0,0,0,0);
  const clean = String(endDate).split("T")[0];
  const [y,m,dd] = clean.split("-");
  const end = new Date(parseInt(y), parseInt(m)-1, parseInt(dd));
  const diff = Math.ceil((end - today) / 86400000);
  if (diff < 0)  return { ...STATUS.EXPIRED, days: diff };
  if (diff < 7)  return { ...STATUS.CRITICAL, days: diff };
  if (diff < 30) return { ...STATUS.WARNING, days: diff };
  if (diff < 60) return { ...STATUS.SOON, days: diff };
  return { ...STATUS.ACTIVE, days: diff };
}

function formatDate(d) {
  if (!d) return "—";
  const clean = String(d).split("T")[0];
  const [year, month, day] = clean.split("-");
  if (!year || !month || !day) return "—";
  return `${day.padStart(2,"0")} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(month)-1]} ${year}`;
}

const emptyForm = { client: "", type: "", start: "", end: "", value: "", monthlyValue: "", currency: "AED", contact: "", contractStatus: "active", emirate: "", location: "" };
const PAGE_SIZE = 15;

function PaginationBar({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const siblings = 1;
  const range = (start, end) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
  let left = Math.max(2, currentPage - siblings);
  let right = Math.min(totalPages - 1, currentPage + siblings);
  const showLeftDots = left > 2;
  const showRightDots = right < totalPages - 1;
  pages.push(1);
  if (showLeftDots) pages.push("...");
  pages.push(...range(left, right));
  if (showRightDots) pages.push("...");
  if (totalPages > 1) pages.push(totalPages);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
        style={{ cursor: currentPage === 1 ? "not-allowed" : "pointer", background: "transparent", border: "1px solid #2a2a38", borderRadius: 8, color: currentPage === 1 ? "#333" : "#9090a8", padding: "6px 12px", fontSize: 13, fontFamily: "Poppins, sans-serif", fontWeight: 600 }}>
        ← Prev
      </button>
      {pages.map((page, i) =>
        page === "..." ? (
          <span key={"dots" + i} style={{ color: "#7a6a30", padding: "0 4px", fontSize: 13 }}>•••</span>
        ) : (
          <button key={page} onClick={() => onPageChange(page)}
            style={{ cursor: "pointer", background: currentPage === page ? "#1e1e35" : "transparent", border: `1px solid ${currentPage === page ? "#6366f1" : "#2a2a38"}`, borderRadius: 8, color: currentPage === page ? "#a5b4fc" : "#777790", padding: "6px 10px", minWidth: 36, fontSize: 13, fontFamily: "Poppins, sans-serif", fontWeight: 600 }}>
            {page}
          </button>
        )
      )}
      <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
        style={{ cursor: currentPage === totalPages ? "not-allowed" : "pointer", background: "transparent", border: "1px solid #2a2a38", borderRadius: 8, color: currentPage === totalPages ? "#333" : "#9090a8", padding: "6px 12px", fontSize: 13, fontFamily: "Poppins, sans-serif", fontWeight: 600 }}>
        Next →
      </button>
    </div>
  );
}

export default function ContractTracker() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState("synced");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("end");
  const [currentPage, setCurrentPage] = useState(1);
  const [notifBanner, setNotifBanner] = useState(true);

  const fetchFromSheet = useCallback(async () => {
    setLoading(true);
    setSyncStatus("synced");
    try {
      const res = await fetch(SHEET_URL + "?nocache=" + Date.now());
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const loaded = json.data
          .filter(c => c.id && c.client)
          .map(c => ({ ...c, value: Number(c.value) || 0, monthlyValue: Number(c.monthlyValue) || 0 }));
        setContracts(loaded);
        setLastRefresh(new Date());
      }
    } catch {
      setSyncStatus("error");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFromSheet(); }, [fetchFromSheet]);
  useEffect(() => { setCurrentPage(1); }, [filter, search, sortBy]);

  async function addToSheet(contract) {
    setSyncStatus("saving"); setSaving(true);
    try {
      await fetch(SHEET_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", contract }) });
      setSyncStatus("synced"); setLastRefresh(new Date());
    } catch { setSyncStatus("error"); }
    setSaving(false);
  }

  async function updateInSheet(contract) {
    setSyncStatus("saving"); setSaving(true);
    try {
      await fetch(SHEET_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", contract }) });
      setSyncStatus("synced"); setLastRefresh(new Date());
    } catch { setSyncStatus("error"); }
    setSaving(false);
  }

  const enriched = useMemo(() => contracts.map(c => ({ ...c, status: getStatus(c.end) })), [contracts]);
  const alerts = useMemo(() => enriched.filter(c => c.status.days <= 30 && c.contractStatus !== "terminated"), [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter === "TERMINATED") {
      list = list.filter(c => c.contractStatus === "terminated");
    } else {
      list = list.filter(c => c.contractStatus !== "terminated");
      if (filter !== "ALL") {
        list = list.filter(c => {
          if (filter === "EXPIRED") return c.status.days < 0;
          if (filter === "CRITICAL") return c.status.days >= 0 && c.status.days < 7;
          if (filter === "WARNING") return c.status.days >= 7 && c.status.days < 30;
          if (filter === "ACTIVE") return c.status.days >= 30;
          return true;
        });
      }
    }
    if (search) list = list.filter(c =>
      c.client?.toLowerCase().includes(search.toLowerCase()) ||
      c.type?.toLowerCase().includes(search.toLowerCase()) ||
      c.emirate?.toLowerCase().includes(search.toLowerCase()) ||
      c.location?.toLowerCase().includes(search.toLowerCase())
    );
    return [...list].sort((a, b) => {
      if (sortBy === "end") return new Date(a.end) - new Date(b.end);
      if (sortBy === "client") return a.client?.localeCompare(b.client);
      if (sortBy === "value") return b.value - a.value;
      return 0;
    });
  }, [enriched, filter, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => ({
    total: enriched.filter(c => c.contractStatus !== "terminated").length,
    expired: enriched.filter(c => c.status.days < 0 && c.contractStatus !== "terminated").length,
    critical: enriched.filter(c => c.status.days >= 0 && c.status.days < 7 && c.contractStatus !== "terminated").length,
    warning: enriched.filter(c => c.status.days >= 7 && c.status.days < 30 && c.contractStatus !== "terminated").length,
    totalValue: contracts.filter(c => c.contractStatus !== "terminated").reduce((s, c) => s + Number(c.monthlyValue || 0), 0),
  }), [enriched, contracts]);

  function saveContract() {
    if (!form.client || !form.end) return;
    if (editId !== null) {
      const updatedContract = { ...form, id: editId, value: Number(form.value), monthlyValue: Number(form.monthlyValue), contractStatus: form.contractStatus || "active" };
      setContracts(cs => cs.map(c => c.id === editId ? updatedContract : c));
      updateInSheet(updatedContract);
      setEditId(null);
    } else {
      const newContract = { ...form, id: Date.now(), value: Number(form.value), monthlyValue: Number(form.monthlyValue), contractStatus: "active" };
      setContracts(cs => [...cs, newContract]);
      addToSheet(newContract);
    }
    setForm(emptyForm);
    setShowForm(false);
  }

  function startEdit(c) {
    setForm({ client: c.client, type: c.type || "", start: c.start || "", end: c.end, value: String(c.value), monthlyValue: String(c.monthlyValue || ""), currency: c.currency || "AED", contact: c.contact || "", contractStatus: c.contractStatus || "active", emirate: c.emirate || "", location: c.location || "" });
    setEditId(c.id);
    setShowForm(true);
  }

  const terminatedContracts = useMemo(() => contracts.filter(c => c.contractStatus === "terminated"), [contracts]);
  const filterCounts = {
    ALL: enriched.filter(c => c.contractStatus !== "terminated").length,
    EXPIRED: enriched.filter(c => c.status.days < 0 && c.contractStatus !== "terminated").length,
    CRITICAL: enriched.filter(c => c.status.days >= 0 && c.status.days < 7 && c.contractStatus !== "terminated").length,
    WARNING: enriched.filter(c => c.status.days >= 7 && c.status.days < 30 && c.contractStatus !== "terminated").length,
    ACTIVE: enriched.filter(c => c.status.days >= 30 && c.contractStatus !== "terminated").length,
    TERMINATED: terminatedContracts.length,
  };

  const syncColor = syncStatus === "synced" ? "#4ade80" : syncStatus === "saving" ? "#facc15" : "#ef4444";
  const syncLabel = syncStatus === "synced" ? "✓ Synced" : syncStatus === "saving" ? "⟳ Saving..." : "✕ Sync Error";
  const lastRefreshStr = lastRefresh ? lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", background: "#050400", minHeight: "100vh", color: "#f0e6c0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0a0800; } ::-webkit-scrollbar-thumb { background: #c9a84c; border-radius: 3px; }
        .card { background: #0f0e00; border: 1px solid #3a2e10; border-radius: 14px; transition: border-color 0.2s; }
        .card:hover { border-color: #c9a84c55; }
        .btn { cursor: pointer; border: none; border-radius: 8px; font-family: 'Poppins', sans-serif; font-weight: 700; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
        .btn-primary { background: linear-gradient(135deg, #f5d060, #c9a84c); color: #000; padding: 10px 20px; font-size: 14px; }
        .btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 15px #c9a84c55; }
        .btn-ghost { background: transparent; color: #c9a84c; padding: 8px 14px; font-size: 13px; border: 1px solid #c9a84c55; }
        .btn-ghost:hover { background: #c9a84c15; color: #f5d060; border-color: #c9a84c; }
        input, select, textarea { background: #0f0e00; border: 1px solid #3a2e10; border-radius: 8px; color: #f0e6c0; font-family: 'Poppins', sans-serif; font-size: 14px; padding: 10px 14px; width: 100%; outline: none; transition: border-color 0.2s; }
        input:focus, select:focus, textarea:focus { border-color: #c9a84c; box-shadow: 0 0 0 2px #c9a84c22; }
        input::placeholder { color: #5a4a20; }
        select option { background: #1a1500; color: #f0e6c0; }
        .chip { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; white-space: nowrap; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .slide-in { animation: slideIn 0.25s ease; }
        @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .row-hover:hover { background: #1a1500 !important; }
        .tag { font-size: 10px; background: #1a1500; color: #c9a84c; padding: 2px 6px; border-radius: 4px; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; display: inline-block; border: 1px solid #3a2e1055; }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        label { font-size: 11px; color: #c9a84c; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; display: block; margin-bottom: 6px; }
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0a0800,#1a1400,#0a0800)", borderBottom: "2px solid #c9a84c", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(135deg,#f5d060,#c9a84c,#f5d060)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 2, textTransform: "uppercase" }}>Contract Tracker</div>
            <div style={{ fontSize: 11, color: "#c9a84c", marginTop: 2, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.8 }}>Noor Alafaq · ScentScircle</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" onClick={fetchFromSheet} style={{ fontSize: 12 }}>↻ Refresh</button>
            <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Contract
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: syncColor, fontWeight: 600 }}>{syncLabel}</span>
            {lastRefreshStr && <span style={{ fontSize: 11, color: "#7a6a30" }}>· {lastRefreshStr}</span>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1500, margin: "0 auto", padding: "24px 20px" }}>

        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "#c9a84c" }}>
            <div className="spin" style={{ fontSize: 32, marginBottom: 12 }}>⟳</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Loading contracts from Google Sheets...</div>
          </div>
        )}

        {!loading && <>

          {/* Alert Banner */}
          {notifBanner && alerts.length > 0 && (
            <div className="slide-in" style={{ background: "linear-gradient(135deg,#2d1b1b,#2d2010)", border: "1px solid #7c2d2d", borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="pulse" style={{ fontSize: 20 }}>🔔</span>
                <div>
                  <div style={{ fontWeight: 600, color: "#fca5a5", fontSize: 14 }}>
                    {alerts.filter(c => c.status.days < 0).length > 0
                      ? `${alerts.filter(c => c.status.days < 0).length} contract(s) EXPIRED — take action immediately!`
                      : `${alerts.length} contract(s) expiring within 30 days — take action now!`}
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{alerts.slice(0,5).map(c => c.client).join(" · ")}{alerts.length > 5 ? ` + ${alerts.length - 5} more` : ""}</div>
                </div>
              </div>
              <button onClick={() => setNotifBanner(false)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 24 }}>
            {[
              { label: "Total Contracts", value: stats.total, color: "#a5b4fc" },
              { label: "Expired", value: stats.expired, color: "#f87171" },
              { label: "Due < 7 Days", value: stats.critical, color: "#fb923c" },
              { label: "Due < 30 Days", value: stats.warning, color: "#facc15" },
              { label: "Total Monthly", value: `AED ${stats.totalValue.toLocaleString()}`, color: "#4ade80", small: true },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 11, color: "#c9a84c", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: s.small ? 16 : 28, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="Search client, type, emirate, location..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300, flex: "0 0 auto" }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.keys(filterCounts).map(f => (
                <button key={f} className="btn btn-ghost" onClick={() => setFilter(f)}
                  style={{ borderColor: filter === f ? "#c9a84c" : "#3a2e10", color: filter === f ? "#000" : "#c9a84c", background: filter === f ? "linear-gradient(135deg,#f5d060,#c9a84c)" : "transparent", fontSize: 12, padding: "6px 12px" }}>
                  {f} <span style={{ background: "#3a2e10", borderRadius: 10, padding: "1px 7px", marginLeft: 4, fontSize: 11, color: "#c9a84c" }}>{filterCounts[f]}</span>
                </button>
              ))}
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ maxWidth: 160, flex: "0 0 auto" }}>
              <option value="end">Sort: Expiry Date</option>
              <option value="client">Sort: Client Name</option>
              <option value="value">Sort: Value</option>
            </select>
          </div>

          {/* Table */}
          <div className="card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #3a2e10", background: "#0a0800" }}>
                  {["#", "Client", "Type", "Emirate", "Location", "Expiry", "Status", "Contract Value", "Monthly Value", "Contact", "Action"].map(h => (
                    <th key={h} style={{ padding: "10px 10px", textAlign: "left", color: "#555570", fontWeight: 600, fontSize: 10, letterSpacing: "0.5px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#444" }}>No contracts found.</td></tr>
                )}
                {paginated.map((c, i) => (
                  <tr key={c.id} className="row-hover" style={{ borderBottom: "1px solid #2a2000", background: i % 2 === 0 ? "#0f0e00" : "#0a0900" }}>
                    <td style={{ padding: "10px 10px", color: "#7a6a30", fontSize: 11 }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td style={{ padding: "10px 10px", fontWeight: 600, color: "#f5e6b0", fontSize: 12, whiteSpace: "normal", wordBreak: "break-word", maxWidth: 220 }}>{c.client}</td>
                    <td style={{ padding: "10px 10px" }}><span className="tag">{c.type || "—"}</span></td>
                    <td style={{ padding: "10px 10px", color: "#a78bfa", fontSize: 12 }}>{c.emirate || "—"}</td>
                    <td style={{ padding: "10px 10px", color: "#7a6a30", fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.location || "—"}</td>
                    <td style={{ padding: "10px 10px", color: "#d4b96a", fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(c.end)}</td>
                    <td style={{ padding: "10px 10px" }}>
                      <span className="chip" style={{ background: c.status.bg, color: c.status.color, border: `1px solid ${c.status.color}40` }}>
                        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: c.status.dot, marginRight: 5, verticalAlign: "middle" }}></span>
                        {c.status.days < 0 ? `${Math.abs(c.status.days)}d overdue` : `${c.status.days}d left`}
                      </span>
                    </td>
                    <td style={{ padding: "10px 10px", color: "#f5d060", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{c.currency} {Number(c.value).toLocaleString()}</td>
                    <td style={{ padding: "10px 10px", color: "#c9a84c", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>{c.monthlyValue ? `${c.currency} ${Number(c.monthlyValue).toLocaleString()}` : "—"}</td>
                    <td style={{ padding: "10px 10px", color: "#a08840", fontSize: 12 }}>{c.contact || "—"}</td>
                    <td style={{ padding: "10px 10px" }}>
                      <button className="btn btn-ghost" onClick={() => startEdit(c)} style={{ padding: "4px 10px", fontSize: 11 }}>Edit</button>
                      {c.contractStatus === "terminated" && <span style={{ fontSize: 10, background: "#2d1515", color: "#f87171", border: "1px solid #f8717140", borderRadius: 4, padding: "2px 6px", fontWeight: 600, marginLeft: 4 }}>Terminated</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 13, color: "#c9a84c", fontWeight: 500 }}>
              Showing {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} contracts
            </div>
            <PaginationBar currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>

          {/* Action Required */}
          {alerts.length > 0 && (
            <div className="card slide-in" style={{ marginTop: 24, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "#f5d060", textTransform: "uppercase", letterSpacing: "1px" }}>⚠ Action Required</div>
              {alerts.sort((a, b) => a.status.days - b.status.days).map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid #1e1e2a" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.status.dot, flexShrink: 0 }}></div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, color: "#e0e0f0" }}>{c.client}</span>
                    {c.emirate && <span style={{ color: "#a78bfa", marginLeft: 8, fontSize: 11 }}>{c.emirate}</span>}
                    <span style={{ color: "#7a6a30", marginLeft: 8, fontSize: 12 }}>{c.type}</span>
                  </div>
                  <div style={{ fontSize: 12, color: c.status.color, fontWeight: 600 }}>
                    {c.status.days < 0 ? `${Math.abs(c.status.days)} days OVERDUE` : `Renew within ${c.status.days} days`}
                  </div>
                  {c.contact && (
                    <a href={`https://wa.me/${c.contact.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                      style={{ background: "#1a3a2a", color: "#4ade80", border: "1px solid #4ade8030", borderRadius: 6, padding: "5px 12px", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
                      WhatsApp
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" }}>
          <div className="card slide-in" onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, margin: 20, padding: 28, maxHeight: "92vh", overflowY: "auto", background: "#0a0800", border: "1px solid #c9a84c" }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20, color: "#f5d060" }}>
              {editId ? "✎ Edit Contract" : "+ New Contract"}
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label>Client Name *</label>
                <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="e.g. Emaar Properties" />
              </div>
              <div>
                <label>Contract Type</label>
                <input value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} placeholder="e.g. Annual Maintenance" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label>Emirate</label>
                  <select value={form.emirate} onChange={e => setForm(f => ({ ...f, emirate: e.target.value }))}>
                    <option value="">Select Emirate</option>
                    {EMIRATES.map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                </div>
                <div>
                  <label>Location / Area</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Dubai Marina" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label>Start Date</label>
                  <input type="date" value={form.start} onChange={e => {
                    const start = e.target.value;
                    const d = new Date(start);
                    d.setDate(d.getDate() + 364);
                    const autoEnd = start ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` : "";
                    setForm(f => ({ ...f, start, end: autoEnd }));
                  }} />
                </div>
                <div>
                  <label>Expiry Date *</label>
                  <input type="date" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 14 }}>
                <div>
                  <label>Contract Value</label>
                  <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label>Monthly Value</label>
                  <input type="number" value={form.monthlyValue} onChange={e => setForm(f => ({ ...f, monthlyValue: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    <option>AED</option><option>USD</option><option>EUR</option><option>SAR</option>
                  </select>
                </div>
              </div>
              <div>
                <label>Client WhatsApp</label>
                <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="+971 50 000 0000" />
              </div>
              <div>
                <label>Contract Status</label>
                <select value={form.contractStatus || "active"} onChange={e => setForm(f => ({ ...f, contractStatus: e.target.value }))}
                  style={{ borderColor: form.contractStatus === "terminated" ? "#ef4444" : "#2a2a38" }}>
                  <option value="active">✅ Active</option>
                  <option value="terminated">🔴 Service Terminated</option>
                </select>
                {form.contractStatus === "terminated" && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#f87171", background: "#2d1515", border: "1px solid #f8717130", borderRadius: 6, padding: "8px 12px" }}>
                    ⚠ This client will be moved to the Terminated list and removed from active contracts.
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveContract} disabled={saving}>
                {saving ? "Saving..." : editId ? "Save Changes" : "Add Contract"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
