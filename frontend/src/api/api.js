// All /api/* requests are proxied to http://127.0.0.1:5000 by Vite.

const handle = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API error");
  }
  return res.json();
};

/**
 * Normalize a single process entry (used for both the primary process and
 * each item in child_process) into a guaranteed shape so components never
 * have to guard against missing keys.
 */
const normalizeProcess = (raw = {}) => ({
  process_name:    raw.process_name    ?? null,
  pid:             raw.pid             ?? null,
  ppid:            raw.ppid            ?? null,
  command_line:    raw.command_line    ?? null,
  process_path:    raw.process_path    ?? null, // optional
  integrity_level: raw.integrity_level ?? null, // optional
});

/**
 * Normalize the process_hierarchy payload from GET /api/events/:id into a
 * consistent shape for the frontend:
 *   { process_name, parent_process, child_process[], pid, ppid,
 *     command_line, process_path, integrity_level }
 *
 * Accepts either `process_hierarchy` (current) or `process_tree` (legacy key
 * some older backend responses may still use) — whichever is present.
 */
const normalizeProcessHierarchy = (raw) => {
  if (!raw) return null;

  const base = normalizeProcess(raw);
  const children = Array.isArray(raw.child_process)
    ? raw.child_process
    : Array.isArray(raw.child_processes) // legacy plural key fallback
      ? raw.child_processes
      : [];

  return {
    ...base,
    parent_process: raw.parent_process ?? null,
    child_process:  children.map(normalizeProcess),
  };
};

export const getStats = () =>
  fetch("/api/stats").then(handle);

export const getTimeline = () =>
  fetch("/api/events_timeline").then(handle);

export const getMitre = () =>
  fetch("/api/mitre").then(handle);

export const getEvents = ({ page = 1, perPage = 25, q = "", event_type = "", hostname = "", username = "", sort = "timestamp", direction = "desc" } = {}) => {
  const params = new URLSearchParams({ page, per_page: perPage, sort, direction });
  if (q)          params.set("q",          q);
  if (event_type) params.set("event_type", event_type);
  if (hostname)   params.set("hostname",   hostname);
  if (username)   params.set("username",   username);
  return fetch(`/api/events?${params}`).then(handle);
};

/**
 * Fetch a single event's full details, including related alerts and process
 * hierarchy. Reuses the existing GET /api/events/:id endpoint — no new
 * endpoints. The raw `process_hierarchy` / `process_tree` fields from the
 * API are preserved on the returned object, plus a normalized `process`
 * field for components to consume directly:
 *
 *   const { process } = await getEvent(id);
 *   process.process_name
 *   process.parent_process
 *   process.child_process   // array, normalized, always present
 *   process.pid
 *   process.ppid
 *   process.command_line
 *   process.process_path    // optional, may be null
 *   process.integrity_level // optional, may be null
 */
export const getEvent = (id) =>
  fetch(`/api/events/${id}`)
    .then(handle)
    .then((event) => ({
      ...event,
      process: normalizeProcessHierarchy(event.process_hierarchy ?? event.process_tree),
    }));

export const getAlert = (id) =>
  fetch(`/api/alerts/${id}`).then(handle);

export const getRules = ({ page = 1, perPage = 100, enabledOnly = false } = {}) => {
  const params = new URLSearchParams({ page, per_page: perPage });

  if (enabledOnly) {
    params.set("enabled_only", "true");
  }

  return fetch(`/api/rules?${params}`).then(handle);
};

export const getAlerts = ({ page = 1, perPage = 10, status = "", severity = "", search = "" } = {}) => {
  const params = new URLSearchParams({ page, per_page: perPage });
  if (status)   params.set("status", status);
  if (severity) params.set("severity", severity);
  if (search)   params.set("search", search);
  return fetch(`/api/alerts?${params}`).then(handle);
};

export const updateAlert = (id, body) =>
  fetch(`/api/alerts/${id}`, {
    method:  "PUT",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  }).then(handle);