from flask import Blueprint

# Dashboard blueprint — HTML templates removed; frontend is served by Vite (React).
# All API endpoints live in routes/api.py under the /api prefix.
dashboard_bp = Blueprint('dashboard', __name__)
