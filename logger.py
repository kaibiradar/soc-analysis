"""
Structured logging setup for SOC Analysis Platform.
Outputs JSON-formatted logs to both console and rotating file.
"""
import logging
import logging.handlers
import json
import os
import sys
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Emit each log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        log = {
            "ts":      datetime.now(timezone.utc).isoformat(),
            "level":   record.levelname,
            "logger":  record.name,
            "msg":     record.getMessage(),
            "module":  record.module,
            "line":    record.lineno,
        }
        if record.exc_info:
            log["exc"] = self.formatException(record.exc_info)
        return json.dumps(log)


def setup_logging(log_level: str = "INFO", log_file: str = "soc.log") -> None:
    """
    Configure root logger with:
      - JSON console handler (stdout)
      - Rotating file handler  (soc.log, 5 MB × 3 backups)
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    root = logging.getLogger()
    root.setLevel(level)

    # Remove any handlers already attached (e.g. from basicConfig)
    root.handlers.clear()

    # ── Console ──────────────────────────────────────────────
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(JSONFormatter())
    console.setLevel(level)
    root.addHandler(console)

    # ── Rotating file ─────────────────────────────────────────
    log_dir = os.path.dirname(log_file) or "."
    os.makedirs(log_dir, exist_ok=True)

    fh = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=5 * 1024 * 1024,  # 5 MB
        backupCount=3,
        encoding="utf-8",
    )
    fh.setFormatter(JSONFormatter())
    fh.setLevel(level)
    root.addHandler(fh)

    # Silence noisy third-party loggers
    for noisy in ("werkzeug", "sqlalchemy.engine", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
