"""
Sample data initialization script
Populates the database with example rules for testing
"""

from app import create_app
from database.db import db, Rule

def create_sample_rules():
    """Create example detection rules"""
    app = create_app()
    
    with app.app_context():
        # Clear existing rules
        Rule.query.delete()
        
        rules = [
            Rule(
                name='PowerShell Execution Detection',
                description='Detects PowerShell process execution',
                event_type='ProcessCreate',
                conditions=[{
                    'field': 'description',
                    'operator': 'contains',
                    'value': 'powershell'
                }],
                severity='HIGH',
                tags=['execution', 'powershell', 'suspicious'],
                enabled=True
            ),
            Rule(
                name='Command Prompt Execution',
                description='Detects cmd.exe process execution',
                event_type='ProcessCreate',
                conditions=[{
                    'field': 'description',
                    'operator': 'contains',
                    'value': 'cmd.exe'
                }],
                severity='MEDIUM',
                tags=['execution', 'cmd', 'baseline'],
                enabled=True
            ),
            Rule(
                name='Credential Dumping Detection',
                description='Detects potential credential dumping tools',
                event_type='ProcessCreate',
                conditions=[{
                    'field': 'description',
                    'operator': 'contains',
                    'value': 'mimikatz'
                }],
                severity='CRITICAL',
                tags=['credential-access', 'mimikatz', 'critical'],
                enabled=True
            ),
            Rule(
                name='PsExec Tool Detection',
                description='Detects PsExec lateral movement tool',
                event_type='ProcessCreate',
                conditions=[{
                    'field': 'description',
                    'operator': 'contains',
                    'value': 'psexec'
                }],
                severity='HIGH',
                tags=['lateral-movement', 'admin-tools'],
                enabled=True
            ),
            Rule(
                name='WMI Command Execution',
                description='Detects WMI command execution',
                event_type='ProcessCreate',
                conditions=[{
                    'field': 'description',
                    'operator': 'contains',
                    'value': 'wmic'
                }],
                severity='HIGH',
                tags=['execution', 'wmi', 'suspicious'],
                enabled=True
            ),
        ]
        
        for rule in rules:
            db.session.add(rule)
        
        db.session.commit()
        print(f"✅ Created {len(rules)} sample detection rules")

if __name__ == '__main__':
    create_sample_rules()
