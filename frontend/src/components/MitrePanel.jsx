import { useEffect, useMemo, useState } from "react";
import { getAlerts, getMitre, getRules } from "../api/api";

const TargetIcon = () => (
  <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
);

const TECHNIQUE_COLORS = {
  T1059: "#f43f5e", T1078: "#fb923c", T1110: "#fbbf24",
  T1047: "#00d2ff", T1566: "#a78bfa", T1003: "#f43f5e",
  T1021: "#fb923c", T1071: "#22d3a0", T1112: "#fbbf24",
};
const tColor = (id) => TECHNIQUE_COLORS[id] ?? "#7a9bbf";

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const severityColor = {
  LOW: "var(--sev-low)",
  MEDIUM: "var(--sev-medium)",
  HIGH: "var(--sev-high)",
  CRITICAL: "var(--sev-critical)",
};

function MitrePanel() {
  const [techniques, setTechniques] = useState([]);
  const [rules, setRules] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError]           = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadMitre = async () => {
      try {
        const [mitreData, rulesData, alertsData] = await Promise.all([
          getMitre(),
          getRules({ enabledOnly: true, perPage: 1000 }),
          getAlerts({ perPage: 1000 }),
        ]);

        if (cancelled) return;

        setTechniques(mitreData.techniques || []);
        setRules(rulesData.rules || []);
        setAlerts(alertsData.alerts || []);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    };

    void loadMitre();

    return () => {
      cancelled = true;
    };
  }, []);

  const enriched = useMemo(() => {
    const alertsByRule = new Map();

    for (const alert of alerts) {
      if (!alert?.title) continue;
      const current = alertsByRule.get(alert.title) || [];
      current.push(alert);
      alertsByRule.set(alert.title, current);
    }

    const techniqueMap = new Map();

    for (const technique of techniques) {
      techniqueMap.set(technique.id, {
        ...technique,
        ruleCount: 0,
        coveredRules: 0,
        alertCount: 0,
        severityCounts: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      });
    }

    for (const rule of rules) {
      const ruleAlerts = alertsByRule.get(rule.name) || [];
      const ruleTechniqueIds = (rule.tags || [])
        .map((tag) => String(tag).toUpperCase())
        .filter((tag) => /^T\d{4}$/.test(tag));

      if (!ruleTechniqueIds.length) continue;

      for (const techniqueId of ruleTechniqueIds) {
        const entry = techniqueMap.get(techniqueId);
        if (!entry) continue;

        entry.ruleCount += 1;
        entry.alertCount += ruleAlerts.length;

        if (ruleAlerts.length > 0) {
          entry.coveredRules += 1;
        }

        for (const alert of ruleAlerts) {
          entry.severityCounts[alert.severity] = (entry.severityCounts[alert.severity] || 0) + 1;
        }
      }
    }

    return [...techniqueMap.values()].sort((a, b) => b.alertCount - a.alertCount || a.id.localeCompare(b.id));
  }, [alerts, rules, techniques]);

  const summary = useMemo(() => {
    const covered = enriched.filter((item) => item.coveredRules > 0).length;
    const totalRules = enriched.reduce((sum, item) => sum + item.ruleCount, 0);
    const totalAlerts = enriched.reduce((sum, item) => sum + item.alertCount, 0);

    return {
      totalTechniques: enriched.length,
      coveredTechniques: covered,
      coveragePct: enriched.length ? Math.round((covered / enriched.length) * 100) : 0,
      totalRules,
      totalAlerts,
    };
  }, [enriched]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><TargetIcon />MITRE ATT&amp;CK</div>
        <span className="panel-badge">{summary.coveragePct}% coverage</span>
      </div>

      {error ? (
        <div className="panel-error">⚠ {error}</div>
      ) : (
        <>
          <div className="mitre-summary">
            <div className="mitre-summary-card">
              <span className="mitre-summary-label">Techniques</span>
              <strong>{summary.totalTechniques}</strong>
            </div>
            <div className="mitre-summary-card">
              <span className="mitre-summary-label">Covered</span>
              <strong>{summary.coveredTechniques}</strong>
            </div>
            <div className="mitre-summary-card">
              <span className="mitre-summary-label">Rules mapped</span>
              <strong>{summary.totalRules}</strong>
            </div>
            <div className="mitre-summary-card">
              <span className="mitre-summary-label">Alerts mapped</span>
              <strong>{summary.totalAlerts}</strong>
            </div>
          </div>

          <div className="mitre-tech-grid">
            {enriched.length > 0 ? enriched.map((item) => {
              const coverage = item.ruleCount ? Math.round((item.coveredRules / item.ruleCount) * 100) : 0;

              return (
                <div className="mitre-tech-card" key={item.id}>
                  <div className="mitre-tech-head">
                    <div>
                      <div className="mitre-id">{item.id}</div>
                      <div className="mitre-name">{item.name}</div>
                    </div>
                    <span className="panel-badge">{coverage}%</span>
                  </div>

                  <div className="mitre-tech-meta">
                    <span>{item.ruleCount} rule{item.ruleCount === 1 ? "" : "s"}</span>
                    <span>{item.alertCount} alert{item.alertCount === 1 ? "" : "s"}</span>
                  </div>

                  <div className="mitre-tech-bar">
                    <div className="mitre-tech-fill" style={{ width: `${coverage}%`, background: tColor(item.id) }} />
                  </div>

                  <div className="mitre-tech-severity">
                    {SEVERITY_ORDER.map((sev) => (
                      <span key={sev} className="mitre-tech-pill" style={{ color: severityColor[sev] }}>
                        {sev[0]} {item.severityCounts[sev] || 0}
                      </span>
                    ))}
                  </div>
                </div>
              );
            }) : (
              <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                // no techniques mapped
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default MitrePanel;
