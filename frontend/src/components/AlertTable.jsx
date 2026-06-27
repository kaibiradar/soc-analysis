/**
 * AlertTable — receives live alerts via WebSocket push (newAlerts prop)
 * and also supports REST polling, filters, pagination, and ACK/Resolve/FP actions.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { getAlerts, updateAlert } from "../api/api";

const ListIcon = () => (
  <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const SEV_COLORS  = { LOW: "#22d3a0", MEDIUM: "#fbbf24", HIGH: "#fb923c", CRITICAL: "#f43f5e" };
const SEVERITIES  = ["", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES    = ["", "NEW", "OPEN", "ACKNOWLEDGED", "RESOLVED", "FALSE_POSITIVE"];
const PER_PAGE    = 10;

function AlertTable({ newAlerts = [], updatedAlert = null }) {
  const [alerts,    setAlerts]   = useState([]);
  const [total,     setTotal]    = useState(0);
  const [pages,     setPages]    = useState(1);
  const [page,      setPage]     = useState(1);
  const [severity,  setSeverity] = useState("");
  const [status,    setStatus]   = useState("");
  const [search,    setSearch]   = useState("");
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState(null);
  const [updating,  setUpdating] = useState(null);
  const [flashIds,  setFlashIds] = useState(new Set());
  const tickRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await getAlerts({ page, perPage: PER_PAGE, status, severity, search });
      setAlerts(d.alerts || []);
      setTotal(d.total  || 0);
      setPages(d.pages  || 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, status, severity, search]);

  useEffect(() => { load(); }, [load]);

  // ── React to WS new_alert pushes ─────────────────────────
  useEffect(() => {
    if (!newAlerts.length) return;
    const latest = newAlerts[0];
    // Prepend if on page 1 and no active filters
    if (page === 1 && !severity && !status && !search) {
      setAlerts((prev) => {
        const exists = prev.find((a) => a.id === latest.id);
        if (exists) return prev;
        const next = [latest, ...prev].slice(0, PER_PAGE);
        return next;
      });
      setTotal((t) => t + 1);
      setFlashIds((s) => new Set(s).add(latest.id));
      setTimeout(() => setFlashIds((s) => { const n = new Set(s); n.delete(latest.id); return n; }), 1500);
    } else {
      load(); // re-fetch if filters are active
    }
  }, [newAlerts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── React to WS alert_updated pushes ─────────────────────
  useEffect(() => {
    if (!updatedAlert) return;
    setAlerts((prev) =>
      prev.map((a) => a.id === updatedAlert.id ? { ...a, ...updatedAlert } : a)
    );
  }, [updatedAlert]);

  const handleStatus = async (alertId, newStatus) => {
    setUpdating(alertId);
    try {
      await updateAlert(alertId, { status: newStatus });
      // Optimistic update — WS broadcast will confirm
      setAlerts((prev) =>
        prev.map((a) => a.id === alertId ? { ...a, status: newStatus } : a)
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdating(null);
    }
  };

  const resetFilters = () => { setSeverity(""); setStatus(""); setSearch(""); setPage(1); };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><ListIcon />Recent Alerts</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="panel-badge">{total} total</span>
          <button className="icon-btn" onClick={load} disabled={loading} title="Refresh">
            <RefreshIcon />
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <input className="filter-input" placeholder="Search alerts…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="filter-select" value={severity}
          onChange={(e) => { setSeverity(e.target.value); setPage(1); }}>
          <option value="">All Severities</option>
          {SEVERITIES.filter(Boolean).map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s}>{s}</option>)}
        </select>
        {(severity || status || search) &&
          <button className="filter-clear" onClick={resetFilters}>✕ Clear</button>}
      </div>

      {error && (
        <div className="alert-error">
          <span>⚠ {error}</span>
          <button onClick={load}>Retry</button>
        </div>
      )}

      <table className="alert-table">
        <thead>
          <tr>
            <th>Title</th><th>Severity</th><th>Status</th>
            <th>Timestamp</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {loading && !alerts.length ? (
            <tr><td colSpan="5"><div className="empty-state">// loading…</div></td></tr>
          ) : !alerts.length ? (
            <tr><td colSpan="5"><div className="empty-state">// no alerts match filters</div></td></tr>
          ) : alerts.map((a) => (
            <tr key={a.id}
              className={[
                a.status === "NEW" ? "row-new" : "",
                flashIds.has(a.id) ? "row-flash" : "",
              ].join(" ").trim()}
            >
              <td>
                <div className="alert-title">
                  <span className="alert-dot"
                    style={{ background: SEV_COLORS[a.severity] ?? "#7a9bbf" }} />
                  {a.title}
                </div>
              </td>
              <td><span className={`sev-badge sev-${a.severity}`}>{a.severity}</span></td>
              <td><span className={`status-pill status-${a.status}`}>{a.status}</span></td>
              <td><span className="time-mono">{new Date(a.created_at).toLocaleString()}</span></td>
              <td>
                <div className="action-btns">
                  {a.status === "NEW" &&
                    <button className="act-btn act-ack" disabled={updating === a.id}
                      onClick={() => handleStatus(a.id, "ACKNOWLEDGED")}>ACK</button>}
                  {["NEW","OPEN","ACKNOWLEDGED"].includes(a.status) &&
                    <button className="act-btn act-resolve" disabled={updating === a.id}
                      onClick={() => handleStatus(a.id, "RESOLVED")}>RESOLVE</button>}
                  {!["FALSE_POSITIVE","RESOLVED"].includes(a.status) &&
                    <button className="act-btn act-fp" disabled={updating === a.id}
                      onClick={() => handleStatus(a.id, "FALSE_POSITIVE")}>FP</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="page-info">
            <span className="page-current">{page}</span>
            <span className="page-sep"> / </span>
            <span>{pages}</span>
          </span>
          <button className="page-btn" disabled={page === pages}
            onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

export default AlertTable;
