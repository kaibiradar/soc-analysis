import { useEffect, useState } from "react";

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7l-9-5z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const WifiIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <circle cx="12" cy="20" r="1" fill="currentColor" />
  </svg>
);

function Header({ connected = true }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = time.toLocaleTimeString("en-US", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const dateFmt = time.toLocaleDateString("en-US", {
    month: "short", day: "2-digit", year: "numeric",
  });

  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo"><ShieldIcon /></span>
        <span className="header-title"><span>SOC</span>·ANALYSIS</span>
        <span className="header-ver">v2.0</span>
      </div>

      <div className="header-right">
        <span className="header-time">
          <ClockIcon />&nbsp;{dateFmt}&nbsp;&nbsp;{fmt}
        </span>

        {/* WebSocket connection indicator */}
        <div className={`ws-badge ${connected ? "ws-connected" : "ws-disconnected"}`}>
          <WifiIcon />
          {connected ? "LIVE" : "OFFLINE"}
        </div>

        <div className="status-badge">
          <span className="status-dot" />
          SYSTEM ONLINE
        </div>
      </div>
    </header>
  );
}

export default Header;
