import pytest
from app import create_app
from database.db import db, Event, Rule, Alert

@pytest.fixture
def app():
    app = create_app('testing')
    
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

class TestEvents:
    def test_create_event(self, client):
        response = client.post('/api/events', json={
            'event_id': 1,
            'computer_name': 'TEST-PC',
            'user': 'testuser',
            'event_type': 'ProcessCreate',
            'description': 'Test event'
        })
        assert response.status_code == 201
        data = response.get_json()
        assert 'id' in data

    def test_get_events(self, client):
        client.post('/api/events', json={
            'event_id': 1,
            'computer_name': 'TEST-PC',
            'event_type': 'ProcessCreate'
        })
        
        response = client.get('/api/events')
        assert response.status_code == 200
        data = response.get_json()
        assert data['total'] == 1

class TestRules:
    def test_create_rule(self, client):
        response = client.post('/api/rules', json={
            'name': 'Test Rule',
            'event_type': 'ProcessCreate',
            'conditions': [
                {
                    'field': 'description',
                    'operator': 'contains',
                    'value': 'powershell'
                }
            ],
            'severity': 'HIGH'
        })
        assert response.status_code == 201

    def test_get_rules(self, client):
        client.post('/api/rules', json={
            'name': 'Test Rule',
            'event_type': 'ProcessCreate',
            'conditions': [],
            'severity': 'MEDIUM'
        })
        
        response = client.get('/api/rules')
        assert response.status_code == 200

class TestAPI:
    def test_health_endpoint(self, client):
        response = client.get('/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'healthy'
