import { useMemo } from "react";

const formatDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const Field = ({ label, value }) => (
  <div className="drawer-field">
    <span className="drawer-label">{label}</span>
    <span className="drawer-value">{value || "--"}</span>
  </div>
);

function AlertDetailsDrawer({ alert, onClose }) {
  const detail = alert;
  const eventDetail = alert?.event || null;
  const eventDetails = eventDetail?.details || alert?.event_details || null;
  const error = null;

  const iocs = useMemo(() => {
    const source = JSON.stringify(
      [detail, eventDetail, eventDetails].filter(Boolean),
      null,
      2
    );

    const matches = {
      ips: [...new Set(source.match(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g) || [])],
      hashes: [...new Set((source.match(/\b[a-fA-F0-9]{32,64}\b/g) || []).map((value) => value.toLowerCase()))],
      domains: [...new Set((source.match(/\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/g) || []).map((value) => value.toLowerCase()))],
      urls: [...new Set((source.match(/\bhttps?:\/\/[^\s"'<>\]]+/gi) || []).map((value) => value.replace(/[),.;]+$/, "")))],
    };

    return matches;
  }, [detail, eventDetail, eventDetails]);

  if (!alert) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="drawer-panel" role="dialog" aria-modal="true" aria-label="Alert details" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div className="panel-title">Alert Details</div>
            <div className="drawer-title">{detail?.title || alert.title}</div>
          </div>

          <button className="drawer-close" type="button" onClick={onClose} aria-label="Close alert details">
            <CloseIcon />
          </button>
        </div>

        {error ? (
          <div className="panel-error">⚠ {error}</div>
        ) : (
          <>
            <div className="drawer-badges">
              <span className={`sev-badge sev-${detail?.severity || alert.severity}`}>{detail?.severity || alert.severity}</span>
              <span className={`status-pill status-${detail?.status || alert.status}`}>{detail?.status || alert.status}</span>
            </div>

            <div className="drawer-grid">
              <Field label="Alert ID" value={detail?.id || alert.id} />
              <Field label="Rule" value={detail?.rule_name || alert.rule_name} />
              <Field label="Event ID" value={detail?.event_id || alert.event_id || eventDetail?.event_id} />
              <Field label="Event Type" value={detail?.event_type || alert.event_type || eventDetail?.event_type} />
              <Field label="Assigned To" value={detail?.assigned_to} />
              <Field label="Computer" value={eventDetail?.computer_name || detail?.computer_name || alert.computer_name} />
              <Field label="User" value={eventDetail?.user || detail?.user || alert.user} />
              <Field label="Created" value={formatDate(detail?.created_at || alert.created_at)} />
              <Field label="Updated" value={formatDate(detail?.updated_at || alert.updated_at)} />
            </div>

            <div className="drawer-section">
              <div className="drawer-section-title">Description</div>
              <p className="drawer-text">{detail?.description || alert.description || "--"}</p>
            </div>

            <div className="drawer-section">
              <div className="drawer-section-title">Related Event</div>
              {eventDetail ? (
                <div className="drawer-event-card">
                  <div className="drawer-event-meta">
                    <span>{eventDetail.event_type || detail?.event_type || "--"}</span>
                    <span>{eventDetail.computer_name || detail?.computer_name || "--"}</span>
                    <span>{eventDetail.user || detail?.user || "--"}</span>
                  </div>
                  <div className="drawer-text">{eventDetail.description || detail?.event_description || alert.event_description || "--"}</div>
                </div>
              ) : (
                <div className="drawer-empty">// no linked event data</div>
              )}
            </div>

            {eventDetails && Object.keys(eventDetails).length > 0 && (
              <div className="drawer-section">
                <div className="drawer-section-title">Event Payload</div>
                <pre className="drawer-json">{JSON.stringify(eventDetails, null, 2)}</pre>
              </div>
            )}

            <div className="drawer-section">
              <div className="drawer-section-title">Notes</div>
              <p className="drawer-text">{detail?.notes || "--"}</p>
            </div>

            <div className="drawer-section">
              <div className="drawer-section-title">IOC Snapshot</div>
              <div className="drawer-ioc-grid">
                {Object.entries(iocs).map(([key, values]) => (
                  <div className="drawer-ioc-card" key={key}>
                    <div className="drawer-ioc-label">{key}</div>
                    {values.length > 0 ? (
                      <div className="drawer-ioc-list">
                        {values.slice(0, 5).map((value) => (
                          <span className="drawer-ioc-item" key={value}>{value}</span>
                        ))}
                      </div>
                    ) : (
                      <div className="drawer-empty">// none detected</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export default AlertDetailsDrawer;