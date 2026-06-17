from flask import Blueprint, request, jsonify
from database.db import db, Event, Alert, Rule, Incident
from detection.rules import RuleEngine
import logging

api_bp = Blueprint('api', __name__)
logger = logging.getLogger(__name__)
rule_engine = RuleEngine()

# ==================== EVENTS ====================

@api_bp.route('/events', methods=['GET'])
def get_events():
    """Get all events with pagination"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    events = Event.query.order_by(Event.timestamp.desc()).paginate(page=page, per_page=per_page)
    
    return jsonify({
        'total': events.total,
        'pages': events.pages,
        'current_page': page,
        'events': [{
            'id': e.id,
            'event_id': e.event_id,
            'computer_name': e.computer_name,
            'user': e.user,
            'event_type': e.event_type,
            'timestamp': e.timestamp.isoformat(),
            'description': e.description,
        } for e in events.items]
    })

@api_bp.route('/events/<int:event_id>', methods=['GET'])
def get_event(event_id):
    """Get specific event details"""
    event = Event.query.get_or_404(event_id)
    
    return jsonify({
        'id': event.id,
        'event_id': event.event_id,
        'computer_name': event.computer_name,
        'user': event.user,
        'event_type': event.event_type,
        'timestamp': event.timestamp.isoformat(),
        'description': event.description,
        'details': event.details,
        'created_at': event.created_at.isoformat(),
    })

@api_bp.route('/events', methods=['POST'])
def create_event():
    """Create a new event"""
    data = request.get_json()
    
    try:
        event = Event(
            event_id=data.get('event_id'),
            computer_name=data.get('computer_name'),
            user=data.get('user'),
            event_type=data.get('event_type'),
            description=data.get('description'),
            details=data.get('details', {})
        )
        
        db.session.add(event)
        db.session.commit()
        
        # Check against rules
        check_event_against_rules(event)
        
        return jsonify({'id': event.id, 'status': 'created'}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating event: {e}")
        return jsonify({'error': str(e)}), 400

# ==================== ALERTS ====================

@api_bp.route('/alerts', methods=['GET'])
def get_alerts():
    """Get all alerts with filtering"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    severity = request.args.get('severity')
    
    query = Alert.query
    
    if status:
        query = query.filter_by(status=status)
    if severity:
        query = query.filter_by(severity=severity)
    
    alerts = query.order_by(Alert.created_at.desc()).paginate(page=page, per_page=per_page)
    
    return jsonify({
        'total': alerts.total,
        'alerts': [{
            'id': a.id,
            'title': a.title,
            'severity': a.severity,
            'status': a.status,
            'created_at': a.created_at.isoformat(),
        } for a in alerts.items]
    })

@api_bp.route('/alerts/<int:alert_id>', methods=['GET'])
def get_alert(alert_id):
    """Get alert details"""
    alert = Alert.query.get_or_404(alert_id)
    
    return jsonify({
        'id': alert.id,
        'title': alert.title,
        'description': alert.description,
        'severity': alert.severity,
        'status': alert.status,
        'assigned_to': alert.assigned_to,
        'notes': alert.notes,
        'created_at': alert.created_at.isoformat(),
        'updated_at': alert.updated_at.isoformat(),
    })

@api_bp.route('/alerts/<int:alert_id>', methods=['PUT'])
def update_alert(alert_id):
    """Update alert status or notes"""
    alert = Alert.query.get_or_404(alert_id)
    data = request.get_json()
    
    if 'status' in data:
        alert.status = data['status']
    if 'notes' in data:
        alert.notes = data['notes']
    if 'assigned_to' in data:
        alert.assigned_to = data['assigned_to']
    
    db.session.commit()
    return jsonify({'id': alert.id, 'status': 'updated'})

# ==================== RULES ====================

@api_bp.route('/rules', methods=['GET'])
def get_rules():
    """Get all detection rules"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    enabled_only = request.args.get('enabled_only', False, type=bool)
    
    query = Rule.query
    if enabled_only:
        query = query.filter_by(enabled=True)
    
    rules = query.paginate(page=page, per_page=per_page)
    
    return jsonify({
        'total': rules.total,
        'rules': [{
            'id': r.id,
            'name': r.name,
            'severity': r.severity,
            'enabled': r.enabled,
            'tags': r.tags,
        } for r in rules.items]
    })

@api_bp.route('/rules', methods=['POST'])
def create_rule():
    """Create a new detection rule"""
    data = request.get_json()
    
    try:
        rule = Rule(
            name=data.get('name'),
            description=data.get('description'),
            event_type=data.get('event_type'),
            conditions=data.get('conditions', []),
            severity=data.get('severity', 'MEDIUM'),
            tags=data.get('tags', []),
            enabled=data.get('enabled', True)
        )
        
        db.session.add(rule)
        db.session.commit()
        
        return jsonify({'id': rule.id, 'status': 'created'}), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating rule: {e}")
        return jsonify({'error': str(e)}), 400

@api_bp.route('/rules/<int:rule_id>', methods=['PUT'])
def update_rule(rule_id):
    """Update a detection rule"""
    rule = Rule.query.get_or_404(rule_id)
    data = request.get_json()
    
    if 'name' in data:
        rule.name = data['name']
    if 'description' in data:
        rule.description = data['description']
    if 'conditions' in data:
        rule.conditions = data['conditions']
    if 'severity' in data:
        rule.severity = data['severity']
    if 'tags' in data:
        rule.tags = data['tags']
    if 'enabled' in data:
        rule.enabled = data['enabled']
    
    db.session.commit()
    return jsonify({'id': rule.id, 'status': 'updated'})

@api_bp.route('/rules/<int:rule_id>', methods=['DELETE'])
def delete_rule(rule_id):
    """Delete a rule"""
    rule = Rule.query.get_or_404(rule_id)
    db.session.delete(rule)
    db.session.commit()
    return jsonify({'status': 'deleted'})

# ==================== STATISTICS ====================

@api_bp.route('/stats', methods=['GET'])
def get_statistics():
    """Get dashboard statistics"""
    from sqlalchemy import func
    
    total_events = Event.query.count()
    total_alerts = Alert.query.count()
    
    severity_counts = db.session.query(
        Alert.severity, func.count(Alert.id)
    ).group_by(Alert.severity).all()
    
    status_counts = db.session.query(
        Alert.status, func.count(Alert.id)
    ).group_by(Alert.status).all()
    
    return jsonify({
        'total_events': total_events,
        'total_alerts': total_alerts,
        'severity_distribution': {s: c for s, c in severity_counts},
        'status_distribution': {s: c for s, c in status_counts},
    })

# ==================== HELPER FUNCTIONS ====================

def check_event_against_rules(event):
    """Check if event matches any enabled rules and create alerts"""
    rules = Rule.query.filter_by(enabled=True).all()
    
    event_data = {
        'event_type': event.event_type,
        'computer_name': event.computer_name,
        'user': event.user,
        'description': event.description,
        'details': event.details or {}
    }
    
    for rule in rules:
        matched, message = rule_engine.match_rule(event_data, {
            'event_type': rule.event_type,
            'conditions': rule.conditions,
            'enabled': rule.enabled,
        })
        
        if matched:
            alert = Alert(
                event_id=event.id,
                rule_id=rule.id,
                severity=rule.severity,
                title=rule.name,
                description=message,
                status='NEW'
            )
            db.session.add(alert)
    
    db.session.commit()
