"""
Single shared Flask-SocketIO instance.
Imported by app.py (init) and routes/events_socket.py (emit helpers).
Using threading async_mode — works on Windows without native deps.
"""
from flask_socketio import SocketIO

socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode="threading",
    logger=False,
    engineio_logger=False,
    ping_timeout=60,
    ping_interval=25,
)
