import { useEffect, useState } from "react";
import { getStats } from "../api/api";

const ActivityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const AlertTriIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ZapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const CARD_CFG = [
  { key: "total_events", label: "Total Events", icon: <ActivityIcon />, iconCls: "card-icon-cyan", valCls: "val-cyan", cardCls: "card-events", sub: "collected from sysmon" },
  { key: "total_alerts", label: "Total Alerts", icon: <BellIcon />, iconCls: "card-icon-critical", valCls: "val-critical", cardCls: "card-alerts", sub: "rule-matched events" },
  { key: "HIGH", label: "High Severity", icon: <AlertTriIcon />, iconCls: "card-icon-high", valCls: "val-high", cardCls: "card-high", sub: "requires attention" },
  { key: "CRITICAL", label: "Critical", icon: <ZapIcon />, iconCls: "card-icon-amber", valCls: "val-amber", cardCls: "card-critical", sub: "immediate response" },
];

function StatCards({ liveStats = null }) {
  const [stats, setStats] = useState({ total_events: 0, total_alerts: 0, severity_distribution: {} });
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const refreshStats = () => {
      getStats()
        .then((data) => {
          setStats(data);
          setError(null);
        })
        .catch((e) => setError(e.message));
    };

    const timeoutId = window.setTimeout(refreshStats, 0);
    const intervalId = window.setInterval(refreshStats, 60000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!liveStats) return;

    const timeoutId = window.setTimeout(() => {
      setStats(liveStats);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 600);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [liveStats]);

  const val = (key) => {
    if (key === "total_events") return stats.total_events ?? 0;
    if (key === "total_alerts") return stats.total_alerts ?? 0;
    return stats.severity_distribution?.[key] ?? 0;
  };

  return (
    <>
      {error && <div className="alert-error" style={{ marginBottom: 12 }}>Stats unavailable: {error}</div>}
      <div className={`cards ${flash ? "cards-flash" : ""}`}>
        {CARD_CFG.map((c) => (
          <div key={c.key} className={`card ${c.cardCls}`}>
            <div className="card-header">
              <div className={`card-icon ${c.iconCls}`}>{c.icon}</div>
              <span className="card-label">{c.label}</span>
            </div>
            <div className={`card-value ${c.valCls}`}>{val(c.key).toLocaleString()}</div>
            <div className="card-sub">// {c.sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export default StatCards;
