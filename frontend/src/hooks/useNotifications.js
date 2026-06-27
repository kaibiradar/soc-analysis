/**
 * useNotifications — desktop notifications + audio alert for CRITICAL events.
 *
 * Call trigger(title, severity) from the Dashboard when a new alert arrives.
 * Requests Notification permission on first use.
 */
import { useEffect, useRef } from "react";

// Minimal beep synthesised via Web Audio API — no external file needed
function playAlertBeep(frequency = 880, duration = 0.18, repeats = 3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < repeats; i++) {
      const osc   = ctx.createOscillator();
      const gain  = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = "square";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + duration);
      osc.start(ctx.currentTime + i * 0.22);
      osc.stop(ctx.currentTime + i * 0.22 + duration);
    }
    setTimeout(() => ctx.close(), 1500);
  } catch {/* AudioContext blocked in some environments */}
}

export function useNotifications() {
  const permRef = useRef(Notification.permission);

  useEffect(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => { permRef.current = p; });
    }
  }, []);

  const trigger = (title, severity, body = "") => {
    const isCritical = severity === "CRITICAL";
    const isHigh     = severity === "HIGH";

    // ── Desktop notification ──────────────────────────────
    if (permRef.current === "granted") {
      const icon = isCritical ? "🚨" : isHigh ? "⚠️" : "🔔";
      new Notification(`${icon} SOC Alert — ${severity}`, {
        body:    `${title}${body ? "\n" + body : ""}`,
        tag:     `soc-${severity}`,          // replace duplicate severity toasts
        silent:  !isCritical,
      });
    }

    // ── Audio ─────────────────────────────────────────────
    if (isCritical) {
      playAlertBeep(1100, 0.15, 4);          // urgent high-freq beep
    } else if (isHigh) {
      playAlertBeep(660, 0.18, 2);
    }
  };

  return { trigger };
}
