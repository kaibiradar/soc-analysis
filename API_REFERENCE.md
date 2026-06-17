# API Reference Guide

## Base URL
```
http://localhost:5000
```

## Events Endpoints

### GET /api/events
List all events with pagination
```bash
curl "http://localhost:5000/api/events?page=1&per_page=20"
```

**Parameters:**
- `page` (int, default=1) - Page number
- `per_page` (int, default=20) - Items per page

**Response:**
```json
{
  "total": 150,
  "pages": 8,
  "current_page": 1,
  "events": [
    {
      "id": 1,
      "event_id": 123,
      "computer_name": "WORKSTATION-01",
      "user": "DOMAIN\\user",
      "event_type": "ProcessCreate",
      "timestamp": "2026-06-17T10:37:37.474Z",
      "description": "powershell.exe executed"
    }
  ]
}
```

### GET /api/events/:id
Get specific event details
```bash
curl "http://localhost:5000/api/events/1"
```

### POST /api/events
Create a new event
```bash
curl -X POST http://localhost:5000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 456,
    "computer_name": "WORKSTATION-02",
    "user": "DOMAIN\\admin",
    "event_type": "ProcessCreate",
    "description": "cmd.exe executed",
    "details": {
      "CommandLine": "cmd.exe /c ipconfig",
      "ParentImage": "C:\\Windows\\System32\\explorer.exe"
    }
  }'
```

## Alerts Endpoints

### GET /api/alerts
List alerts with filtering
```bash
# All alerts
curl "http://localhost:5000/api/alerts"

# Filter by status
curl "http://localhost:5000/api/alerts?status=NEW"

# Filter by severity
curl "http://localhost:5000/api/alerts?severity=CRITICAL"

# Combined filters
curl "http://localhost:5000/api/alerts?status=NEW&severity=HIGH"
```

**Parameters:**
- `page` (int, default=1)
- `per_page` (int, default=20)
- `status` (string) - NEW|ACKNOWLEDGED|RESOLVED|FALSE_POSITIVE
- `severity` (string) - LOW|MEDIUM|HIGH|CRITICAL

### GET /api/alerts/:id
Get alert details
```bash
curl "http://localhost:5000/api/alerts/1"
```

### PUT /api/alerts/:id
Update alert
```bash
curl -X PUT http://localhost:5000/api/alerts/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ACKNOWLEDGED",
    "notes": "Investigating - confirmed suspicious activity",
    "assigned_to": "analyst@company.com"
  }'
```

## Rules Endpoints

### GET /api/rules
List all rules
```bash
curl "http://localhost:5000/api/rules"

# Only enabled rules
curl "http://localhost:5000/api/rules?enabled_only=true"
```

**Parameters:**
- `page` (int, default=1)
- `per_page` (int, default=20)
- `enabled_only` (bool, default=false)

### POST /api/rules
Create new detection rule
```bash
curl -X POST http://localhost:5000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Suspicious PowerShell Execution",
    "description": "Detects PowerShell with encoded commands",
    "event_type": "ProcessCreate",
    "severity": "HIGH",
    "conditions": [
      {
        "field": "description",
        "operator": "contains",
        "value": "powershell"
      },
      {
        "field": "description",
        "operator": "regex",
        "value": "-enc|-e|-EncodedCommand"
      }
    ],
    "logic": "AND",
    "tags": ["execution", "powershell", "suspicious"],
    "enabled": true
  }'
```

### PUT /api/rules/:id
Update rule
```bash
curl -X PUT http://localhost:5000/api/rules/1 \
  -H "Content-Type: application/json" \
  -d '{
    "severity": "CRITICAL",
    "enabled": false,
    "conditions": [...]
  }'
```

### DELETE /api/rules/:id
Delete rule
```bash
curl -X DELETE http://localhost:5000/api/rules/1
```

## Statistics Endpoints

### GET /api/stats
Get dashboard statistics
```bash
curl "http://localhost:5000/api/stats"
```

**Response:**
```json
{
  "total_events": 1523,
  "total_alerts": 87,
  "severity_distribution": {
    "CRITICAL": 3,
    "HIGH": 24,
    "MEDIUM": 45,
    "LOW": 15
  },
  "status_distribution": {
    "NEW": 15,
    "ACKNOWLEDGED": 45,
    "RESOLVED": 25,
    "FALSE_POSITIVE": 2
  }
}
```

## Health Check

### GET /health
Check API health
```bash
curl "http://localhost:5000/health"
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-06-17T10:37:37.474Z"
}
```

## Rule Condition Operators

### Equals
```json
{
  "field": "event_type",
  "operator": "equals",
  "value": "ProcessCreate"
}
```

### Contains (case-insensitive)
```json
{
  "field": "description",
  "operator": "contains",
  "value": "powershell"
}
```

### Starts With
```json
{
  "field": "description",
  "operator": "startswith",
  "value": "C:\\Windows"
}
```

### Ends With
```json
{
  "field": "description",
  "operator": "endswith",
  "value": ".exe"
}
```

### Greater Than
```json
{
  "field": "event_id",
  "operator": "greater_than",
  "value": 1000
}
```

### Less Than
```json
{
  "field": "event_id",
  "operator": "less_than",
  "value": 100
}
```

### In List
```json
{
  "field": "event_type",
  "operator": "in_list",
  "value": ["ProcessCreate", "NetworkConnect", "ImageLoaded"]
}
```

### Regex (Regular Expression)
```json
{
  "field": "description",
  "operator": "regex",
  "value": "^C:\\\\Windows.*\\.exe$"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request data"
}
```

### 404 Not Found
```json
{
  "error": "Not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting
- No rate limiting in development
- Recommended: Implement 100 requests/minute per IP in production

## Authentication
- Currently: None (development mode)
- Recommended: Implement JWT tokens for production

## CORS
- Currently: Enabled for all origins
- Recommended: Restrict to specific domains in production

---

For more details, see README.md
