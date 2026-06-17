from detection.rules import RuleEngine

def test_rule_engine_equals():
    engine = RuleEngine()
    event = {'event_type': 'ProcessCreate', 'description': 'powershell.exe'}
    condition = {'field': 'description', 'operator': 'equals', 'value': 'powershell.exe'}
    
    result = engine.evaluate_condition(event, condition)
    assert result == True

def test_rule_engine_contains():
    engine = RuleEngine()
    event = {'description': 'C:\\Windows\\System32\\powershell.exe'}
    condition = {'field': 'description', 'operator': 'contains', 'value': 'powershell'}
    
    result = engine.evaluate_condition(event, condition)
    assert result == True

def test_rule_engine_and_logic():
    engine = RuleEngine()
    event = {'event_type': 'ProcessCreate', 'description': 'powershell'}
    conditions = [
        {'field': 'event_type', 'operator': 'equals', 'value': 'ProcessCreate'},
        {'field': 'description', 'operator': 'contains', 'value': 'powershell'}
    ]
    
    result = engine.evaluate_conditions(event, conditions, 'AND')
    assert result == True

def test_rule_engine_or_logic():
    engine = RuleEngine()
    event = {'event_type': 'ProcessCreate', 'description': 'cmd.exe'}
    conditions = [
        {'field': 'description', 'operator': 'contains', 'value': 'powershell'},
        {'field': 'description', 'operator': 'contains', 'value': 'cmd.exe'}
    ]
    
    result = engine.evaluate_conditions(event, conditions, 'OR')
    assert result == True

def test_rule_matching():
    engine = RuleEngine()
    event_data = {
        'event_type': 'ProcessCreate',
        'description': 'powershell.exe'
    }
    rule = {
        'event_type': 'ProcessCreate',
        'enabled': True,
        'conditions': [
            {'field': 'description', 'operator': 'contains', 'value': 'powershell'}
        ]
    }
    
    matched, message = engine.match_rule(event_data, rule)
    assert matched == True
