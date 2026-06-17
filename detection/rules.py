from typing import Dict, List, Tuple, Any

class RuleEngine:
    """Advanced rule engine with condition matching"""
    
    def __init__(self):
        self.operators = {
            'equals': lambda a, b: a == b,
            'contains': lambda a, b: str(b).lower() in str(a).lower(),
            'startswith': lambda a, b: str(a).lower().startswith(str(b).lower()),
            'endswith': lambda a, b: str(a).lower().endswith(str(b).lower()),
            'greater_than': lambda a, b: a > b,
            'less_than': lambda a, b: a < b,
            'in_list': lambda a, b: a in b,
            'regex': self._regex_match,
        }
    
    @staticmethod
    def _regex_match(text: str, pattern: str) -> bool:
        """Regex matching helper"""
        import re
        try:
            return bool(re.search(pattern, str(text), re.IGNORECASE))
        except:
            return False
    
    def evaluate_condition(self, event_data: Dict, condition: Dict) -> bool:
        """Evaluate a single condition"""
        field = condition.get('field')
        operator = condition.get('operator', 'equals')
        value = condition.get('value')
        
        event_value = event_data.get(field)
        
        if operator not in self.operators:
            raise ValueError(f"Unknown operator: {operator}")
        
        try:
            return self.operators[operator](event_value, value)
        except Exception:
            return False
    
    def evaluate_conditions(self, event_data: Dict, conditions: List[Dict], logic: str = 'AND') -> bool:
        """Evaluate multiple conditions with AND/OR logic"""
        if not conditions:
            return True
        
        results = [self.evaluate_condition(event_data, cond) for cond in conditions]
        
        if logic.upper() == 'AND':
            return all(results)
        elif logic.upper() == 'OR':
            return any(results)
        else:
            return False
    
    def match_rule(self, event_data: Dict, rule: Dict) -> Tuple[bool, str]:
        """Check if an event matches a rule"""
        if not rule.get('enabled', True):
            return False, "Rule is disabled"
        
        event_type = rule.get('event_type')
        if event_data.get('event_type') != event_type:
            return False, f"Event type mismatch: expected {event_type}"
        
        conditions = rule.get('conditions', [])
        logic = rule.get('logic', 'AND')
        
        matched = self.evaluate_conditions(event_data, conditions, logic)
        
        return matched, "Rule matched" if matched else "Conditions not met"


def check_event(event_text: str) -> Tuple[str, str]:
    """
    Legacy function for backward compatibility.
    Use RuleEngine for new code.
    """
    event_text = event_text.lower()
    
    suspicious_patterns = {
        "powershell": ("HIGH", "PowerShell Execution Detected"),
        "cmd.exe": ("MEDIUM", "Command Prompt Execution"),
        "psexec": ("CRITICAL", "PsExec Tool Detected"),
        "mimikatz": ("CRITICAL", "Credential Dumping Tool Detected"),
        "wmiexec": ("HIGH", "WMI Command Execution Detected"),
    }
    
    for pattern, (severity, description) in suspicious_patterns.items():
        if pattern in event_text:
            return severity, description
    
    return None, None
