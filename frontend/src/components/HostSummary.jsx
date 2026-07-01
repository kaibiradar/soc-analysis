import { useEffect, useMemo, useState } from "react";
import { getAlerts, getEvents } from "../api/api";

const HostIcon = () => (
  <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M7 20h10" />
    <path d="M12 16v4" />
    <path d="M7 8h.01M11 8h.01M15 8h.01" />
  </svg>
);

const SEVERITY_SCORE = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const formatDate = (value) => {
  if (!value) return "--";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

function getHostKey(value) {
  return String(value || "UNKNOWN").trim().toUpperCase();
}

function HostSummary() {
  const [hosts, setHosts] = useState(new Map());
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadHosts = async () => {
      try {
        const [eventsData, alertsData] = await Promise.all([
          getEvents({ perPage: 1000 }),
          getAlerts({ perPage: 1000 }),
        ]);

        if (cancelled) return;

        const nextHosts = new Map();

        const upsertHost = (hostName) => {
          const key = getHostKey(hostName);
          if (!nextHosts.has(key)) {
            nextHosts.set(key, {
              name: key,
              eventCount: 0,
              alertCount: 0,
              lastSeen: null,
              severityCounts: {
                LOW: 0,
                MEDIUM: 0,
                HIGH: 0,
                CRITICAL: 0,
              },
            });
          }

          return nextHosts.get(key);
        };

        for (const event of eventsData.events || []) {
          const host = upsertHost(event.computer_name);
          host.eventCount += 1;

          if (event.timestamp) {
            const timestamp = new Date(event.timestamp);
            if (!Number.isNaN(timestamp.getTime()) && (!host.lastSeen || timestamp > host.lastSeen)) {
              host.lastSeen = timestamp;
            }
          }
        }

        for (const alert of alertsData.alerts || []) {
          const host = upsertHost(alert.computer_name);
          host.alertCount += 1;

          if (alert.severity && host.severityCounts[alert.severity] !== undefined) {
            host.severityCounts[alert.severity] += 1;
          }

          if (alert.created_at) {
            const timestamp = new Date(alert.created_at);
            if (!Number.isNaN(timestamp.getTime()) && (!host.lastSeen || timestamp > host.lastSeen)) {
              host.lastSeen = timestamp;
            }
          }
        }

        setHosts(nextHosts);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    };

    void loadHosts();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const items = [...hosts.values()].map((host) => {
      const severityWeight = SEVERITY_ORDER.reduce(
        (sum, severity) => sum + ((host.severityCounts[severity] || 0) * SEVERITY_SCORE[severity]),
        0
      );

      return {
        ...host,
        score: host.eventCount + (host.alertCount * 2) + severityWeight,
      };
    }).sort((a, b) => b.score - a.score || b.lastSeen - a.lastSeen || a.name.localeCompare(b.name));

    const totals = items.reduce(
      (accumulator, host) => {
        accumulator.events += host.eventCount;
        accumulator.alerts += host.alertCount;
        accumulator.alertingHosts += host.alertCount > 0 ? 1 : 0;
        accumulator.criticalHosts += host.severityCounts.CRITICAL > 0 ? 1 : 0;
        return accumulator;
      },
      {
        hosts: items.length,
        events: 0,
        alerts: 0,
        alertingHosts: 0,
        criticalHosts: 0,
      }
    );

    return {
      items: items.slice(0, 6),
      totals,
    };
  }, [hosts]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><HostIcon />Host Summary</div>
        <span className="panel-badge">{summary.totals.hosts} hosts</span>
      </div>

      {error ? (
        <div className="panel-error">⚠ {error}</div>
      ) : (
        <>
          <div className="host-summary-grid">
            <div className="host-summary-card">
              <span className="host-summary-label">Hosts seen</span>
              <strong>{summary.totals.hosts}</strong>
            </div>
            <div className="host-summary-card">
              <span className="host-summary-label">Events</span>
              <strong>{summary.totals.events}</strong>
            </div>
            <div className="host-summary-card">
              <span className="host-summary-label">Alerts</span>
              <strong>{summary.totals.alerts}</strong>
            </div>
            <div className="host-summary-card">
              <span className="host-summary-label">Critical hosts</span>
              <strong>{summary.totals.criticalHosts}</strong>
            </div>
          </div>

          <div className="host-list">
            {summary.items.length > 0 ? summary.items.map((host) => (
              <article className="host-card" key={host.name}>
                <div className="host-card-head">
                  <div>
                    <div className="host-name">{host.name}</div>
                    <div className="host-meta">Last seen {formatDate(host.lastSeen)}</div>
                  </div>
                  <span className="panel-badge">{host.score}</span>
                </div>

                <div className="host-stats">
                  <span>{host.eventCount} events</span>
                  <span>{host.alertCount} alerts</span>
                </div>

                <div className="host-severity-row">
                  {SEVERITY_ORDER.map((severity) => (
                    <span className={`host-severity sev-${severity}`} key={severity}>
                      {severity[0]} {host.severityCounts[severity] || 0}
                    </span>
                  ))}
                </div>
              </article>
            )) : (
              <p className="host-empty">// no hosts observed</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default HostSummary;