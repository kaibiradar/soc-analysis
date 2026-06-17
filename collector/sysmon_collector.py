import subprocess
import json
import logging
from typing import List, Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class SysmonCollector:
    """Enhanced Sysmon event collector"""
    
    def __init__(self):
        self.event_type_map = {
            '1': 'ProcessCreate',
            '2': 'ProcessChanged',
            '3': 'NetworkConnect',
            '5': 'ProcessTerminated',
            '6': 'DriverLoaded',
            '7': 'ImageLoaded',
            '8': 'CreateRemoteThread',
            '9': 'RawAccessRead',
            '10': 'ProcessAccess',
            '11': 'FileCreate',
            '12': 'RegistryEvent',
            '13': 'RegistryEvent',
            '14': 'RegistryEvent',
            '15': 'FileCreateStreamHash',
        }
    
    def collect_events(self, max_events: int = 100) -> List[Dict]:
        """Collect recent Sysmon events"""
        try:
            command = [
                "powershell",
                "-Command",
                f"Get-WinEvent -LogName 'Microsoft-Windows-Sysmon/Operational' -MaxEvents {max_events} | ConvertTo-Json"
            ]
            
            result = subprocess.run(command, capture_output=True, text=True, timeout=30)
            
            if result.returncode != 0:
                logger.error(f"Sysmon collection error: {result.stderr}")
                return []
            
            events = json.loads(result.stdout)
            if not isinstance(events, list):
                events = [events]
            
            parsed_events = [self.parse_event(event) for event in events]
            return [e for e in parsed_events if e]  # Filter out None values
            
        except subprocess.TimeoutExpired:
            logger.error("Sysmon collection timed out")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return []
    
    def parse_event(self, event: Dict) -> Optional[Dict]:
        """Parse and normalize a Sysmon event"""
        try:
            event_id = event.get('Id')
            event_type = self.event_type_map.get(str(event_id), 'Unknown')
            
            properties = event.get('Properties', {})
            
            parsed = {
                'event_id': event_id,
                'event_type': event_type,
                'computer_name': event.get('MachineName', 'Unknown'),
                'user': properties.get('User') if isinstance(properties, dict) else None,
                'timestamp': event.get('TimeCreated'),
                'description': event.get('Message', ''),
                'details': {
                    'provider': event.get('ProviderName'),
                    'level': event.get('LevelDisplayName'),
                }
            }
            
            return parsed
        except Exception as e:
            logger.error(f"Error parsing event: {e}")
            return None
    
    def collect_with_filter(self, event_types: List[str], max_events: int = 100) -> List[Dict]:
        """Collect events filtered by type"""
        all_events = self.collect_events(max_events * 2)
        filtered = [e for e in all_events if e.get('event_type') in event_types]
        return filtered[:max_events]


# Legacy function for backward compatibility
def collect_sysmon_events():
    """Collect raw Sysmon events"""
    try:
        command = [
            "powershell",
            "-Command",
            "Get-WinEvent -LogName 'Microsoft-Windows-Sysmon/Operational' -MaxEvents 5"
        ]
        
        result = subprocess.run(command, capture_output=True, text=True)
        
        print("STDOUT:")
        print(result.stdout)
        print("\nSTDERR:")
        print(result.stderr)
        print("\nRETURN CODE:")
        print(result.returncode)
        
        return result.stdout
    except Exception as e:
        print(f"Error: {e}")
        return None
