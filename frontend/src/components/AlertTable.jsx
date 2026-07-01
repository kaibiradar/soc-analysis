/**
 * AlertTable — full-width enterprise alert list.
 * Columns: Severity · Title · Computer · User · Status · Time · Actions
 * Receives live pushes via newAlerts / updatedAlert props (WebSocket).
 */
import { useEffect, useState, useCallback } from "react";
import { getAlerts, updateAlert } from "../api/api";

/* ── Icons ── */
const ListIcon = () => (
  <svg className="panel-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6"  x2="21" y2="6"  />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6"  x2="3.01" y2="6"  />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ width: 14, height: 14 }}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const SEV_COLORS = { LOW: "#22d3a0", MEDIUM: "#fbbf24", HIGH: "#fb923c", CRITICAL: "#f43f5e" };
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES   = ["", "NEW", "OPEN", "ACKNOWLEDGED", "RESOLVED", "FALSE_POSITIVE"];
const PER_PAGE   = 15;

function AlertTable({ newAlerts = [], updatedAlert = null, onSelectAlert = null }) {
  const [alerts,         setAlerts]         = useState([]);
  const [total,          setTotal]          = useState(0);
  const [severityCounts, setSeverityCounts] = useState({ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });
  const [pages,          setPages]          = useState(1);
  const [page,           setPage]           = useState(1);
  const [severity,       setSeverity]       = useState("");
  const [status,         setStatus]         = useState("");
  const [search,         setSearch]         = useState("");
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [updating,       setUpdating]       = useState(null);
  const [flashIds,       setFlashIds]       = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getAlerts({ page, perPage: PER_PAGE, status, severity, search });
      setAlerts(d.alerts || []);
      setTotal(d.total   || 0);
      setPages(d.pages   || 1);
      setSeverityCounts({
        LOW:      d.severity_counts?.LOW      || 0,
        MEDIUM:   d.severity_counts?.MEDIUM   || 0,
        HIGH:     d.severity_counts?.HIGH     || 0,
        CRITICAL: d.severity_counts?.CRITICAL || 0,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, status, severity, search]);

  useEffect(() => { load(); }, [load]);

  /* Live new alert push */
  useEffect(() => {
    if (!newAlerts.length) return;
    const latest = newAlerts[0];
    if (page === 1 && !severity && !status && !search) {
      setAlerts((prev) => {
        if (prev.find((a) => a.id === latest.id)) return prev;
        return [latest, ...prev].slice(0, PER_PAGE);
      });
      setTotal((t) => t + 1);
      setSeverityCounts((c) => ({ ...c, [latest.severity]: (c[latest.severity] || 0) + 1 }));
      const id = latest.id;
      setFlashIds((s) => new Set(s).add(id));
      setTimeout(() => setFlashIds((s) => { const n = new Set(s); n.delete(id); return n; }), 1500);
    } else {
      load();
    }
  }, [newAlerts]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Live status update push */
  useEffect(() => {
    if (!updatedAlert) return;
    setAlerts((prev) => prev.map((a) => a.id === updatedAlert.id ? { ...a, ...updatedAlert } : a));
  }, [updatedAlert]);

  const handleStatus = async (alertId, newStatus, e) => {
    e?.stopPropagation();
    setUpdating(alertId);
    try {
      await updateAlert(alertId, { status: newStatus });
      setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, status: newStatus } : a));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const resetFilters = () => { setSeverity(""); setStatus(""); setSearch(""); setPage(1); };
  const totalSevCount = Object.values(severityCounts).reduce((s, c) => s + c, 0);

  return (
    <div className="panel at-panel">
      {/* ── Header ── */}
      <div className="panel-header">
        <div className="panel-title">
          <ListIcon />
          Recent Alerts
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="panel-badge">{total} total</span>
          <button className="icon-btn" onClick={load} disabled={loading} title="Refresh">
            <RefreshIcon />
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="at-toolbar">
        <input
          className="filter-input at-search"
          placeholder="Search by title, host, user…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />

        <select className="filter-select" value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map((s) => <option key={s}>{s}</option>)}
        </select>

        <div className="severity-chip-group">
          <button
            className={`severity-chip${severity === "" ? " active" : ""}`}
            onClick={() => { setSeverity(""); setPage(1); }}>
            All&nbsp;<strong>{totalSevCount}</strong>
          </button>
          {SEVERITIES.map((lvl) => (
            <button key={lvl}
              className={`severity-chip sev-chip-${lvl}${severity === lvl ? " active" : ""}`}
              onClick={() => { setSeverity((c) => c === lvl ? "" : lvl); setPage(1); }}>
              {lvl}&nbsp;<strong>{severityCounts[lvl] || 0}</strong>
            </button>
          ))}
        </div>

        {(severity || status || search) &&
          <button className="filter-clear" onClick={resetFilters}>✕</button>}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="alert-error">
          <span>⚠ {error}</span>
          <button onClick={load}>Retry</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="at-table-wrap">
        <table className="alert-table at-table">
          <thead>
            <tr>
              <th className="at-col-sev">Severity</th>
              <th className="at-col-title">Title</th>
              <th className="at-col-host">Computer</th>
              <th className="at-col-user">User</th>
              <th className="at-col-status">Status</th>
              <th className="at-col-time">Time</th>
              <th className="at-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !alerts.length ? (
              <tr><td colSpan="7"><div className="empty-state">// loading…</div></td></tr>
            ) : !alerts.length ? (
              <tr><td colSpan="7"><div className="empty-state">// no alerts match filters</div></td></tr>
            ) : alerts.map((a) => (
              <tr
                key={a.id}
                className={[
                  a.status === "NEW"     ? "row-new"   : "",
                  flashIds.has(a.id)     ? "row-flash" : "",
                  onSelectAlert          ? "row-clickable" : "",
                ].filter(Boolean).join(" ")}
                onClick={onSelectAlert ? () => onSelectAlert(a) : undefined}
                role={onSelectAlert ? "button" : undefined}
                tabIndex={onSelectAlert ? 0 : undefined}
                onKeyDown={onSelectAlert ? (e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectAlert(a); }
                } : undefined}
              >
                {/* Severity */}
                <td className="at-col-sev">
                  <span
                    className="at-sev-bar"
                    style={{ background: SEV_COLORS[a.severity] ?? "#7a9bbf" }}
                  />
                  <span className={`sev-badge sev-${a.severity}`}>{a.severity}</span>
                </td>

                {/* Title */}
                <td className="at-col-title">
                  <div className="alert-title">
                    <span className="alert-dot"
                      style={{ background: SEV_COLORS[a.severity] ?? "#7a9bbf" }} />
                    <span className="at-title-text">{a.title}</span>
                  </div>
                  {a.description && (
                    <div className="at-desc">{a.description.slice(0, 80)}</div>
                  )}
                </td>

                {/* Computer */}
                <td className="at-col-host">
                  <span className="at-mono-cell">
                    {a.computer_name ?? a.event?.computer_name ?? "—"}
                  </span>
                </td>

                {/* User */}
                <td className="at-col-user">
                  <span className="at-mono-cell">
                    {(() => {
                      const u = a.user ?? a.event?.user ?? "";
                      return u ? (u.includes("\\") ? u.split("\\").pop() : u) : "—";
                    })()}
                  </span>
                </td>

                {/* Status */}
                <td className="at-col-status">
                  <span className={`status-pill status-${a.status}`}>{a.status}</span>
                </td>

                {/* Time */}
                <td className="at-col-time">
                  <span className="time-mono">
                    {new Date(a.created_at).toLocaleString(undefined, {
                      month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </td>

                {/* Actions */}
                <td className="at-col-actions">
                  <div className="action-btns">
                    {a.status === "NEW" && (
                      <button className="act-btn act-ack"
                        disabled={updating === a.id}
                        onClick={(e) => handleStatus(a.id, "ACKNOWLEDGED", e)}>
                        ACK
                      </button>
                    )}
                    {["NEW", "OPEN", "ACKNOWLEDGED"].includes(a.status) && (
                      <button className="act-btn act-resolve"
                        disabled={updating === a.id}
                        onClick={(e) => handleStatus(a.id, "RESOLVED", e)}>
                        RESOLVE
                      </button>
                    )}
                    {!["FALSE_POSITIVE", "RESOLVED"].includes(a.status) && (
                      <button className="act-btn act-fp"
                        disabled={updating === a.id}
                        onClick={(e) => handleStatus(a.id, "FALSE_POSITIVE", e)}>
                        FP
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
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
