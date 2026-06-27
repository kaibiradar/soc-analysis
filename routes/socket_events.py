"""
Flask-SocketIO event handlers + broadcast helpers.

Broadcast functions are called from routes/api.py after DB writes.
They emit to the 'soc' room so clients can opt-in/out.
"""
import logging
from datetime import datetime, timezone

from flask import Blueprint, request
from flask_socketio import emit, join_room, leave_room

from socketio_instance import socketio

socket_bp = Blueprint("socket_events", __name__)
logger    = logging.getLogger(__name__)

SOC_ROOM = "soc"   # all dashboard clients join this room


# ── Connection lifecycle ──────────────────────────────────────────────────────

@socketio.on("connect")
def on_connect():
    sid = request.sid
    join_room(SOC_ROOM)
    logger.info(f"Client connected: {sid}")
    emit("connected", {"sid": sid, "room": SOC_ROOM})


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    logger.info(f"Client disconnected: {sid}")


@socketio.on("join")
def on_join(data):
    room = data.get("room", SOC_ROOM)
    join_room(room)
    emit("joined", {"room": room})


@socketio.on("leave")
def on_leave(data):
    room = data.get("room", SOC_ROOM)
    leave_room(room)


# ── Broadcast helpers (called from api.py) ───────────────────────────────────

def broadcast_new_alert(alert_data: dict) -> None:
    """Push a new alert to every connected dashboard client."""
    socketio.emit("new_alert", alert_data, room=SOC_ROOM)
    logger.debug(f"Broadcast new_alert id={alert_data.get('id')}")


def broadcast_alert_updated(alert_data: dict) -> None:
    """Push an alert status change to every connected dashboard client."""
    socketio.emit("alert_updated", alert_data, room=SOC_ROOM)


def broadcast_new_event(event_data: dict) -> None:
    """Push a new raw event to every connected dashboard client."""
    socketio.emit("new_event", event_data, room=SOC_ROOM)


def broadcast_stats(stats_data: dict) -> None:
    """Push refreshed aggregate stats."""
    socketio.emit("stats_update", stats_data, room=SOC_ROOM)


def broadcast_timeline(timeline_data: dict) -> None:
    """Push refreshed timeline data."""
    socketio.emit("timeline_update", timeline_data, room=SOC_ROOM)
