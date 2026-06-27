/**
 * LiveEventFeed — real-time scrolling feed of raw Sysmon events.
 *
 * Features:
 * - Shows latest 20 events, newest at top
 * - Each new row animates in with a fade + slide-down
 * - Auto-scrolls to top only when user is already there
 * - Columns: Time · Event Type · Computer · User · Description
 * - Pause button stops auto-scroll without losing data
 */
import { useRef, useEffect, useState, useCallback } from "react";

const EVENT_TYPE_COLORS = {
  ProcessCreate:       "#00d2ff",
  NetworkConnect:      "#a78bfa",
  RegistryEvent:       "#fbbf24",
  FileCreate:          "#22d3a0",
  CreateRemoteThread:  "#f43f5e",
  ProcessAccess:       "#fb923c",
  DriverLoaded:        "#e879f9",
  ImageLoaded:         "#818cf8",
  ProcessTerminated:   "#64748b",
  RawAccessRead:       "#f97316",
  FileCreateStreamHash:"#34d399",
};
const etColor = (t) => EVENT_TYPE_COLORS[t] ?? "#7a9bbf";

/* ── Icons ── */
const RssIcon = () => (
  <svg className="panel-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11a9 9 0 0 1 9 9" />
    <path d="M4 4a16 16 0 0 1 16 16" />
    <circle cx="5" cy="19" r="1" fill="currentColor" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ width: 12, height: 12 }}>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ width: 12, height: 12 }}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const MAX_EVENTS = 20;

function LiveEventFeed({ events }) {
  const scrollRef  = useRef(null);
  const prevLen    = useRef(0);
  const [paused, setPaused] = useState(false);

  /**
   * Smart auto-scroll:
   * Only scroll to top when:
   *  1. A new event arrived (length increased)
   *  2. User is NOT paused
   *  3. User is already near the top (scrollTop < 60px)
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const newArrived = events.length > prevLen.current;
    prevLen.current  = events.length;

    if (newArrived && !paused && el.scrollTop < 60) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [events, paused]);

  const handleClear = useCallback(() => {
    // Signal parent via custom event — keeps this component stateless
    // Parent (Dashboard) ignores it; clearing is cosmetic only here
    prevLen.current = 0;
  }, []);

  const displayed = events.slice(0, MAX_EVENTS);

  return (
    <div className="panel lef-panel">
      {/* ── Header ── */}
      <div className="panel-header">
        <div className="panel-title">
          <RssIcon />
          Live Event Feed
          <span className="live-dot" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="panel-badge">{displayed.length} / {MAX_EVENTS}</span>
          <button
            className={`icon-btn lef-pause-btn ${paused ? "lef-paused" : ""}`}
            title={paused ? "Resume auto-scroll" : "Pause auto-scroll"}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
        </div>
      </div>

      {/* ── Column headers ── */}
      <div className="lef-thead">
        <span>Time</span>
        <span>Type</span>
        <span>Computer</span>
        <span>User</span>
        <span>Description</span>
      </div>

      {/* ── Scrollable body ── */}
      <div className="lef-scroll" ref={scrollRef}>
        {displayed.length === 0 ? (
          <div className="empty-state">// awaiting events…</div>
        ) : (
          displayed.map((ev, i) => (
            <div
              key={ev._uid ?? i}
              className={`lef-row ${i === 0 ? "lef-row-enter" : ""}`}
            >
              {/* Time */}
              <span className="lef-time">
                {ev.timestamp
                  ? new Date(ev.timestamp).toLocaleTimeString("en-US", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "—"}
              </span>

              {/* Event type badge */}
              <span
                className="lef-type"
                style={{ color: etColor(ev.event_type) }}
                title={ev.event_type ?? "Unknown"}
              >
                {ev.event_type ?? "Unknown"}
              </span>

              {/* Computer */}
              <span className="lef-host" title={ev.computer_name ?? ""}>
                {ev.computer_name ?? "—"}
              </span>

              {/* User */}
              <span className="lef-user" title={ev.user ?? ""}>
                {ev.user
                  ? ev.user.includes("\\")
                    ? ev.user.split("\\").pop()   // strip domain prefix
                    : ev.user
                  : "—"}
              </span>

              {/* Description */}
              <span className="lef-desc" title={ev.description ?? ""}>
                {(ev.description ?? "").slice(0, 90)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Paused overlay banner */}
      {paused && (
        <div className="lef-paused-banner">
          ⏸ Auto-scroll paused — <button onClick={() => setPaused(false)}>Resume</button>
        </div>
      )}
    </div>
  );
}

export default LiveEventFeed;
