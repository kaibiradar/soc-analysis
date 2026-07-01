from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import create_app
from collector.event_ingestion import start_event_ingestion
from socketio_instance import socketio


if __name__ == "__main__":
    app = create_app()
    start_event_ingestion(app)
    socketio.run(
        app,
        debug=False,
        host="127.0.0.1",
        port=5000,
        allow_unsafe_werkzeug=True,
    )
