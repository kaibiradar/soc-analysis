import { useEffect, useState, useCallback } from "react";
import { getAlerts, updateAlert } from "../api/api";

/* ── Icons ── */
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

const SEV_COLORS = { LOW: "#22d3a0", MEDIUM: "#fbbf24", HIGH: "#fb923c", CRITICAL: "#f43f5e" };
const SEVERITIES = ["", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES   = ["", "NEW", "OPEN", "ACKNOWLEDGED", "RESOLVED", "FALSE_POSITIVE"];

function AlertTable({ onNewAlert }) {
  const [alerts, setAlerts]       = useState([]);
  const [total, setTotal]         = useState(0);
  const [totalPages, setPages]    = useState(1);
  const [page, setPage]           = useState(1);
  const [severity, setSeverity]   = useState("");
  const [status, setStatus]       = useState("");
  const [search, setSearch]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [updating, setUpdating]   = useState(null); // alert id being updated

  const PER_PAGE = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAlerts({ page, perPage: PER_PAGE, status, severity, search });
      setAlerts(data.alerts || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, status, severity, search]);

  // Reload when filters or page change
  useEffect(() => { load(); }, [load]);

  // Parent (Dashboard) can trigger a reload when SSE fires a new_alert
  useEffect(() => {
    if (onNewAlert) {
      load();
    }
  }, [onNewAlert]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatus = async (alertId, newStatus) => {
    setUpdating(alertId);
    try {
      await updateAlert(alertId, { status: newStatus });
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const resetFilters = () => {
    setSeverity(""); setStatus(""); setSearch(""); setPage(1);
  };

  return (
    <div className="panel">
      {/* ── Header ── */}
      <div className="panel-header">
        <div className="panel-title"><ListIcon />Recent Alerts</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="panel-badge">{total} total</span>
          <button className="icon-btn" onClick={load} title="Refresh" disabled={loading}>
            <RefreshIcon />
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="Search alerts…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
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
        {(severity || status || search) && (
          <button className="filter-clear" onClick={resetFilters}>✕ Clear</button>
        )}
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="alert-error">
          <span>⚠ {error}</span>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {/* ── Table ── */}
      <table className="alert-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Timestamp</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {loading && alerts.length === 0 ? (
            <tr><td colSpan="5"><div className="empty-state">// loading…</div></td></tr>
          ) : alerts.length === 0 ? (
            <tr><td colSpan="5"><div className="empty-state">// no alerts match your filters</div></td></tr>
          ) : (
            alerts.map((alert) => (
              <tr key={alert.id} className={alert.status === "NEW" ? "row-new" : ""}>
                <td>
                  <div className="alert-title">
                    <span className="alert-dot"
                      style={{ background: SEV_COLORS[alert.severity] ?? "#7a9bbf" }} />
                    {alert.title}
                  </div>
                </td>
                <td><span className={`sev-badge sev-${alert.severity}`}>{alert.severity}</span></td>
                <td><span className={`status-pill status-${alert.status}`}>{alert.status}</span></td>
                <td><span className="time-mono">{new Date(alert.created_at).toLocaleString()}</span></td>
                <td>
                  <div className="action-btns">
                    {alert.status === "NEW" && (
                      <button
                        className="act-btn act-ack"
                        disabled={updating === alert.id}
                        onClick={() => handleStatus(alert.id, "ACKNOWLEDGED")}
                      >ACK</button>
                    )}
                    {["NEW", "OPEN", "ACKNOWLEDGED"].includes(alert.status) && (
                      <button
                        className="act-btn act-resolve"
                        disabled={updating === alert.id}
                        onClick={() => handleStatus(alert.id, "RESOLVED")}
                      >RESOLVE</button>
                    )}
                    {alert.status !== "FALSE_POSITIVE" && alert.status !== "RESOLVED" && (
                      <button
                        className="act-btn act-fp"
                        disabled={updating === alert.id}
                        onClick={() => handleStatus(alert.id, "FALSE_POSITIVE")}
                      >FP</button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="page-info">
            <span className="page-current">{page}</span>
            <span className="page-sep"> / </span>
            <span>{totalPages}</span>
          </span>
          <button className="page-btn" disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

export default AlertTable;
