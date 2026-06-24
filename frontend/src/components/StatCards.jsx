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

const cards = [
  {
    key: "total_events",
    label: "Total Events",
    icon: <ActivityIcon />,
    iconClass: "card-icon-cyan",
    valClass: "val-cyan",
    cardClass: "card-events",
    sub: "collected from sysmon",
  },
  {
    key: "total_alerts",
    label: "Total Alerts",
    icon: <BellIcon />,
    iconClass: "card-icon-critical",
    valClass: "val-critical",
    cardClass: "card-alerts",
    sub: "rule-matched events",
  },
  {
    key: "HIGH",
    label: "High Severity",
    icon: <AlertTriIcon />,
    iconClass: "card-icon-high",
    valClass: "val-high",
    cardClass: "card-high",
    sub: "requires attention",
  },
  {
    key: "CRITICAL",
    label: "Critical",
    icon: <ZapIcon />,
    iconClass: "card-icon-amber",
    valClass: "val-amber",
    cardClass: "card-critical",
    sub: "immediate response",
  },
];

function StatCards() {
  const [stats, setStats] = useState({
    total_events: 0,
    total_alerts: 0,
    severity_distribution: {},
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getStats();
        setStats(data);
      } catch (err) {
        console.error("Stats Error:", err);
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, 30000);
    return () => clearInterval(id);
  }, []);

  const getValue = (key) => {
    if (key === "total_events") return stats.total_events;
    if (key === "total_alerts") return stats.total_alerts;
    return stats.severity_distribution?.[key] ?? 0;
  };

  return (
    <div className="cards">
      {cards.map((c) => (
        <div key={c.key} className={`card ${c.cardClass}`}>
          <div className="card-header">
            <div className={`card-icon ${c.iconClass}`}>{c.icon}</div>
            <span className="card-label">{c.label}</span>
          </div>
          <div className={`card-value ${c.valClass}`}>
            {getValue(c.key).toLocaleString()}
          </div>
          <div className="card-sub">// {c.sub}</div>
        </div>
      ))}
    </div>
  );
}

export default StatCards;
