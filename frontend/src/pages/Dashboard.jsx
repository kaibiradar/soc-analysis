/**
 * Dashboard — root orchestrator.
 * Single WebSocket connection distributes live data to all child components.
 */
import { useCallback, useState } from "react";

import Header            from "../components/Header";
import StatCards         from "../components/StatCards";
import AlertTable        from "../components/AlertTable";
import MitrePanel        from "../components/MitrePanel";
import SeverityChart     from "../components/SeverityChart";
import TimelineChart     from "../components/TimelineChart";
import IocSummary        from "../components/IocSummary";
import HostSummary       from "../components/HostSummary";
import AlertDetailsDrawer from "../components/AlertDetailsDrawer";
import Toast             from "../components/Toast";

import { useSocket }        from "../hooks/useSocket";
import { useNotifications } from "../hooks/useNotifications";

function Dashboard() {
  const [liveStats,     setLiveStats]     = useState(null);
  const [liveTimeline,  setLiveTimeline]  = useState(null);
  const [newAlerts,     setNewAlerts]     = useState([]);
  const [updatedAlert,  setUpdatedAlert]  = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [toasts,        setToasts]        = useState([]);

  const { trigger: notify } = useNotifications();

  const addToast = useCallback((msg, severity) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, msg, severity }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 7000);
  }, []);

  const handleSocket = useCallback(
    (event, data) => {
      switch (event) {
        case "new_alert":
          setNewAlerts((prev) => [data, ...prev].slice(0, 20));
          notify(data.title, data.severity);
          addToast(data.title, data.severity);
          break;

        case "alert_updated":
          setUpdatedAlert(data);
          setSelectedAlert((cur) =>
            cur && cur.id === data.id ? { ...cur, ...data } : cur
          );
          break;

        case "stats_update":
          setLiveStats(data);
          break;

        case "timeline_update":
          setLiveTimeline(data);
          break;

        default:
          break;
      }
    },
    [notify, addToast]
  );

  const { connected } = useSocket(handleSocket);

  return (
    <>
      <Header connected={connected} />

      <div className="toast-tray">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            message={t.msg}
            severity={t.severity}
            onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>

      <div className="container">

        {/* ── Metrics row ── */}
        <StatCards liveStats={liveStats} />

        {/* ── Charts row ── */}
        <div className="charts-row">
          <TimelineChart liveTimeline={liveTimeline} />
          <SeverityChart liveStats={liveStats} />
        </div>

        {/* ── Alerts (full width) ── */}
        <div>
          <div className="section-label">detections</div>
          <AlertTable
            newAlerts={newAlerts}
            updatedAlert={updatedAlert}
            onSelectAlert={setSelectedAlert}
          />
        </div>

        {/* ── IOC + Host intel ── */}
        <IocSummary />
        <HostSummary />

        {/* ── MITRE ── */}
        <div>
          <div className="section-label">threat intelligence</div>
          <MitrePanel />
        </div>

      </div>

      <AlertDetailsDrawer
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
      />
    </>
  );
}

export default Dashboard;
