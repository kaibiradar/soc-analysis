/**
 * useSocket — connects to Flask-SocketIO, joins the 'soc' room,
 * and calls onEvent(eventName, data) for every inbound message.
 *
 * Auto-reconnects. Returns { connected } so the Header can show
 * a live connection indicator.
 */
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://127.0.0.1:5000";

const EVENTS = [
  "new_alert",
  "alert_updated",
  "new_event",
  "stats_update",
  "timeline_update",
  "connected",
];

export function useSocket(onEvent) {
  const [connected, setConnected] = useState(false);
  const cbRef     = useRef(onEvent);
  const socketRef = useRef(null);

  useEffect(() => { cbRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports:        ["websocket", "polling"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout:           10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join", { room: "soc" });
    });

    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    EVENTS.forEach((ev) => {
      socket.on(ev, (data) => cbRef.current(ev, data));
    });

    return () => {
      socket.disconnect();
    };
  }, []);                // eslint-disable-line react-hooks/exhaustive-deps

  return { connected, socket: socketRef };
}
