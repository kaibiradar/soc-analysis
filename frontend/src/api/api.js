// All /api/* requests are proxied to http://127.0.0.1:5000 by Vite.

const handle = async (res) => {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API error");
  }
  return res.json();
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

export const getEvent = (id) =>
  fetch(`/api/events/${id}`).then(handle);

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
