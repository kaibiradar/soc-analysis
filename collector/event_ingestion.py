import time
import logging

from collector.sysmon_collector import SysmonCollector
from database.db import db, Event

from routes.socket_events import (
    broadcast_new_event,
    broadcast_stats,
    broadcast_timeline,
)

from routes.api import (
    _stats_payload,
    _timeline_payload,
)

collector = SysmonCollector()
logger = logging.getLogger(__name__)


def _event_payload(event):
    return {
        "id": event.id,
        "event_type": event.event_type,
        "computer_name": event.computer_name,
        "user": event.user,
        "description": event.description,
        "timestamp": event.timestamp.isoformat(),
    }


def start_event_ingestion(app):
    """Start the Sysmon ingestion loop once for a running Flask app."""
    if app.config.get("TESTING") or app.config.get("SYSMON_INGESTION_STARTED"):
        return

    app.config["SYSMON_INGESTION_STARTED"] = True
    from socketio_instance import socketio

    socketio.start_background_task(ingest_events, app)
    logger.info("Started Sysmon live event ingestion")


def ingest_events(app):
    logger.info("Starting Sysmon ingestion...")

    with app.app_context():

        while True:

            try:

                events = collector.collect_events(20)

                inserted_events = []

                for e in events:

                    exists = Event.query.filter_by(
                        event_id=e.get("event_id"),
                        description=e.get("description")
                    ).first()

                    if exists:
                        continue

                    event = Event(
                        event_id=e.get("event_id"),
                        computer_name=e.get("computer_name"),
                        user=e.get("user"),
                        event_type=e.get("event_type"),
                        timestamp=e.get("timestamp"),
                        description=e.get("description"),
                        details=e.get("details"),
                    )

                    db.session.add(event)
                    db.session.flush()

                    inserted_events.append(event)

                db.session.commit()

                if inserted_events:
                    for event in inserted_events:
                        payload = _event_payload(event)
                        broadcast_new_event(payload)

                    broadcast_stats(_stats_payload())
                    broadcast_timeline(_timeline_payload())

                logger.info(f"Ingestion cycle: {len(inserted_events)} new events")

            except Exception as ex:

                db.session.rollback()

                print("ERROR:", ex)

            time.sleep(5)
