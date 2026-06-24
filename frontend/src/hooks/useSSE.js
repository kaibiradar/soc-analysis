/**
 * useSSE — subscribes to the Flask /api/stream SSE endpoint.
 * Calls onEvent(type, data) whenever a message arrives.
 * Auto-reconnects after 3 s on connection drop.
 */
import { useEffect, useRef } from "react";

export function useSSE(onEvent) {
  const cbRef    = useRef(onEvent);
  const esRef    = useRef(null);
  const timerRef = useRef(null);

  // keep callback ref current without re-subscribing
  useEffect(() => { cbRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    let active = true;

    function connect() {
      if (!active) return;
      const es = new EventSource("/api/stream");
      esRef.current = es;

      const handle = (type) => (e) => {
        try {
          const data = JSON.parse(e.data);
          cbRef.current(type, data);
        } catch {/* ignore malformed */}
      };

      es.addEventListener("new_alert",     handle("new_alert"));
      es.addEventListener("alert_updated", handle("alert_updated"));
      es.addEventListener("stats",         handle("stats"));

      es.onerror = () => {
        es.close();
        if (active) {
          timerRef.current = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      active = false;
      clearTimeout(timerRef.current);
      esRef.current?.close();
    };
  }, []);
}
