/**
 * Toast — shows a brief notification at the top-right.
 * Props: { message, severity, onClose }
 */
const SEV_COLORS = { LOW: "#22d3a0", MEDIUM: "#fbbf24", HIGH: "#fb923c", CRITICAL: "#f43f5e" };

function Toast({ message, severity, onClose }) {
  const color = SEV_COLORS[severity] ?? "#00d2ff";
  return (
    <div className="toast" style={{ borderLeftColor: color }}>
      <div className="toast-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <div className="toast-body">
        <span className="toast-label" style={{ color }}>
          {severity ? `${severity} ALERT` : "UPDATE"}
        </span>
        <span className="toast-msg">{message}</span>
      </div>
      <button className="toast-close" onClick={onClose}>✕</button>
    </div>
  );
}

export default Toast;
