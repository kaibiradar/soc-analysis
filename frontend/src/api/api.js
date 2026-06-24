// All /api/* requests are proxied to http://127.0.0.1:5000 by Vite.
// Use relative URLs so this also works in production builds.

export async function getStats() {
  const response = await fetch("/api/stats");
  return response.json();
}

export async function getTimeline() {
  const response = await fetch("/api/events_timeline");
  return response.json();
}

export async function getMitre() {
  const response = await fetch("/api/mitre");
  return response.json();
}

export async function getAlerts() {
  const response = await fetch("/api/alerts?per_page=10");
  return response.json();
}
