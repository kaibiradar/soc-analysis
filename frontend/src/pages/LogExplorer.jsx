/**
 * LogExplorer — enterprise event search and investigation.
 * Clicking a row opens EventInvestigationDrawer for full incident analysis.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getEvents } from "../api/api";
import EventInvestigationDrawer from "../components/EventInvestigationDrawer";

/* ── Constants ── */
const PER_PAGE    = 25;
const LS_SAVED    = "soc_saved_searches";
const LS_HISTORY  = "soc_search_history";
const MAX_HISTORY = 20;

const EVENT_TYPES = [
  "ProcessCreate", "NetworkConnect", "FileCreate", "RegistryEvent",
  "CreateRemoteThread", "ProcessAccess", "DriverLoaded", "ImageLoaded",
  "ProcessTerminated", "RawAccessRead",
];

const EVENT_TYPE_COLORS = {
  ProcessCreate: "#00d2ff", NetworkConnect: "#a78bfa", RegistryEvent: "#fbbf24",
  FileCreate: "#22d3a0", CreateRemoteThread: "#f43f5e", ProcessAccess: "#fb923c",
  DriverLoaded: "#e879f9", ImageLoaded: "#818cf8", ProcessTerminated: "#64748b",
  RawAccessRead: "#f97316",
};
const etColor = (t) => EVENT_TYPE_COLORS[t] ?? "#7a9bbf";

/* ── Helpers ── */
function highlight(text = "", query = "") {
  if (!query || !text) return text;
  const idx = String(text).toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {String(text).slice(0, idx)}
      <mark className="le-mark">{String(text).slice(idx, idx + query.length)}</mark>
      {String(text).slice(idx + query.length)}
    </>
  );
}

function fmtTs(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "2-digit", day: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota exceeded */ }
}

/* ── Icons ── */
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: 12, height: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const SortIcon = ({ active, dir }) => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke={active ? "#00d2ff" : "currentColor"} strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: 11, height: 11, marginLeft: 4, opacity: active ? 1 : 0.3 }}>
    {dir === "asc"
      ? <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>
      : <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>}
  </svg>
);

/* ── Collapsible ── */
function Collapsible({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="le-collapsible">
      <button className="le-collapsible-header" onClick={() => setOpen((o) => !o)}>
        <span className="le-collapsible-title">{title}</span>
        {count != null && <span className="panel-badge">{count}</span>}
        <ChevronIcon open={open} />
      </button>
      {open && <div className="le-collapsible-body">{children}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
function LogExplorer() {
  const EMPTY_FILTERS = { q: "", event_type: "", hostname: "", username: "" };

  const [filters,       setFilters]       = useState(EMPTY_FILTERS);
  const [page,          setPage]          = useState(1);
  const [sort,          setSort]          = useState("timestamp");
  const [direction,     setDirection]     = useState("desc");
  const [data,          setData]          = useState({ events: [], total: 0, pages: 0 });
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [saved,         setSaved]         = useState(() => loadLS(LS_SAVED,   []));
  const [history,       setHistory]       = useState(() => loadLS(LS_HISTORY, []));

  const abortRef = useRef(null);

  /* ── Load events ── */
  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError("");
    try {
      const d = await getEvents({
        page, perPage: PER_PAGE, sort, direction,
        q:          filters.q,
        event_type: filters.event_type,
        hostname:   filters.hostname,
        username:   filters.username,
      });
      if (!ctrl.signal.aborted) setData(d);
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e.message ?? "Search failed");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [filters, page, sort, direction]);

  useEffect(() => { load(); }, [load]);

  /* ── Record history ── */
  useEffect(() => {
    if (!data.total) return;
    const entry = {
      id: Date.now(),
      query: filters.q || "(filtered)",
      filters: { ...filters },
      sort, direction,
      results: data.total,
      ts: new Date().toISOString(),
    };
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => h.query !== entry.query)].slice(0, MAX_HISTORY);
      saveLS(LS_HISTORY, next);
      return next;
    });
  }, [data.total]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Sort toggle ── */
  const handleSort = (col) => {
    if (sort === col) {
      setDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(col);
      setDirection("desc");
    }
    setPage(1);
  };

  /* ── Filter helpers ── */
  const setFilter = (key, val) => { setFilters((f) => ({ ...f, [key]: val })); setPage(1); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); };
  const hasFilters = Object.values(filters).some(Boolean);

  /* ── Saved searches ── */
  const saveSearch = () => {
    const name = window.prompt("Name this search:");
    if (!name?.trim()) return;
    const entry = { id: Date.now(), name: name.trim(), filters: { ...filters }, sort, direction };
    setSaved((prev) => {
      const next = [entry, ...prev.filter((s) => s.name !== name.trim())].slice(0, 20);
      saveLS(LS_SAVED, next);
      return next;
    });
  };
  const loadSaved = (s) => {
    setFilters({ ...EMPTY_FILTERS, ...s.filters });
    setSort(s.sort || "timestamp");
    setDirection(s.direction || "desc");
    setPage(1);
  };
  const deleteSaved = (id, e) => {
    e.stopPropagation();
    setSaved((prev) => { const n = prev.filter((s) => s.id !== id); saveLS(LS_SAVED, n); return n; });
  };
  const loadHistory = (h) => {
    setFilters({ ...EMPTY_FILTERS, ...h.filters });
    setSort(h.sort || "timestamp");
    setDirection(h.direction || "desc");
    setPage(1);
  };
  const clearHistory = () => { setHistory([]); saveLS(LS_HISTORY, []); };

  /* ── Export ── */
  const exportData = (fmt) => {
    if (fmt === "csv") {
      const cols = ["id", "timestamp", "event_type", "computer_name", "user", "description"];
      const rows = [
        cols.join(","),
        ...data.events.map((e) =>
          cols.map((c) => `"${(e[c] ?? "").toString().replace(/"/g, '""')}"`).join(",")
        ),
      ];
      const blob = new Blob([rows.join("\n")], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `soc-events-${Date.now()}.csv`;
      a.click();
    } else {
      const blob = new Blob([JSON.stringify(data.events, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `soc-events-${Date.now()}.json`;
      a.click();
    }
  };

  /* ── Sortable column header ── */
  const SortTh = ({ col, label }) => (
    <th
      className={`le-th le-sortable${sort === col ? " le-th-active" : ""}`}
      onClick={() => handleSort(col)}
    >
      {label}
      <SortIcon active={sort === col} dir={direction} />
    </th>
  );

  /* ══════ RENDER ══════ */
  return (
    <>
      <div className="le-root">

        {/* ── Toolbar ── */}
        <div className="le-toolbar">
          <div className="le-toolbar-top">
            <div className="le-search-wrap">
              <span className="le-search-icon"><SearchIcon /></span>
              <input
                className="le-search"
                placeholder="Search events — host, user, description…"
                value={filters.q}
                onChange={(e) => setFilter("q", e.target.value)}
                spellCheck={false}
              />
              {filters.q && (
                <button className="le-search-clear" onClick={() => setFilter("q", "")}>✕</button>
              )}
            </div>
            <div className="le-toolbar-actions">
              <button className="le-btn le-btn-ghost" onClick={() => exportData("csv")}>
                <DownloadIcon /> CSV
              </button>
              <button className="le-btn le-btn-ghost" onClick={() => exportData("json")}>
                <DownloadIcon /> JSON
              </button>
              <button className="le-btn le-btn-accent" onClick={saveSearch}>
                <StarIcon /> Save
              </button>
            </div>
          </div>

          <div className="le-filters">
            <div className="le-filter-group">
              <label className="le-filter-label">Event Type</label>
              <select className="filter-select le-filter-select"
                value={filters.event_type}
                onChange={(e) => setFilter("event_type", e.target.value)}>
                <option value="">All Types</option>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="le-filter-group">
              <label className="le-filter-label">Hostname</label>
              <input className="filter-input le-filter-input"
                placeholder="Filter by host…"
                value={filters.hostname}
                onChange={(e) => setFilter("hostname", e.target.value)} />
            </div>
            <div className="le-filter-group">
              <label className="le-filter-label">User</label>
              <input className="filter-input le-filter-input"
                placeholder="Filter by user…"
                value={filters.username}
                onChange={(e) => setFilter("username", e.target.value)} />
            </div>
            <div className="le-filter-group">
              <label className="le-filter-label">Sort</label>
              <select className="filter-select le-filter-select"
                value={`${sort}:${direction}`}
                onChange={(e) => {
                  const [col, dir] = e.target.value.split(":");
                  setSort(col); setDirection(dir); setPage(1);
                }}>
                <option value="timestamp:desc">Time ↓ (newest)</option>
                <option value="timestamp:asc">Time ↑ (oldest)</option>
                <option value="event_type:asc">Type A–Z</option>
                <option value="computer_name:asc">Host A–Z</option>
                <option value="user:asc">User A–Z</option>
              </select>
            </div>
            {hasFilters && (
              <button className="filter-clear le-clear-all" onClick={clearFilters}>
                ✕ Clear all
              </button>
            )}
          </div>
        </div>

        {/* ── Results panel ── */}
        <div className="le-results-panel panel">
          <div className="le-results-header">
            <div className="panel-title" style={{ gap: 10 }}>
              {loading
                ? <><span className="le-spinner" />Searching…</>
                : <><span className="le-result-count">{data.total.toLocaleString()}</span> events</>}
            </div>
            {error && <span className="le-error">⚠ {error}</span>}
            <span className="panel-badge" style={{ marginLeft: "auto" }}>
              Page {page} / {data.pages || 1}
            </span>
          </div>

          <div className="le-table-wrap">
            <table className="le-table">
              <thead className="le-thead">
                <tr>
                  <SortTh col="timestamp"     label="Time" />
                  <th className="le-th le-col-eid">Event ID</th>
                  <SortTh col="event_type"    label="Type" />
                  <SortTh col="computer_name" label="Host" />
                  <SortTh col="user"          label="User" />
                  <th className="le-th le-col-desc">Description</th>
                  <th className="le-th le-col-expand" />
                </tr>
              </thead>
              <tbody>
                {!loading && data.events.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="le-empty-cell">
                      <div className="le-empty">
                        <div className="le-empty-icon"><SearchIcon /></div>
                        <div className="le-empty-title">No events found</div>
                        <div className="le-empty-sub">
                          {hasFilters
                            ? "Try clearing filters or broadening your search."
                            : "No events ingested yet. Start the collector to begin."}
                        </div>
                        {hasFilters && (
                          <button className="le-btn le-btn-ghost"
                            style={{ marginTop: 12 }} onClick={clearFilters}>
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.events.map((ev) => {
                    const isSelected = selectedEvent?.id === ev.id;
                    const user = ev.user
                      ? (ev.user.includes("\\") ? ev.user.split("\\").pop() : ev.user)
                      : "—";
                    return (
                      <tr
                        key={ev.id}
                        className={`le-row${isSelected ? " le-row-selected" : ""}`}
                        onClick={() => setSelectedEvent(isSelected ? null : ev)}
                        title="Click to investigate"
                      >
                        <td className="le-td le-col-time">
                          <span className="le-ts">{fmtTs(ev.timestamp)}</span>
                        </td>
                        <td className="le-td le-col-eid">
                          <span className="le-eid">{ev.event_id ?? "—"}</span>
                        </td>
                        <td className="le-td le-col-type">
                          <span className="le-type-badge"
                            style={{
                              color: etColor(ev.event_type),
                              borderColor: `${etColor(ev.event_type)}40`,
                            }}>
                            {highlight(ev.event_type, filters.q || filters.event_type)}
                          </span>
                        </td>
                        <td className="le-td le-col-host">
                          <span className="le-mono">
                            {highlight(ev.computer_name, filters.q || filters.hostname)}
                          </span>
                        </td>
                        <td className="le-td le-col-user">
                          <span className="le-mono">
                            {highlight(user, filters.q || filters.username)}
                          </span>
                        </td>
                        <td className="le-td le-col-desc">
                          <span className="le-desc">
                            {highlight((ev.description ?? "").slice(0, 120), filters.q)}
                          </span>
                        </td>
                        <td className="le-td le-col-expand">
                          <span className="le-investigate-hint">Investigate →</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="pagination le-pagination">
              <button className="page-btn" disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}>← Prev</button>
              <div className="le-page-nums">
                {Array.from({ length: Math.min(data.pages, 7) }, (_, i) => {
                  const p = data.pages <= 7 ? i + 1
                    : page <= 4 ? i + 1
                    : page >= data.pages - 3 ? data.pages - 6 + i
                    : page - 3 + i;
                  return (
                    <button key={p}
                      className={`page-btn le-page-num${page === p ? " le-page-active" : ""}`}
                      onClick={() => setPage(p)}>{p}</button>
                  );
                })}
              </div>
              <button className="page-btn" disabled={page === data.pages}
                onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </div>

        {/* ── Bottom: Saved + History ── */}
        <div className="le-bottom-row">
          <div className="panel le-side-panel">
            <Collapsible title="Saved Searches" count={saved.length}>
              {saved.length === 0 ? (
                <div className="le-side-empty">No saved searches yet. Run a search and click Save.</div>
              ) : (
                <ul className="le-side-list">
                  {saved.map((s) => (
                    <li key={s.id} className="le-side-item" onClick={() => loadSaved(s)}>
                      <span className="le-side-name">{s.name}</span>
                      <button className="le-side-delete"
                        onClick={(e) => deleteSaved(s.id, e)} title="Remove">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </Collapsible>
          </div>

          <div className="panel le-side-panel">
            <Collapsible title="Recent Searches" count={history.length}>
              {history.length === 0 ? (
                <div className="le-side-empty">No history yet.</div>
              ) : (
                <>
                  <ul className="le-side-list">
                    {history.map((h) => (
                      <li key={h.id} className="le-side-item" onClick={() => loadHistory(h)}>
                        <span className="le-side-name le-history-query">{h.query}</span>
                        <span className="le-history-meta">{h.results.toLocaleString()} results</span>
                      </li>
                    ))}
                  </ul>
                  <button className="filter-clear le-clear-history" onClick={clearHistory}>
                    Clear history
                  </button>
                </>
              )}
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Investigation drawer — rendered outside the scroll root so it overlays correctly */}
      <EventInvestigationDrawer
        eventSummary={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}

export default LogExplorer;
