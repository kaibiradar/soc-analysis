/**
 * LiveEventFeed — scrolling ticker of raw Sysmon events pushed via WebSocket.
 * New rows slide in from the top with a flash animation.
 * Auto-scrolls to top on new entry. Capped at 50 entries.
 */
import { useRef, useEffect } from "react";

const SEV_COLORS = { LOW: "#22d3a0", MEDIUM: "#fbbf24", HIGH: "#fb923c", CRITICAL: "#f43f5e" };

const EVENT_TYPE_COLORS = {
  ProcessCreate:      "#00d2ff",
  NetworkConnect:     "#a78bfa",
  RegistryEvent:      "#fbbf24",
  FileCreate:         "#22d3a0",
  CreateRemoteThread: "#f43f5e",
  ProcessAccess:      "#fb923c",
};
const etColor = (t) => EVENT_TYPE_COLORS[t] ?? "#7a9bbf";

const RssIcon = () => (
  <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" />
    <circle cx="5" cy="19" r="1" fill="currentColor" />
  </svg>
);

function LiveEventFeed({ events }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <RssIcon />
          Live Event Feed
          <span className="live-dot" />
        </div>
        <span className="panel-badge">{events.length} events</span>
      </div>

      <div className="live-feed-scroll" ref={scrollRef}>
        {events.length === 0 ? (
          <div className="empty-state">// awaiting events…</div>
        ) : (
          events.map((ev, i) => (
            <div
              key={ev._uid ?? i}
              className={`feed-row ${i === 0 ? "feed-row-new" : ""}`}
            >
              <span className="feed-type" style={{ color: etColor(ev.event_type) }}>
                {ev.event_type ?? "Unknown"}
              </span>
              <span className="feed-host">{ev.computer_name ?? "—"}</span>
              <span className="feed-desc">
                {(ev.description ?? "").slice(0, 80)}
              </span>
              <span className="feed-time">
                {ev.timestamp
                  ? new Date(ev.timestamp).toLocaleTimeString()
                  : "—"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default LiveEventFeed;
