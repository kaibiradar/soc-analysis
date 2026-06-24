from flask import Flask, jsonify
from flask_cors import CORS
import logging
from config import config
from database.db import db
from datetime import datetime

def create_app(config_name='development'):
    """Application factory"""
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize database
    db.init_app(app)
    
    # Enable CORS so the React dev server (port 5173) can call the API
    CORS(app)
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    with app.app_context():
        db.create_all()
    
    # Register blueprints
    from routes.api import api_bp
    from routes.dashboard import dashboard_bp
    
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(dashboard_bp)
    
    @app.route('/health')
    def health():
        return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()}), 200
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({'error': 'Internal server error'}), 500
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
