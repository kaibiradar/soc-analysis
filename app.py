import os
import logging
from datetime import datetime, timezone

from flask import Flask, jsonify
from flask_cors import CORS

from config import config
from database.db import db
from logger import setup_logging
from socketio_instance import socketio

logger = logging.getLogger(__name__)


def create_app(config_name: str | None = None) -> Flask:
    """Application factory — returns a plain Flask app (not wrapped by socketio)."""
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # ── Logging ───────────────────────────────────────────────────────────────
    log_level = os.getenv("LOG_LEVEL", "INFO")
    setup_logging(log_level=log_level, log_file="logs/soc.log")

    # ── Extensions ────────────────────────────────────────────────────────────
    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    socketio.init_app(app)          # attach SocketIO to this app instance

    # ── DB bootstrap ──────────────────────────────────────────────────────────
    with app.app_context():
        db.create_all()
        logger.info("Database ready")

    # ── Blueprints ────────────────────────────────────────────────────────────
    from routes.api import api_bp
    from routes.dashboard import dashboard_bp
    from routes.socket_events import socket_bp   # SocketIO event handlers

    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(socket_bp)

    # ── Health ────────────────────────────────────────────────────────────────
    @app.route("/health")
    def health():
        return jsonify({
            "status":    "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version":   "2.0.0",
            "realtime":  "websocket/socket.io",
        }), 200

    # ── Error handlers ────────────────────────────────────────────────────────
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request", "detail": str(e)}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def internal_error(e):
        db.session.rollback()
        logger.exception("Unhandled 500")
        return jsonify({"error": "Internal server error"}), 500

    logger.info(f"App ready — mode='{config_name}'")
    return app


if __name__ == "__main__":
    app = create_app()
    # Use socketio.run() so WebSocket transport is available
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True,
        use_reloader=True,
        log_output=False,
    )
