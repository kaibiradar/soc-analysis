from flask import Blueprint, render_template

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@dashboard_bp.route('/alerts')
def alerts():
    return render_template('alerts.html')

@dashboard_bp.route('/rules')
def rules():
    return render_template('rules.html')

@dashboard_bp.route('/events')
def events():
    return render_template('events.html')
