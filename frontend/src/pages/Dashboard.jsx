/**
 * Dashboard — root orchestrator.
 * Owns the single WebSocket connection via useSocket().
 * Distributes live events/alerts/stats to child components.
 */
import { useCallback, useState, useRef } from "react";

import Header         from "../components/Header";
import StatCards      from "../components/StatCards";
import AlertTable     from "../components/AlertTable";
import MitrePanel     from "../components/MitrePanel";
import SeverityChart  from "../components/SeverityChart";
import TimelineChart  from "../components/TimelineChart";
import LiveEventFeed  from "../components/LiveEventFeed";
import Toast          from "../components/Toast";

import { useSocket }        from "../hooks/useSocket";
import { useNotifications } from "../hooks/useNotifications";

const MAX_LIVE_EVENTS = 50;

function Dashboard() {
  const [liveStats,     setLiveStats]     = useState(null);
  const [liveTimeline,  setLiveTimeline]  = useState(null);
  const [liveEvents,    setLiveEvents]    = useState([]);   // raw events feed
  const [newAlerts,     setNewAlerts]     = useState([]);   // latest alert for AlertTable
  const [updatedAlert,  setUpdatedAlert]  = useState(null); // status update
  const [toasts,        setToasts]        = useState([]);
  const uidRef = useRef(0);

  const { trigger: notify } = useNotifications();

  const addToast = useCallback((msg, severity) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, msg, severity }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 7000);
  }, []);

  const handleSocket = useCallback((event, data) => {
    switch (event) {

      case "new_event":
        setLiveEvents((prev) => {
          const item = { ...data, _uid: ++uidRef.current };
          return [item, ...prev].slice(0, MAX_LIVE_EVENTS);
        });
        break;

      case "new_alert":
        setNewAlerts((prev) => [data, ...prev].slice(0, 20));
        notify(data.title, data.severity);
        addToast(`${data.title}`, data.severity);
        break;

      case "alert_updated":
        setUpdatedAlert(data);
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
  }, [notify, addToast]);

  const { connected } = useSocket(handleSocket);

  return (
    <>
      <Header connected={connected} />

      {/* Toast tray */}
      <div className="toast-tray">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.msg} severity={t.severity}
            onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>

      <div className="container">

        {/* ── Stat cards ── */}
        <div>
          <div className="section-label">system metrics</div>
          <StatCards liveStats={liveStats} />
        </div>

        {/* ── Charts ── */}
        <div className="charts-row">
          <TimelineChart liveTimeline={liveTimeline} />
          <SeverityChart liveStats={liveStats} />
        </div>

        {/* ── Alerts + Live feed side by side ── */}
        <div>
          <div className="section-label">detections</div>
          <div className="detections-row">
            <AlertTable newAlerts={newAlerts} updatedAlert={updatedAlert} />
            <LiveEventFeed events={liveEvents} />
          </div>
        </div>

        {/* ── MITRE ── */}
        <div>
          <div className="section-label">threat intelligence</div>
          <MitrePanel />
        </div>

      </div>
    </>
  );
}

export default Dashboard;
