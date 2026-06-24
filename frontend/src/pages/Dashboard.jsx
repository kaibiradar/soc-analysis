import { useCallback, useState } from "react";
import Header from "../components/Header";
import StatCards from "../components/StatCards";
import AlertTable from "../components/AlertTable";
import MitrePanel from "../components/MitrePanel";
import SeverityChart from "../components/SeverityChart";
import TimelineChart from "../components/TimelineChart";
import Toast from "../components/Toast";
import { useSSE } from "../hooks/useSSE";

function Dashboard() {
  const [liveStats,   setLiveStats]   = useState(null);
  const [toasts,      setToasts]      = useState([]);
  const [alertTick,   setAlertTick]   = useState(0); // increment to trigger AlertTable reload

  const addToast = (msg, severity) => {
    const id = Date.now();
    setToasts((t) => [...t.slice(-3), { id, msg, severity }]); // max 4 toasts
    setTimeout(() => removeToast(id), 6000);
  };

  const removeToast = (id) =>
    setToasts((t) => t.filter((x) => x.id !== id));

  const handleSSE = useCallback((type, data) => {
    if (type === "stats") {
      setLiveStats(data);
    } else if (type === "new_alert") {
      setAlertTick((n) => n + 1);
      setLiveStats(null); // force StatCards to re-fetch
      addToast(`New alert: ${data.title}`, data.severity);
    } else if (type === "alert_updated") {
      setAlertTick((n) => n + 1);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useSSE(handleSSE);

  return (
    <>
      <Header />

      {/* Toast tray */}
      <div className="toast-tray">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.msg} severity={t.severity}
            onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <div className="container">
        <div>
          <div className="section-label">system metrics</div>
          <StatCards liveStats={liveStats} />
        </div>

        <div className="charts-row">
          <TimelineChart />
          <SeverityChart liveStats={liveStats} />
        </div>

        <div>
          <div className="section-label">detections</div>
          <AlertTable onNewAlert={alertTick} />
        </div>

        <div>
          <div className="section-label">threat intelligence</div>
          <MitrePanel />
        </div>
      </div>
    </>
  );
}

export default Dashboard;
