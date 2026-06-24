import logging
import queue
import threading
import json
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, Response, stream_with_context
from sqlalchemy import func
from database.db import db, Event, Alert, Rule
from detection.rules import RuleEngine
from validators import (
    CreateEventSchema, CreateRuleSchema, UpdateRuleSchema,
    UpdateAlertSchema, validate_body,
)

api_bp    = Blueprint("api", __name__)
logger    = logging.getLogger(__name__)
rule_engine = RuleEngine()

# ── SSE broadcast bus ─────────────────────────────────────────────────────────
# Each connected client gets its own queue added here.
_sse_clients: list[queue.Queue] = []
_sse_lock = threading.Lock()


def _broadcast(event_type: str, data: dict) -> None:
    """Push an SSE event to every connected client."""
    payload = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    with _sse_lock:
        dead = []
        for q in _sse_clients:
            try:
                q.put_nowait(payload)
            except queue.Full:
                dead.append(q)
        for q in dead:
            _sse_clients.remove(q)


# ── SSE endpoint ─────────────────────────────────────────────────────────────

@api_bp.route("/stream")
def stream():
    """
    Server-Sent Events stream.
    Clients connect once and receive push updates for:
      - new_alert   → whenever an alert is created
      - stats       → every 30 s heartbeat with fresh counts
    """
    client_q: queue.Queue = queue.Queue(maxsize=50)
    with _sse_lock:
        _sse_clients.append(client_q)

    def generate():
        # Send an immediate stats snapshot so the client isn't blank
        try:
            with api_bp.app.app_context() if hasattr(api_bp, "app") else _noop():
                pass
        except Exception:
            pass

        yield ": connected\n\n"   # SSE comment keeps connection alive

        try:
            while True:
                try:
                    msg = client_q.get(timeout=30)
                    yield msg
                except queue.Empty:
                    # heartbeat — send current stats
                    try:
                        stats = _get_stats_data()
                        yield f"event: stats\ndata: {json.dumps(stats)}\n\n"
                    except Exception:
                        yield ": heartbeat\n\n"
        except GeneratorExit:
            pass
        finally:
            with _sse_lock:
                if client_q in _sse_clients:
                    _sse_clients.remove(client_q)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":       "keep-alive",
        },
    )


class _noop:
    """No-op context manager."""
    def __enter__(self): return self
    def __exit__(self, *_): pass


# ── EVENTS ───────────────────────────────────────────────────────────────────

@api_bp.route("/events", methods=["GET"])
def get_events():
    page     = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)

    events = (
        Event.query
        .order_by(Event.timestamp.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        "total":        events.total,
        "pages":        events.pages,
        "current_page": page,
        "per_page":     per_page,
        "events": [
            {
                "id":            e.id,
                "event_id":      e.event_id,
                "computer_name": e.computer_name,
                "user":          e.user,
                "event_type":    e.event_type,
                "timestamp":     e.timestamp.isoformat(),
                "description":   e.description,
            }
            for e in events.items
        ],
    })


@api_bp.route("/events/<int:event_id>", methods=["GET"])
def get_event(event_id):
    event = db.get_or_404(Event, event_id)
    return jsonify({
        "id":            event.id,
        "event_id":      event.event_id,
        "computer_name": event.computer_name,
        "user":          event.user,
        "event_type":    event.event_type,
        "timestamp":     event.timestamp.isoformat(),
        "description":   event.description,
        "details":       event.details,
        "created_at":    event.created_at.isoformat(),
    })


@api_bp.route("/events", methods=["POST"])
def create_event():
    data, err = validate_body(CreateEventSchema, request.get_json(silent=True))
    if err:
        return jsonify({"error": "Validation failed", "details": err}), 422

    try:
        event = Event(**data)
        db.session.add(event)
        db.session.commit()
        new_alerts = _check_event_against_rules(event)
        logger.info(f"Event {event.id} created, {len(new_alerts)} alerts fired")
        return jsonify({"id": event.id, "status": "created", "alerts_fired": len(new_alerts)}), 201
    except Exception as exc:
        db.session.rollback()
        logger.exception("Error creating event")
        return jsonify({"error": str(exc)}), 400


# ── ALERTS ───────────────────────────────────────────────────────────────────

@api_bp.route("/alerts", methods=["GET"])
def get_alerts():
    page      = request.args.get("page", 1, type=int)
    per_page  = min(request.args.get("per_page", 20, type=int), 100)
    status    = request.args.get("status")
    severity  = request.args.get("severity")
    search    = request.args.get("search", "").strip()

    query = Alert.query

    if status:
        query = query.filter_by(status=status)
    if severity:
        query = query.filter_by(severity=severity)
    if search:
        query = query.filter(Alert.title.ilike(f"%{search}%"))

    alerts = query.order_by(Alert.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "total":        alerts.total,
        "pages":        alerts.pages,
        "current_page": page,
        "per_page":     per_page,
        "alerts": [
            {
                "id":         a.id,
                "title":      a.title,
                "severity":   a.severity,
                "status":     a.status,
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts.items
        ],
    })


@api_bp.route("/alerts/<int:alert_id>", methods=["GET"])
def get_alert(alert_id):
    alert = db.get_or_404(Alert, alert_id)
    return jsonify({
        "id":          alert.id,
        "title":       alert.title,
        "description": alert.description,
        "severity":    alert.severity,
        "status":      alert.status,
        "assigned_to": alert.assigned_to,
        "notes":       alert.notes,
        "created_at":  alert.created_at.isoformat(),
        "updated_at":  alert.updated_at.isoformat(),
    })


@api_bp.route("/alerts/<int:alert_id>", methods=["PUT"])
def update_alert(alert_id):
    alert = db.get_or_404(Alert, alert_id)
    data, err = validate_body(UpdateAlertSchema, request.get_json(silent=True))
    if err:
        return jsonify({"error": "Validation failed", "details": err}), 422

    if "status" in data:
        alert.status = data["status"]
    if "notes" in data:
        alert.notes = data["notes"]
    if "assigned_to" in data:
        alert.assigned_to = data["assigned_to"]

    db.session.commit()
    logger.info(f"Alert {alert_id} updated: {data}")

    # Push real-time update to all SSE clients
    _broadcast("alert_updated", {
        "id":       alert.id,
        "status":   alert.status,
        "severity": alert.severity,
        "title":    alert.title,
    })

    return jsonify({"id": alert.id, "status": "updated"})


# ── RULES ─────────────────────────────────────────────────────────────────────

@api_bp.route("/rules", methods=["GET"])
def get_rules():
    page         = request.args.get("page", 1, type=int)
    per_page     = min(request.args.get("per_page", 20, type=int), 100)
    enabled_only = request.args.get("enabled_only", "false").lower() == "true"

    query = Rule.query
    if enabled_only:
        query = query.filter_by(enabled=True)

    rules = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "total": rules.total,
        "rules": [
            {
                "id":       r.id,
                "name":     r.name,
                "severity": r.severity,
                "enabled":  r.enabled,
                "tags":     r.tags,
            }
            for r in rules.items
        ],
    })


@api_bp.route("/rules", methods=["POST"])
def create_rule():
    data, err = validate_body(CreateRuleSchema, request.get_json(silent=True))
    if err:
        return jsonify({"error": "Validation failed", "details": err}), 422

    try:
        rule = Rule(**data)
        db.session.add(rule)
        db.session.commit()
        logger.info(f"Rule '{rule.name}' created (id={rule.id})")
        return jsonify({"id": rule.id, "status": "created"}), 201
    except Exception as exc:
        db.session.rollback()
        logger.exception("Error creating rule")
        return jsonify({"error": str(exc)}), 400


@api_bp.route("/rules/<int:rule_id>", methods=["PUT"])
def update_rule(rule_id):
    rule = db.get_or_404(Rule, rule_id)
    data, err = validate_body(UpdateRuleSchema, request.get_json(silent=True))
    if err:
        return jsonify({"error": "Validation failed", "details": err}), 422

    for field, val in data.items():
        setattr(rule, field, val)

    db.session.commit()
    logger.info(f"Rule {rule_id} updated")
    return jsonify({"id": rule.id, "status": "updated"})


@api_bp.route("/rules/<int:rule_id>", methods=["DELETE"])
def delete_rule(rule_id):
    rule = db.get_or_404(Rule, rule_id)
    db.session.delete(rule)
    db.session.commit()
    logger.info(f"Rule {rule_id} deleted")
    return jsonify({"status": "deleted"})


# ── STATISTICS ────────────────────────────────────────────────────────────────

def _get_stats_data() -> dict:
    total_events = Event.query.count()
    total_alerts = Alert.query.count()
    new_alerts   = Alert.query.filter_by(status="NEW").count()

    severity_counts = (
        db.session.query(Alert.severity, func.count(Alert.id))
        .group_by(Alert.severity)
        .all()
    )
    severity_distribution = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for sev, cnt in severity_counts:
        severity_distribution[sev] = cnt

    return {
        "total_events":          total_events,
        "total_alerts":          total_alerts,
        "new_alerts":            new_alerts,
        "severity_distribution": severity_distribution,
    }


@api_bp.route("/stats", methods=["GET"])
def get_statistics():
    return jsonify(_get_stats_data())


# ── MITRE ATT&CK ─────────────────────────────────────────────────────────────

MITRE_MAP = {
    "T1059": "Command & Scripting Interpreter",
    "T1003": "OS Credential Dumping",
    "T1021": "Remote Services",
    "T1047": "WMI Execution",
    "T1071": "Application Layer Protocol",
    "T1112": "Modify Registry",
    "T1078": "Valid Accounts",
    "T1110": "Brute Force",
    "T1566": "Phishing",
}


@api_bp.route("/mitre", methods=["GET"])
def get_mitre():
    rules = Rule.query.filter_by(enabled=True).all()
    seen: dict[str, str] = {}
    for rule in rules:
        for tag in (rule.tags or []):
            t = tag.upper()
            if t.startswith("T") and t in MITRE_MAP and t not in seen:
                seen[t] = MITRE_MAP[t]

    if not seen:
        seen = {
            "T1059": "Command & Scripting Interpreter",
            "T1003": "OS Credential Dumping",
            "T1047": "WMI Execution",
            "T1071": "Application Layer Protocol",
            "T1112": "Modify Registry",
        }

    return jsonify({"techniques": [{"id": k, "name": v} for k, v in seen.items()]})


# ── EVENTS TIMELINE ───────────────────────────────────────────────────────────

@api_bp.route("/events_timeline", methods=["GET"])
def get_events_timeline():
    """Event counts in 10-minute buckets over the last hour."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    buckets = []

    for i in range(5, -1, -1):
        start = now - timedelta(minutes=(i + 1) * 10)
        end   = now - timedelta(minutes=i * 10)
        count = Event.query.filter(
            Event.timestamp >= start,
            Event.timestamp <  end,
        ).count()
        buckets.append((start.strftime("%H:%M"), count))

    return jsonify({
        "labels": [b[0] for b in buckets],
        "values": [b[1] for b in buckets],
    })


# ── HELPER ────────────────────────────────────────────────────────────────────

def _check_event_against_rules(event: Event) -> list[Alert]:
    """Match an event against all enabled rules and persist alerts."""
    rules = Rule.query.filter_by(enabled=True).all()
    event_data = {
        "event_type":    event.event_type,
        "computer_name": event.computer_name,
        "user":          event.user,
        "description":   event.description,
        "details":       event.details or {},
    }

    created: list[Alert] = []
    for rule in rules:
        matched, message = rule_engine.match_rule(event_data, {
            "event_type": rule.event_type,
            "conditions": rule.conditions,
            "enabled":    rule.enabled,
        })
        if matched:
            alert = Alert(
                event_id=event.id,
                rule_id=rule.id,
                severity=rule.severity,
                title=rule.name,
                description=message,
                status="NEW",
            )
            db.session.add(alert)
            created.append(alert)

    db.session.commit()

    # Broadcast each new alert via SSE
    for alert in created:
        _broadcast("new_alert", {
            "id":       alert.id,
            "title":    alert.title,
            "severity": alert.severity,
            "status":   alert.status,
        })

    return created
