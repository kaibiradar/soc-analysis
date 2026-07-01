import { useState } from "react";
import Dashboard   from "./pages/Dashboard";
import LogExplorer from "./pages/LogExplorer";

/* ── Nav icons ── */
const DashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const LogsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
    <line x1="8" y1="9"  x2="10" y2="9"  />
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7l-9-5z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const PAGES = [
  { key: "dashboard", label: "Dashboard",    icon: <DashIcon /> },
  { key: "logs",      label: "Log Explorer", icon: <LogsIcon /> },
];

const COMPONENTS = {
  dashboard: Dashboard,
  logs:      LogExplorer,
};

function App() {
  const [page, setPage] = useState("dashboard");
  const Active = COMPONENTS[page];

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <span className="sidebar-logo"><ShieldIcon /></span>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">SOC</span>
            <span className="sidebar-brand-sub">analysis</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-label">navigation</div>
          {PAGES.map(({ key, label, icon }) => (
            <button
              key={key}
              className={`sidebar-item${page === key ? " sidebar-item-active" : ""}`}
              onClick={() => setPage(key)}
            >
              <span className="sidebar-item-icon">{icon}</span>
              <span className="sidebar-item-label">{label}</span>
              {page === key && <span className="sidebar-item-bar" />}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <span className="sidebar-footer-text">v2.0 · real-time</span>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="app-main">
        <Active />
      </main>
    </div>
  );
}

export default App;
