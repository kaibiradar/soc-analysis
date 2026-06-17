# SOC Analysis Platform - Intermediate Level

A professional-grade Security Operations Center (SOC) analysis platform built with Flask, SQLAlchemy, and a sophisticated rule engine.

## Features

### 🔍 Event Collection
- Windows Sysmon event collection with parsing
- Support for multiple event types (ProcessCreate, NetworkConnect, FileCreate, etc.)
- JSON event normalization

### 🛡️ Detection Rules
- Advanced rule engine with AND/OR logic
- Multiple condition operators (equals, contains, regex, etc.)
- Rule enable/disable capability
- Tags and severity classification

### 🚨 Alert Management
- Automatic alert generation from rule matches
- Alert filtering by status and severity
- Alert assignment and notes
- Status tracking (NEW, ACKNOWLEDGED, RESOLVED, FALSE_POSITIVE)

### 📊 Dashboard
- Real-time statistics
- Alert distribution visualization
- Event tracking
- Recent alerts display

### 🌐 RESTful API
- Full CRUD operations on events, alerts, and rules
- Pagination support
- Advanced filtering
- Statistics endpoint

## Installation

### Prerequisites
- Python 3.8+
- Windows (for Sysmon support)
- pip

### Setup

1. **Clone the repository**
   ```bash
   cd c:\soc-analysis
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize database**
   ```bash
   python app.py
   ```

5. **Run the application**
   ```bash
   python app.py
   ```

The application will be available at `http://localhost:5000`

## Configuration

Create a `.env` file:

```
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///soc.db
LOG_LEVEL=INFO
```

## API Documentation

### Events
- `GET /api/events` - List all events
- `GET /api/events/<id>` - Get event details
- `POST /api/events` - Create new event

### Alerts
- `GET /api/alerts` - List alerts (supports filtering: status, severity)
- `GET /api/alerts/<id>` - Get alert details
- `PUT /api/alerts/<id>` - Update alert

### Rules
- `GET /api/rules` - List all rules
- `POST /api/rules` - Create new rule
- `PUT /api/rules/<id>` - Update rule
- `DELETE /api/rules/<id>` - Delete rule

### Statistics
- `GET /api/stats` - Get dashboard statistics

## Example Rule Creation

```bash
curl -X POST http://localhost:5000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PowerShell Execution Detection",
    "description": "Detects PowerShell process creation",
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

## Project Structure

```
soc-analysis/
├── app.py                    # Flask application factory
├── config.py                 # Configuration management
├── requirements.txt          # Python dependencies
├── collector/
│   └── sysmon_collector.py   # Windows event collection
├── database/
│   └── db.py                 # SQLAlchemy models
├── detection/
│   └── rules.py              # Rule engine
├── routes/
│   ├── api.py               # API endpoints
│   └── dashboard.py         # Web UI routes
└── templates/
    ├── dashboard.html       # Main dashboard
    ├── alerts.html          # Alerts management
    ├── events.html          # Events listing
    └── rules.html           # Rules management
```

## Rule Engine

The rule engine supports complex condition matching:

### Supported Operators
- `equals` - Exact match
- `contains` - Substring match (case-insensitive)
- `startswith` - String prefix match
- `endswith` - String suffix match
- `greater_than` - Numeric comparison
- `less_than` - Numeric comparison
- `in_list` - Check if value in list
- `regex` - Regular expression matching

### Logic
Rules support both AND and OR logic for combining conditions:
- AND - All conditions must match
- OR - At least one condition must match

## Development

### Running Tests

```bash
pytest tests/
```

### Creating Test Data

```python
from app import create_app
from database.db import db, Event

app = create_app()
with app.app_context():
    event = Event(
        event_id=1,
        computer_name='WORKSTATION-01',
        user='DOMAIN\\user',
        event_type='ProcessCreate',
        description='C:\\Windows\\System32\\powershell.exe'
    )
    db.session.add(event)
    db.session.commit()
```

## Security Notes

- Change `SECRET_KEY` in production
- Use proper authentication in production
- Validate all input data
- Use HTTPS in production
- Implement rate limiting
- Add logging and monitoring

## Scaling to Advanced Level

Future enhancements:
- Multi-tenant support
- Authentication & authorization
- Elasticsearch integration for log storage
- Correlation rules
- Incident management workflows
- Custom report generation
- Machine learning-based anomaly detection
- Integration with SIEM systems

## Support

For issues or questions, refer to the API documentation or check logs at app startup.

## License

MIT License
