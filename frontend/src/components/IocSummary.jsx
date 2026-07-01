import { useEffect, useMemo, useState } from "react";
import { getEvent, getEvents } from "../api/api";

const IocIcon = () => (
  <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>
);

const IOC_PATTERNS = {
  ips: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  hashes: /\b[a-fA-F0-9]{32,64}\b/g,
  urls: /\bhttps?:\/\/[^\s"'<>\]]+/gi,
  domains: /\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/g,
};

const IP_TEST = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/;

const IOC_LABELS = {
  ips: "IPs",
  hashes: "Hashes",
  domains: "Domains",
  urls: "URLs",
};

function collectText(value, lines = []) {
  if (value === null || value === undefined) {
    return lines;
  }

  if (typeof value === "string") {
    lines.push(value);
    return lines;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    lines.push(String(value));
    return lines;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, lines));
    return lines;
  }

  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectText(item, lines));
  }

  return lines;
}

function extractFromText(text, bucket) {
  const normalized = text || "";

  for (const match of normalized.match(IOC_PATTERNS.ips) || []) {
    bucket.ips.set(match, (bucket.ips.get(match) || 0) + 1);
  }

  for (const match of normalized.match(IOC_PATTERNS.hashes) || []) {
    bucket.hashes.set(match.toLowerCase(), (bucket.hashes.get(match.toLowerCase()) || 0) + 1);
  }

  for (const match of normalized.match(IOC_PATTERNS.urls) || []) {
    const clean = match.replace(/[),.;]+$/, "");
    bucket.urls.set(clean, (bucket.urls.get(clean) || 0) + 1);

    try {
      const parsed = new URL(clean);
      const host = parsed.hostname.toLowerCase();
      if (!IP_TEST.test(host)) {
        bucket.domains.set(host, (bucket.domains.get(host) || 0) + 1);
      }
    } catch {
      // Ignore malformed URLs.
    }
  }

  for (const match of normalized.match(IOC_PATTERNS.domains) || []) {
    const value = match.toLowerCase();
    if (value.startsWith("http") || IP_TEST.test(value)) continue;
    bucket.domains.set(value, (bucket.domains.get(value) || 0) + 1);
  }
}

function toTopEntries(map, limit = 6) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function IocSummary() {
  const [iocBucket, setIocBucket] = useState({
    ips: new Map(),
    hashes: new Map(),
    domains: new Map(),
    urls: new Map(),
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadIocs = async () => {
      try {
        const summary = await getEvents({ perPage: 100 });
        const details = await Promise.all(
          (summary.events || []).map((event) => getEvent(event.id))
        );

        if (cancelled) return;

        const nextBucket = {
          ips: new Map(),
          hashes: new Map(),
          domains: new Map(),
          urls: new Map(),
        };

        details.filter(Boolean).forEach((entry) => {
          const fragments = collectText(entry, []);
          extractFromText(fragments.join(" \n "), nextBucket);
        });

        setIocBucket(nextBucket);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    };

    void loadIocs();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => ({
    ips: toTopEntries(iocBucket.ips),
    hashes: toTopEntries(iocBucket.hashes),
    domains: toTopEntries(iocBucket.domains),
    urls: toTopEntries(iocBucket.urls),
  }), [iocBucket]);

  const totalUnique = summary.ips.length + summary.hashes.length + summary.domains.length + summary.urls.length;

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><IocIcon />IOC Summary</div>
        <span className="panel-badge">{totalUnique} items</span>
      </div>

      {error ? (
        <div className="panel-error">⚠ {error}</div>
      ) : (
        <div className="ioc-grid">
          {Object.entries(summary).map(([key, items]) => (
            <section className="ioc-card" key={key}>
              <div className="ioc-card-head">
                <div className="ioc-card-title">{IOC_LABELS[key]}</div>
                <span className="ioc-card-count">{iocBucket[key].size}</span>
              </div>

              {items.length > 0 ? (
                <div className="ioc-list">
                  {items.map((item) => (
                    <div className="ioc-item" key={item.value}>
                      <span className="ioc-value">{item.value}</span>
                      <span className="ioc-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ioc-empty">// no {IOC_LABELS[key].toLowerCase()} observed</p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default IocSummary;