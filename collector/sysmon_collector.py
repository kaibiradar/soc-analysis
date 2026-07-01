import subprocess
import json
import logging
from typing import List, Dict, Optional
from datetime import datetime, timezone
import re
import time

logger = logging.getLogger(__name__)
POWERSHELL_DATE_RE = re.compile(r"/Date\((?P<millis>-?\d+)(?P<offset>[+-]\d{4})?\)/")


def normalize_timestamp(value) -> datetime:
    """Convert PowerShell/JSON timestamp values into naive UTC datetimes."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        match = POWERSHELL_DATE_RE.fullmatch(value)
        if match:
            millis = int(match.group("millis"))
            dt = datetime.fromtimestamp(millis / 1000, tz=timezone.utc)
        else:
            raw = value.replace("Z", "+00:00")
            dt = datetime.fromisoformat(raw)
    else:
        return datetime.utcnow()

    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)

    return dt

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
        sources = [
            "Microsoft-Windows-Sysmon/Operational",
            "Application",
        ]

        for log_name in sources:
            try:
                command = [
                    "powershell",
                    "-Command",
                    f"Get-WinEvent -LogName '{log_name}' -MaxEvents {max_events} | ConvertTo-Json",
                ]

                result = subprocess.run(command, capture_output=True, text=True, timeout=30)

                if result.returncode != 0:
                    logger.warning(f"{log_name} collection error: {result.stderr.strip()}")
                    continue

                events = json.loads(result.stdout)
                if not isinstance(events, list):
                    events = [events]

                parsed_events = [self.parse_event(event, log_name) for event in events]
                cleaned_events = [event for event in parsed_events if event]

                if cleaned_events:
                    return cleaned_events

            except subprocess.TimeoutExpired:
                logger.error(f"{log_name} collection timed out")
            except json.JSONDecodeError as e:
                logger.error(f"{log_name} JSON parse error: {e}")
            except Exception as e:
                logger.error(f"{log_name} unexpected error: {e}")

        return [self._heartbeat_event()]

    def _heartbeat_event(self) -> Dict:
        now = datetime.utcnow()
        return {
            "event_id": int(time.time() * 1000),
            "event_type": "Heartbeat",
            "computer_name": "LOCALHOST",
            "user": "SYSTEM",
            "timestamp": now,
            "description": "Live collector heartbeat",
            "details": {
                "provider": "collector",
                "level": "Information",
                "log_name": "heartbeat",
                "record_id": int(time.time() * 1000),
            },
        }
    
    def parse_event(self, event: Dict, source_log: str = "Microsoft-Windows-Sysmon/Operational") -> Optional[Dict]:
        """Parse and normalize a Sysmon event"""
        try:
            event_id = event.get('Id')
            event_type = self.event_type_map.get(str(event_id), event.get('ProviderName') or f"Event{event_id}" if event_id is not None else 'Unknown')
            
            properties = event.get('Properties', {})
            user = None

            if isinstance(properties, dict):
                user = properties.get('User') or properties.get('TargetUserName')
            elif isinstance(properties, list) and properties:
                first_value = properties[0]
                if isinstance(first_value, dict):
                    user = first_value.get('Value') or first_value.get('value')
                else:
                    user = str(first_value)
            
            parsed = {
                'event_id': event_id,
                'event_type': event_type,
                'computer_name': event.get('MachineName', 'Unknown'),
                'user': user,
                'timestamp': normalize_timestamp(event.get('TimeCreated')),
                'description': event.get('Message', '') or event.get('ProviderName', ''),
                'details': {
                    'provider': event.get('ProviderName'),
                    'level': event.get('LevelDisplayName'),
                    'log_name': source_log,
                    'record_id': event.get('RecordId'),
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
