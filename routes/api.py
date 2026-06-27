import logging
from datetime import datetime, timedelta, timezone

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from database.db import db, Event, Alert, Rule
from detection.rules import RuleEngine
from validators import (
    CreateEventSchema, CreateRuleSchema, UpdateRuleSchema,
    UpdateAlertSchema, validate_body,
)

api_bp      = Blueprint("api", __name__)
logger      = logging.getLogger(__name__)
rule_engine = RuleEngine()


def _broadcast(fn_name: str, *args, **kwargs):
    """
    Lazy import broadcast helpers to avoid circular imports at module load.
    If socketio isn't available (e.g. tests) this is a no-op.
    """
    try:
        from routes.socket_events import (
            broadcast_new_alert, broadcast_alert_updated,
            broadcast_new_event, broadcast_stats, broadcast_timeline,
        )
        fns = {
            "new_alert":       broadcast_new_alert,
            "alert_updated":   broadcast_alert_updated,
            "new_event":       broadcast_new_event,
            "stats":           broadcast_stats,
            "timeline":        broadcast_timeline,
        }
        if fn_name in fns:
            fns[fn_name](*args, **kwargs)
    except Exception as exc:
        logger.warning(f"Broadcast '{fn_name}' failed: {exc}")


# ── Stats helper ─────────────────────────────────────────────────────────────

def _stats_payload() -> dict:
    total_events = Event.query.count()
    total_alerts = Alert.query.count()
    new_alerts   = Alert.query.filter_by(status="NEW").count()

    rows = (
        db.session.query(Alert.severity, func.count(Alert.id))
        .group_by(Alert.severity).all()
    )
    sev = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for s, c in rows:
        sev[s] = c

    return {
        "total_events":          total_events,
        "total_alerts":          total_alerts,
        "new_alerts":            new_alerts,
        "severity_distribution": sev,
    }


def _timeline_payload() -> dict:
    now    = datetime.now(timezone.utc).replace(tzinfo=None)
    BUCKET = 30
    NUM    = 6
    buckets = []

    for i in range(NUM - 1, -1, -1):
        start = now - timedelta(minutes=(i + 1) * BUCKET)
        end   = now - timedelta(minutes=i * BUCKET)
        count = Event.query.filter(
            Event.timestamp >= start,
            Event.timestamp <  end,
        ).count()
        buckets.append((start.strftime("%H:%M"), count))

    if all(b[1] == 0 for b in buckets):
        oldest = db.session.query(func.min(Event.timestamp)).scalar()
        newest = db.session.query(func.max(Event.timestamp)).scalar()
        if oldest and newest and oldest != newest:
            span   = (newest - oldest).total_seconds()
            bsecs  = span / NUM
            buckets = []
            for i in range(NUM):
                s = oldest + timedelta(seconds=i * bsecs)
                e = oldest + timedelta(seconds=(i + 1) * bsecs)
                c = Event.query.filter(
                    Event.timestamp >= s, Event.timestamp < e
                ).count()
                buckets.append((s.strftime("%H:%M"), c))

    return {
        "labels": [b[0] for b in buckets],
        "values": [b[1] for b in buckets],
    }


# ── EVENTS ───────────────────────────────────────────────────────────────────

@api_bp.route("/events", methods=["GET"])
def get_events():
    page     = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    ev = (
        Event.query
        .order_by(Event.timestamp.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return jsonify({
        "total": ev.total, "pages": ev.pages,
        "current_page": page, "per_page": per_page,
        "events": [{
            "id": e.id, "event_id": e.event_id,
            "computer_name": e.computer_name, "user": e.user,
            "event_type": e.event_type,
            "timestamp": e.timestamp.isoformat(),
            "description": e.description,
        } for e in ev.items],
    })


@api_bp.route("/events/<int:event_id>", methods=["GET"])
def get_event(event_id):
    e = db.get_or_404(Event, event_id)
    return jsonify({
        "id": e.id, "event_id": e.event_id,
        "computer_name": e.computer_name, "user": e.user,
        "event_type": e.event_type, "timestamp": e.timestamp.isoformat(),
        "description": e.description, "details": e.details,
        "created_at": e.created_at.isoformat(),
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

        # ── broadcast raw event ───────────────────────────────
        _broadcast("new_event", {
            "id":            event.id,
            "event_type":    event.event_type,
            "computer_name": event.computer_name,
            "user":          event.user,
            "description":   (event.description or "")[:120],
            "timestamp":     event.timestamp.isoformat(),
        })

        new_alerts = _check_event_against_rules(event)
        logger.info(f"Event {event.id} created — {len(new_alerts)} alert(s)")

        # ── push refreshed stats + timeline ──────────────────
        _broadcast("stats",    _stats_payload())
        _broadcast("timeline", _timeline_payload())

        return jsonify({
            "id": event.id, "status": "created",
            "alerts_fired": len(new_alerts),
        }), 201

    except Exception as exc:
        db.session.rollback()
        logger.exception("Error creating event")
        return jsonify({"error": str(exc)}), 400


# ── ALERTS ───────────────────────────────────────────────────────────────────

@api_bp.route("/alerts", methods=["GET"])
def get_alerts():
    page     = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    status   = request.args.get("status")
    severity = request.args.get("severity")
    search   = request.args.get("search", "").strip()

    q = Alert.query
    if status:   q = q.filter_by(status=status)
    if severity: q = q.filter_by(severity=severity)
    if search:   q = q.filter(Alert.title.ilike(f"%{search}%"))

    alerts = q.order_by(Alert.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify({
        "total": alerts.total, "pages": alerts.pages,
        "current_page": page, "per_page": per_page,
        "alerts": [{
            "id": a.id, "title": a.title,
            "severity": a.severity, "status": a.status,
            "created_at": a.created_at.isoformat(),
        } for a in alerts.items],
    })


@api_bp.route("/alerts/<int:alert_id>", methods=["GET"])
def get_alert(alert_id):
    a = db.get_or_404(Alert, alert_id)
    return jsonify({
        "id": a.id, "title": a.title, "description": a.description,
        "severity": a.severity, "status": a.status,
        "assigned_to": a.assigned_to, "notes": a.notes,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    })


@api_bp.route("/alerts/<int:alert_id>", methods=["PUT"])
def update_alert(alert_id):
    alert = db.get_or_404(Alert, alert_id)
    data, err = validate_body(UpdateAlertSchema, request.get_json(silent=True))
    if err:
        return jsonify({"error": "Validation failed", "details": err}), 422

    for field, val in data.items():
        setattr(alert, field, val)
    db.session.commit()
    logger.info(f"Alert {alert_id} updated: {data}")

    _broadcast("alert_updated", {
        "id": alert.id, "title": alert.title,
        "severity": alert.severity, "status": alert.status,
    })
    _broadcast("stats", _stats_payload())

    return jsonify({"id": alert.id, "status": "updated"})


# ── RULES ─────────────────────────────────────────────────────────────────────

@api_bp.route("/rules", methods=["GET"])
def get_rules():
    page         = request.args.get("page", 1, type=int)
    per_page     = min(request.args.get("per_page", 20, type=int), 100)
    enabled_only = request.args.get("enabled_only", "false").lower() == "true"

    q = Rule.query
    if enabled_only:
        q = q.filter_by(enabled=True)
    rules = q.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "total": rules.total,
        "rules": [{
            "id": r.id, "name": r.name,
            "severity": r.severity, "enabled": r.enabled, "tags": r.tags,
        } for r in rules.items],
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
        return jsonify({"id": rule.id, "status": "created"}), 201
    except Exception as exc:
        db.session.rollback()
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
    return jsonify({"id": rule.id, "status": "updated"})


@api_bp.route("/rules/<int:rule_id>", methods=["DELETE"])
def delete_rule(rule_id):
    rule = db.get_or_404(Rule, rule_id)
    db.session.delete(rule)
    db.session.commit()
    return jsonify({"status": "deleted"})


# ── STATISTICS ────────────────────────────────────────────────────────────────

@api_bp.route("/stats", methods=["GET"])
def get_statistics():
    return jsonify(_stats_payload())


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


# ── TIMELINE ──────────────────────────────────────────────────────────────────

@api_bp.route("/events_timeline", methods=["GET"])
def get_events_timeline():
    return jsonify(_timeline_payload())


# ── RULE MATCHING ─────────────────────────────────────────────────────────────

def _check_event_against_rules(event: Event) -> list[Alert]:
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
                event_id=event.id, rule_id=rule.id,
                severity=rule.severity, title=rule.name,
                description=message, status="NEW",
            )
            db.session.add(alert)
            created.append(alert)

    db.session.commit()

    for alert in created:
        _broadcast("new_alert", {
            "id":         alert.id,
            "title":      alert.title,
            "severity":   alert.severity,
            "status":     alert.status,
            "created_at": alert.created_at.isoformat(),
        })

    return created
