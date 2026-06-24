from collector.sysmon_collector import SysmonCollector
from database.db import db, Event
from app import create_app
import time

collector = SysmonCollector()


def ingest_events():
    """Continuously collect Sysmon events and persist them to the database."""
    app = create_app()

    with app.app_context():
        print("Starting event ingestion...")

        while True:
            try:
                events = collector.collect_events(20)

                for e in events:
                    # Skip duplicates
                    exists = Event.query.filter_by(
                        event_id=e.get("event_id"),
                        description=e.get("description"),
                    ).first()

                    if exists:
                        continue

                    event = Event(
                        event_id=e.get("event_id"),
                        computer_name=e.get("computer_name"),
                        user=e.get("user"),
                        event_type=e.get("event_type"),
                        description=e.get("description"),
                        details=e.get("details"),
                    )
                    db.session.add(event)

                db.session.commit()
                print(f"Inserted {len(events)} events")

            except Exception as ex:
                print("Ingestion error:", ex)

            time.sleep(30)


if __name__ == "__main__":
    ingest_events()
