import os
from flask import Flask, jsonify
from flask_cors import CORS
from config import config
from database.db import db
from datetime import datetime, timezone
from logger import setup_logging
import logging

logger = logging.getLogger(__name__)


def create_app(config_name: str | None = None) -> Flask:
    """Application factory."""
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # ── Logging ───────────────────────────────────────────────
    log_level = os.getenv("LOG_LEVEL", "INFO")
    setup_logging(log_level=log_level, log_file="logs/soc.log")

    # ── Extensions ────────────────────────────────────────────
    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ── DB tables ─────────────────────────────────────────────
    with app.app_context():
        db.create_all()
        logger.info("Database ready", extra={})

    # ── Blueprints ────────────────────────────────────────────
    from routes.api import api_bp
    from routes.dashboard import dashboard_bp

    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(dashboard_bp)

    # ── Core routes ───────────────────────────────────────────
    @app.route("/health")
    def health():
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0",
        }), 200

    # ── Error handlers ────────────────────────────────────────
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": "Bad request", "detail": str(error)}), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        logger.exception("Unhandled 500 error")
        return jsonify({"error": "Internal server error"}), 500

    logger.info(f"App created in '{config_name}' mode")
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)
