import { useEffect, useState } from "react";
import { getAlerts } from "../api/api";

const ListIcon = () => (
  <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const SEV_COLORS = {
  LOW:      "#22d3a0",
  MEDIUM:   "#fbbf24",
  HIGH:     "#fb923c",
  CRITICAL: "#f43f5e",
};

function AlertTable() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getAlerts();
        if (data.alerts) setAlerts(data.alerts);
      } catch (err) {
        console.error("Alert Error:", err);
      }
    };
    load();
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ListIcon />
          Recent Alerts
        </div>
        <span className="panel-badge">{alerts.length} entries</span>
      </div>

      <table className="alert-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {alerts.length > 0 ? (
            alerts.map((alert, i) => (
              <tr key={i}>
                <td>
                  <div className="alert-title">
                    <span
                      className="alert-dot"
                      style={{ background: SEV_COLORS[alert.severity] ?? "#7a9bbf" }}
                    />
                    {alert.title}
                  </div>
                </td>
                <td>
                  <span className={`sev-badge sev-${alert.severity}`}>
                    {alert.severity}
                  </span>
                </td>
                <td>
                  <span className={`status-pill status-${alert.status}`}>
                    {alert.status}
                  </span>
                </td>
                <td>
                  <span className="time-mono">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4">
                <div className="empty-state">// no alerts found</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default AlertTable;
