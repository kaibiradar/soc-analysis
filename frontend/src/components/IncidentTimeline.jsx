function IncidentTimeline({ items = [] }) {
  return (
    <div className="incident-timeline">
      {items.length === 0 ? (
        <div className="empty-state">No timeline activity</div>
      ) : (
        items.map((item, index) => (
          <div className="timeline-item" key={`${item.time}-${index}`}>
            <span className={`timeline-dot ${item.kind}`} />
            <div>
              <strong>{item.kind}</strong>
              <p>{item.label}</p>
              <small>{item.time ? new Date(item.time).toLocaleString() : "--"}</small>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default IncidentTimeline;
