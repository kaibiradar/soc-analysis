import { useCallback, useEffect, useMemo, useState } from "react";

const API = "/api/logs/search";

function mark(text = "", query = "") {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function LogExplorer() {
  const [filters, setFilters] = useState({ q: "", event_type: "", username: "", hostname: "", ip: "", mitre: "", process_name: "", command_line: "" });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("timestamp");
  const [direction, setDirection] = useState("desc");
  const [data, setData] = useState({ events: [], total: 0, pages: 0 });
  const [saved, setSaved] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page, per_page: 25, sort, direction });
    Object.entries(filters).forEach(([key, value]) => value && p.set(key, value));
    return p;
  }, [filters, page, sort, direction]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`${API}?${params}`)
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then(setData)
      .catch(() => setError("Unable to search logs"))
      .finally(() => setLoading(false));
  }, [params]);

  const loadMeta = useCallback(() => {
    fetch("/api/logs/saved-searches").then((r) => r.json()).then((d) => setSaved(d.saved_searches || []));
    fetch("/api/logs/history").then((r) => r.json()).then((d) => setHistory(d.history || []));
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      load();
      loadMeta();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [load, loadMeta]);

  const saveSearch = () => {
    const name = window.prompt("Saved search name");
    if (!name) return;
    fetch("/api/logs/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, filters }),
    }).then(loadMeta);
  };

  const exportUrl = (fmt) => `${API}?${params}&export=${fmt}`;

  return (
    <main className="container enterprise-page">
      <div className="section-label">advanced log search</div>
      <section className="panel">
        <div className="panel-header">
          <div className="panel-title">Log Explorer</div>
          <div className="action-row">
            <a className="ghost-btn" href={exportUrl("csv")}>CSV</a>
            <a className="ghost-btn" href={exportUrl("json")}>JSON</a>
            <button className="ghost-btn" onClick={saveSearch}>Save</button>
          </div>
        </div>
        <div className="filter-grid">
          {Object.keys(filters).map((key) => (
            <input key={key} placeholder={key.replace("_", " ")} value={filters[key]} onChange={(e) => { setPage(1); setFilters({ ...filters, [key]: e.target.value }); }} />
          ))}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="timestamp">Timestamp</option>
            <option value="event_id">Event ID</option>
            <option value="event_type">Event Type</option>
          </select>
          <select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-title">{loading ? "Searching..." : `${data.total} matching events`}</div>
          {error && <span className="error-text">{error}</span>}
        </div>
        <div className="enterprise-table">
          <div className="enterprise-thead"><span>Time</span><span>Type</span><span>Host</span><span>User</span><span>Description</span></div>
          {data.events.length === 0 ? <div className="empty-state">No matching logs</div> : data.events.map((event) => (
            <div className="enterprise-row" key={event.id}>
              <span>{event.timestamp ? new Date(event.timestamp).toLocaleString() : "--"}</span>
              <span>{mark(event.event_type, filters.q)}</span>
              <span>{mark(event.computer_name, filters.q)}</span>
              <span>{mark(event.user || "", filters.q)}</span>
              <span>{mark(event.description, filters.q)}</span>
            </div>
          ))}
        </div>
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {page} / {data.pages || 1}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </section>

      <div className="enterprise-grid two">
        <section className="panel"><div className="panel-title">Saved Searches</div>{saved.map((s) => <button className="list-btn" key={s.id} onClick={() => setFilters({ ...filters, ...s.filters })}>{s.name}</button>)}</section>
        <section className="panel"><div className="panel-title">Search History</div>{history.map((h) => <div className="mini-row" key={h.id}>{h.query || "filtered search"} · {h.result_count}</div>)}</section>
      </div>
    </main>
  );
}

export default LogExplorer;
