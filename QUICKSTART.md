# Quick Start Guide

## First Time Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Initialize Database
```bash
python app.py
```

The Flask app will create an empty SQLite database on first run.

### 3. Load Sample Rules (Optional)
```bash
mkdir scripts
python scripts/init_sample_data.py
```

This creates example detection rules for testing.

### 4. Start the Application
```bash
python app.py
```

Visit http://localhost:5000 to see the dashboard.

## API Quick Reference

### Test API Connection
```bash
curl http://localhost:5000/health
```

### Get Dashboard Stats
```bash
curl http://localhost:5000/api/stats
```

### List All Alerts
```bash
curl http://localhost:5000/api/alerts
```

### Create a Custom Event
```bash
curl -X POST http://localhost:5000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 1,
    "computer_name": "WORKSTATION-01",
    "user": "DOMAIN\\Administrator",
    "event_type": "ProcessCreate",
    "description": "C:\\Windows\\System32\\powershell.exe -Command \\"Get-Process\\"",
    "details": {"CommandLine": "powershell -Command \\"Get-Process\\""}
  }'
```

### Create a Detection Rule
```bash
curl -X POST http://localhost:5000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Suspicious PowerShell",
    "description": "Detects PowerShell with suspicious patterns",
    "event_type": "ProcessCreate",
    "severity": "HIGH",
    "conditions": [
      {
        "field": "description",
        "operator": "contains",
        "value": "powershell"
      }
    ],
    "tags": ["execution", "powershell"]
  }'
```

## Web Interface

- **Dashboard** - Overview with statistics
- **Alerts** - View and manage security alerts
- **Events** - Browse Windows events
- **Rules** - Create and manage detection rules

## File Structure

```
project/
├── app.py                      # Main Flask app
├── config.py                   # Configuration
├── requirements.txt            # Dependencies
├── README.md                   # Full documentation
├── collector/                  # Event collection
│   └── sysmon_collector.py    # Sysmon integration
├── database/                   # Data models
│   └── db.py                  # SQLAlchemy models
├── detection/                  # Rule engine
│   └── rules.py               # Detection logic
├── routes/                     # API & Web routes
│   ├── api.py                 # REST API
│   └── dashboard.py           # Web pages
├── templates/                  # HTML templates
│   ├── dashboard.html         # Main dashboard
│   ├── alerts.html            # Alerts page
│   ├── events.html            # Events page
│   └── rules.html             # Rules page
├── tests/                      # Test suite
│   ├── test_api.py            # API tests
│   └── test_rules.py          # Rule engine tests
└── scripts/                    # Utility scripts
    └── init_sample_data.py    # Sample data creation
```

## Troubleshooting

### Port Already in Use
Change port in app.py:
```python
app.run(debug=True, host='0.0.0.0', port=5001)
```

### Database Lock
Delete `soc.db` and reinitialize:
```bash
del soc.db
python app.py
```

### No Sysmon Events
Ensure Sysmon is installed and running:
```powershell
Get-WinEvent -LogName 'Microsoft-Windows-Sysmon/Operational' | Select -First 5
```

## Next Steps

1. Create custom detection rules
2. Load real Sysmon events
3. Configure alert thresholds
4. Set up incident management
5. Export reports

See README.md for advanced features.
