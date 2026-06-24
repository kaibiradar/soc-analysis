import { useEffect, useState } from "react";
import { getMitre } from "../api/api";

const TargetIcon = () => (
  <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

/* map technique IDs to a colour for the dot */
const techniqueColor = (id) => {
  const map = {
    T1059: "#f43f5e",
    T1078: "#fb923c",
    T1110: "#fbbf24",
    T1047: "#00d2ff",
    T1566: "#a78bfa",
  };
  return map[id] ?? "#7a9bbf";
};

function MitrePanel() {
  const [techniques, setTechniques] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMitre();
        if (data.techniques) setTechniques(data.techniques);
      } catch (err) {
        console.error("MITRE Error:", err);
      }
    };
    load();
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <TargetIcon />
          MITRE ATT&amp;CK
        </div>
        <span className="panel-badge">{techniques.length} techniques</span>
      </div>

      <div className="mitre-grid">
        {techniques.length > 0 ? (
          techniques.map((t, i) => (
            <div className="mitre-tag" key={i}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: techniqueColor(t.id),
                  flexShrink: 0,
                  boxShadow: `0 0 6px ${techniqueColor(t.id)}`,
                }}
              />
              <span className="mitre-id">{t.id}</span>
              <span className="mitre-name">{t.name}</span>
            </div>
          ))
        ) : (
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            // no techniques mapped
          </p>
        )}
      </div>
    </div>
  );
}

export default MitrePanel;
