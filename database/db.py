from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from enum import Enum

db = SQLAlchemy()

class SeverityEnum(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class StatusEnum(Enum):
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"

class Event(db.Model):
    """Windows event log model"""
    __tablename__ = 'events'
    
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, nullable=False)
    computer_name = db.Column(db.String(255), nullable=False)
    user = db.Column(db.String(255))
    event_type = db.Column(db.String(100))  # ProcessCreate, NetworkConnect, etc.
    description = db.Column(db.Text)
    details = db.Column(db.JSON)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    alerts = db.relationship('Alert', backref='event', lazy=True, cascade='all, delete-orphan')

class Rule(db.Model):
    """Detection rule model"""
    __tablename__ = 'rules'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    description = db.Column(db.Text)
    event_type = db.Column(db.String(100), nullable=False)
    conditions = db.Column(db.JSON, nullable=False)  # List of conditions
    severity = db.Column(db.String(20), default='MEDIUM')
    tags = db.Column(db.JSON, default=list)
    enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    alerts = db.relationship('Alert', backref='rule', lazy=True)

class Alert(db.Model):
    """Security alert model"""
    __tablename__ = 'alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=False)
    rule_id = db.Column(db.Integer, db.ForeignKey('rules.id'), nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(20), default='NEW')
    assigned_to = db.Column(db.String(255))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Incident(db.Model):
    """Incident model for grouping related alerts"""
    __tablename__ = 'incidents'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    severity = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='OPEN')
    assigned_to = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SavedSearch(db.Model):
    """Analyst-defined log explorer query."""
    __tablename__ = 'saved_searches'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    filters = db.Column(db.JSON, nullable=False, default=dict)
    created_by = db.Column(db.String(255), default='analyst')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SearchHistory(db.Model):
    """Recent log explorer searches for quick analyst recall."""
    __tablename__ = 'search_history'

    id = db.Column(db.Integer, primary_key=True)
    query = db.Column(db.String(512), default='')
    filters = db.Column(db.JSON, nullable=False, default=dict)
    result_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class InvestigationNote(db.Model):
    """Notes attached to an alert investigation."""
    __tablename__ = 'investigation_notes'

    id = db.Column(db.Integer, primary_key=True)
    alert_id = db.Column(db.Integer, db.ForeignKey('alerts.id'), nullable=False)
    analyst = db.Column(db.String(255), default='analyst')
    note = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Case(db.Model):
    """SOC case for grouping alerts, evidence, and analyst activity."""
    __tablename__ = 'cases'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    analyst = db.Column(db.String(255), default='')
    priority = db.Column(db.String(20), default='MEDIUM')
    status = db.Column(db.String(30), default='OPEN')
    summary = db.Column(db.Text, default='')
    alert_ids = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    notes = db.relationship('CaseNote', backref='case', lazy=True, cascade='all, delete-orphan')
    evidence = db.relationship('CaseEvidence', backref='case', lazy=True, cascade='all, delete-orphan')


class CaseNote(db.Model):
    __tablename__ = 'case_notes'

    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    analyst = db.Column(db.String(255), default='analyst')
    note = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class CaseEvidence(db.Model):
    __tablename__ = 'case_evidence'

    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    kind = db.Column(db.String(80), default='artifact')
    name = db.Column(db.String(255), nullable=False)
    value = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ThreatIntelCache(db.Model):
    __tablename__ = 'threat_intel_cache'

    id = db.Column(db.Integer, primary_key=True)
    provider = db.Column(db.String(80), nullable=False)
    indicator = db.Column(db.String(512), nullable=False)
    data = db.Column(db.JSON, default=dict)
    fetched_at = db.Column(db.DateTime, default=datetime.utcnow)


class IOCCache(db.Model):
    __tablename__ = 'ioc_cache'

    id = db.Column(db.Integer, primary_key=True)
    ioc_type = db.Column(db.String(50), nullable=False)
    value = db.Column(db.String(512), nullable=False)
    reputation = db.Column(db.JSON, default=dict)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
