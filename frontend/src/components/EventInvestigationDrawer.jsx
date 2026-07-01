/**
 * EventInvestigationDrawer
 *
 * A full side-panel investigation view opened when a user clicks an event
 * in the Log Explorer. Fetches full event details (including related alerts)
 * from /api/events/:id and renders 6 sections:
 *
 *   1. Event Details      — core fields in a structured grid
 *   2. Process Details    — process/file/network fields parsed from description & details
 *   3. MITRE ATT&CK       — mapped techniques derived from alert rule tags
 *   4. IOC Information    — IPs, hashes, domains, URLs extracted from description/details
 *   5. Related Alerts     — alerts fired by this event
 *   6. Recommended Response — playbook steps keyed to event type
 */
import { useEffect, useMemo, useState } from "react";
import { getEvent } from "../api/api";

/* ── Constants ────────────────────────────────────────────── */

const EVENT_TYPE_COLORS = {
  ProcessCreate:        "#00d2ff",
  NetworkConnect:       "#a78bfa",
  RegistryEvent:        "#fbbf24",
  FileCreate:           "#22d3a0",
  CreateRemoteThread:   "#f43f5e",
  ProcessAccess:        "#fb923c",
  DriverLoaded:         "#e879f9",
  ImageLoaded:          "#818cf8",
  ProcessTerminated:    "#64748b",
  RawAccessRead:        "#f97316",
};
const etColor = (t) => EVENT_TYPE_COLORS[t] ?? "#7a9bbf";

const MITRE_MAP = {
  T1059: "Command & Scripting Interpreter",
  T1003: "OS Credential Dumping",
  T1021: "Remote Services",
  T1047: "WMI Execution",
  T1071: "Application Layer Protocol",
  T1112: "Modify Registry",
  T1078: "Valid Accounts",
  T1110: "Brute Force",
  T1566: "Phishing",
  T1055: "Process Injection",
  T1036: "Masquerading",
  T1070: "Indicator Removal",
  T1082: "System Information Discovery",
  T1057: "Process Discovery",
  T1083: "File & Directory Discovery",
};

/** Map event types to likely MITRE techniques when no rule tag exists */
const EVENT_TYPE_MITRE = {
  ProcessCreate:      ["T1059"],
  NetworkConnect:     ["T1071"],
  RegistryEvent:      ["T1112"],
  FileCreate:         ["T1036"],
  CreateRemoteThread: ["T1055"],
  ProcessAccess:      ["T1055"],
  DriverLoaded:       ["T1059"],
  ImageLoaded:        ["T1036"],
};

/** Response playbooks keyed to event type */
const PLAYBOOKS = {
  ProcessCreate: [
    "Verify the process parent/child relationship is expected.",
    "Check if the command line arguments contain encoded payloads (-enc, base64).",
    "Confirm the image path is inside a trusted directory (System32, Program Files).",
    "Review the signing status of the executable.",
    "If suspicious, isolate the endpoint and capture a memory dump.",
  ],
  NetworkConnect: [
    "Resolve the destination IP to check reputation (VirusTotal, Shodan).",
    "Confirm the connecting process is expected to make outbound connections.",
    "Review the destination port — unusual high ports may indicate C2.",
    "Check for beaconing patterns (regular intervals) in the timeline.",
    "Block the IP at the perimeter firewall if confirmed malicious.",
  ],
  CreateRemoteThread: [
    "This is a high-confidence process injection indicator.",
    "Identify both source and target processes.",
    "Capture a memory dump of the target process immediately.",
    "Isolate the endpoint — lateral movement may already be in progress.",
    "Preserve forensic artifacts before remediation.",
  ],
  RegistryEvent: [
    "Check if the modified key is used for persistence (Run, RunOnce, Services).",
    "Compare the new value against a known-good baseline.",
    "Identify which process made the change.",
    "Review other events from the same host in the same time window.",
  ],
  FileCreate: [
    "Check the file path — temp/appdata directories are high-risk.",
    "Look up the file hash in threat intelligence feeds.",
    "Review the creating process for legitimacy.",
    "Scan the file with an AV engine before execution.",
  ],
  ProcessAccess: [
    "Determine which process is accessing which — LSASS access indicates credential dumping.",
    "Correlate with T1003 indicators.",
    "Check if the access mask includes read memory (0x10) permissions.",
    "If LSASS targeted, assume credential compromise and reset affected accounts.",
  ],
  _default: [
    "Review full event context — computer name, user, and timestamp.",
    "Correlate with other events from the same host in a ±5 minute window.",
    "Check for related alerts in the Alerts dashboard.",
    "Escalate if the event pattern repeats across multiple hosts.",
  ],
};

/* ── Helpers ──────────────────────────────────────────────── */

function fmtTs(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

function extractIocs(text = "", details = {}) {
  const corpus = text + " " + JSON.stringify(details);
  return {
    ips:     [...new Set((corpus.match(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g) || []))],
    hashes:  [...new Set((corpus.match(/\b[a-fA-F0-9]{32,64}\b/g) || []).map((h) => h.toLowerCase()))],
    domains: [...new Set((corpus.match(/\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/g) || [])
                .filter((d) => !d.match(/^\d+\.\d+/) && d.includes("."))
                .map((d) => d.toLowerCase()))],
    urls:    [...new Set((corpus.match(/https?:\/\/[^\s"'<>\]]+/gi) || []).map((u) => u.replace(/[),.;]+$/, "")))],
  };
}

function extractProcessDetails(event) {
  const d = event.details || {};
  const desc = event.description || "";

  // Try to pull structured fields from details first, then fall back to parsing description
  const fields = {};

  const tryDetail = (...keys) => {
    for (const k of keys) {
      if (d[k]) return d[k];
    }
    return null;
  };

  fields.image       = tryDetail("Image", "image", "ProcessName", "process_name");
  fields.cmdLine     = tryDetail("CommandLine", "command_line", "cmdLine");
  fields.parentImage = tryDetail("ParentImage", "parent_image", "ParentProcessName");
  fields.pid         = tryDetail("ProcessId", "pid", "ProcessID");
  fields.parentPid   = tryDetail("ParentProcessId", "parent_pid");
  fields.hash        = tryDetail("Hashes", "hash", "Hash", "md5", "sha256");
  fields.targetFile  = tryDetail("TargetFilename", "target_file", "FileName");
  fields.regKey      = tryDetail("TargetObject", "registry_key", "RegistryKey");
  fields.destIP      = tryDetail("DestinationIp", "dest_ip", "DestIP");
  fields.destPort    = tryDetail("DestinationPort", "dest_port", "DestPort");
  fields.destHost    = tryDetail("DestinationHostname", "dest_hostname");

  // Fall back: parse description lines that look like key: value
  if (!fields.image && desc) {
    const imgMatch = desc.match(/(?:Image|Process):\s*([^\n\r,]+)/i);
    if (imgMatch) fields.image = imgMatch[1].trim();
    const cmdMatch = desc.match(/CommandLine:\s*([^\n\r]+)/i);
    if (cmdMatch) fields.cmdLine = cmdMatch[1].trim();
  }

  return fields;
}

/* ── Sub-components ───────────────────────────────────────── */

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <line x1="18" y1="6"  x2="6"  y2="18" />
    <line x1="6"  y1="6"  x2="18" y2="18" />
  </svg>
);

const Section = ({ title, icon, children, accent }) => (
  <div className="eid-section" style={accent ? { "--eid-accent": accent } : {}}>
    <div className="eid-section-header">
      {icon && <span className="eid-section-icon">{icon}</span>}
      <span className="eid-section-title">{title}</span>
    </div>
    <div className="eid-section-body">{children}</div>
  </div>
);

const Field = ({ label, value, mono = false, full = false }) => (
  <div className={`eid-field${full ? " eid-field-full" : ""}`}>
    <span className="eid-field-label">{label}</span>
    <span className={`eid-field-value${mono ? " eid-mono" : ""}`}>{value || "—"}</span>
  </div>
);

const IocPill = ({ value, color }) => (
  <span className="eid-ioc-pill" style={{ color, borderColor: `${color}40` }}>{value}</span>
);

/* ── Main component ───────────────────────────────────────── */

function EventInvestigationDrawer({ eventSummary, onClose }) {
  const [event,   setEvent]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* Fetch full event on open */
  useEffect(() => {
    if (!eventSummary) return;
    setLoading(true);
    setError(null);
    setEvent(null);

    getEvent(eventSummary.id)
      .then(setEvent)
      .catch((e) => setError(e.message ?? "Failed to load event"))
      .finally(() => setLoading(false));
  }, [eventSummary?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Close on Escape */
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  /* Derived data */
  const iocs = useMemo(() => {
    if (!event) return { ips: [], hashes: [], domains: [], urls: [] };
    return extractIocs(event.description || "", event.details || {});
  }, [event]);

  const procDetails = useMemo(() => {
    if (!event) return {};
    return extractProcessDetails(event);
  }, [event]);

  const mitreTechniques = useMemo(() => {
    if (!event) return [];
    // Collect technique IDs from alert rule tags
    const fromAlerts = new Set();
    for (const alert of (event.alerts || [])) {
      for (const tag of (alert.rule_tags || [])) {
        const t = String(tag).toUpperCase();
        if (/^T\d{4}$/.test(t)) fromAlerts.add(t);
      }
    }
    // Fall back to event-type mapping
    if (fromAlerts.size === 0) {
      (EVENT_TYPE_MITRE[event.event_type] || []).forEach((id) => fromAlerts.add(id));
    }
    return [...fromAlerts].map((id) => ({ id, name: MITRE_MAP[id] ?? "Unknown Technique" }));
  }, [event]);

  const playbook = useMemo(() => {
    if (!event) return [];
    return PLAYBOOKS[event.event_type] ?? PLAYBOOKS._default;
  }, [event]);

  const topAlert = event?.alerts?.[0] ?? null;
  const severity = topAlert?.severity ?? null;

  if (!eventSummary) return null;

  return (
    <div className="eid-backdrop" onClick={onClose} role="presentation">
      <aside
        className="eid-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Event Investigation"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="eid-header">
          <div className="eid-header-left">
            <div className="eid-header-meta">
              <span
                className="eid-type-pill"
                style={{
                  color: etColor(eventSummary.event_type),
                  borderColor: `${etColor(eventSummary.event_type)}50`,
                  background: `${etColor(eventSummary.event_type)}12`,
                }}
              >
                {eventSummary.event_type ?? "Unknown"}
              </span>
              {severity && (
                <span className={`sev-badge sev-${severity}`}>{severity}</span>
              )}
            </div>
            <div className="eid-header-title">Incident Investigation</div>
            <div className="eid-header-sub">
              {eventSummary.computer_name ?? "Unknown host"} · {fmtTs(eventSummary.timestamp)}
            </div>
          </div>
          <button className="eid-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="eid-body">

          {loading && (
            <div className="eid-loading">
              <span className="le-spinner" />
              <span>Loading event details…</span>
            </div>
          )}

          {error && (
            <div className="panel-error" style={{ margin: "16px 0" }}>⚠ {error}</div>
          )}

          {event && (
            <>
              {/* ── 1. Event Details ── */}
              <Section title="Event Details" accent={etColor(event.event_type)}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                }>
                <div className="eid-grid">
                  <Field label="Event ID (DB)"   value={event.id} />
                  <Field label="Sysmon Event ID" value={event.event_id} />
                  <Field label="Event Type"
                    value={<span style={{ color: etColor(event.event_type) }}>{event.event_type}</span>} />
                  <Field label="Timestamp"       value={fmtTs(event.timestamp)} />
                  <Field label="Computer"        value={event.computer_name} mono />
                  <Field label="User"            value={event.user} mono />
                  <Field label="Description"     value={event.description} mono full />
                </div>
              </Section>

              {/* ── 2. Process / Network Details ── */}
              {Object.values(procDetails).some(Boolean) && (
                <Section title="Process Details" accent="#00d2ff"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  }>
                  <div className="eid-grid">
                    {procDetails.image       && <Field label="Image"          value={procDetails.image}       mono full />}
                    {procDetails.cmdLine     && <Field label="Command Line"   value={procDetails.cmdLine}     mono full />}
                    {procDetails.parentImage && <Field label="Parent Image"   value={procDetails.parentImage} mono full />}
                    {procDetails.pid         && <Field label="PID"            value={procDetails.pid}         mono />}
                    {procDetails.parentPid   && <Field label="Parent PID"     value={procDetails.parentPid}   mono />}
                    {procDetails.hash        && <Field label="Hash"           value={procDetails.hash}        mono full />}
                    {procDetails.targetFile  && <Field label="Target File"    value={procDetails.targetFile}  mono full />}
                    {procDetails.regKey      && <Field label="Registry Key"   value={procDetails.regKey}      mono full />}
                    {procDetails.destIP      && <Field label="Dest IP"        value={procDetails.destIP}      mono />}
                    {procDetails.destPort    && <Field label="Dest Port"      value={procDetails.destPort}    mono />}
                    {procDetails.destHost    && <Field label="Dest Host"      value={procDetails.destHost}    mono />}
                  </div>
                  {/* Raw payload */}
                  {event.details && Object.keys(event.details).length > 0 && (
                    <details className="eid-raw">
                      <summary className="eid-raw-summary">Raw payload</summary>
                      <pre className="eid-raw-json">{JSON.stringify(event.details, null, 2)}</pre>
                    </details>
                  )}
                </Section>
              )}

              {/* ── 3. MITRE ATT&CK ── */}
              <Section title="MITRE ATT&CK Mapping" accent="#a78bfa"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                }>
                {mitreTechniques.length > 0 ? (
                  <div className="eid-mitre-list">
                    {mitreTechniques.map((t) => (
                      <div className="eid-mitre-item" key={t.id}>
                        <span className="eid-mitre-id">{t.id}</span>
                        <span className="eid-mitre-name">{t.name}</span>
                        <a
                          className="eid-mitre-link"
                          href={`https://attack.mitre.org/techniques/${t.id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={`View ${t.id} on MITRE ATT&CK`}
                        >↗</a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="eid-empty">// No MITRE techniques mapped for this event type</div>
                )}
              </Section>

              {/* ── 4. IOC Information ── */}
              <Section title="IOC Information" accent="#fbbf24"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                }>
                {Object.values(iocs).every((v) => v.length === 0) ? (
                  <div className="eid-empty">// No IOCs extracted from this event</div>
                ) : (
                  <div className="eid-ioc-grid">
                    {[
                      { key: "ips",     label: "IP Addresses", color: "#f43f5e" },
                      { key: "hashes",  label: "File Hashes",  color: "#fb923c" },
                      { key: "domains", label: "Domains",      color: "#fbbf24" },
                      { key: "urls",    label: "URLs",         color: "#a78bfa" },
                    ].map(({ key, label, color }) => (
                      <div className="eid-ioc-card" key={key}>
                        <div className="eid-ioc-label" style={{ color }}>{label}</div>
                        {iocs[key].length === 0 ? (
                          <span className="eid-empty" style={{ fontSize: 10 }}>// none</span>
                        ) : (
                          <div className="eid-ioc-pills">
                            {iocs[key].slice(0, 6).map((v) => (
                              <IocPill key={v} value={v} color={color} />
                            ))}
                            {iocs[key].length > 6 && (
                              <span className="eid-ioc-more">+{iocs[key].length - 6} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* ── 5. Related Alerts ── */}
              <Section
                title={`Related Alerts (${event.alerts?.length ?? 0})`}
                accent="#f43f5e"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                }>
                {!event.alerts?.length ? (
                  <div className="eid-empty">// No alerts fired for this event</div>
                ) : (
                  <div className="eid-alerts-list">
                    {event.alerts.map((a) => (
                      <div className="eid-alert-row" key={a.id}>
                        <div className="eid-alert-left">
                          <span className={`sev-badge sev-${a.severity}`}>{a.severity}</span>
                          <div className="eid-alert-info">
                            <span className="eid-alert-title">{a.title}</span>
                            {a.rule_name && (
                              <span className="eid-alert-rule">Rule: {a.rule_name}</span>
                            )}
                          </div>
                        </div>
                        <div className="eid-alert-right">
                          <span className={`status-pill status-${a.status}`}>{a.status}</span>
                          <span className="time-mono" style={{ fontSize: 10 }}>
                            {fmtTs(a.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* ── 6. Recommended Response ── */}
              <Section title="Recommended Response" accent="#22d3a0"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                }>
                <ol className="eid-playbook">
                  {playbook.map((step, i) => (
                    <li key={i} className="eid-playbook-step">
                      <span className="eid-step-num">{i + 1}</span>
                      <span className="eid-step-text">{step}</span>
                    </li>
                  ))}
                </ol>
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export default EventInvestigationDrawer;
