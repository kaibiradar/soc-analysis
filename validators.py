"""
Input validation schemas using marshmallow.
Used by API routes to validate request bodies before touching the DB.
"""
from marshmallow import Schema, fields, validate, ValidationError, pre_load

VALID_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
VALID_STATUSES   = ["NEW", "OPEN", "ACKNOWLEDGED", "RESOLVED", "FALSE_POSITIVE"]
VALID_OPERATORS  = ["equals", "contains", "startswith", "endswith",
                    "greater_than", "less_than", "in_list", "regex"]
VALID_EVENT_TYPES = [
    "ProcessCreate", "ProcessChanged", "NetworkConnect", "ProcessTerminated",
    "DriverLoaded", "ImageLoaded", "CreateRemoteThread", "RawAccessRead",
    "ProcessAccess", "FileCreate", "RegistryEvent", "FileCreateStreamHash",
    "Unknown",
]


class ConditionSchema(Schema):
    field    = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    operator = fields.Str(required=True, validate=validate.OneOf(VALID_OPERATORS))
    value    = fields.Raw(required=True)


class CreateEventSchema(Schema):
    event_id      = fields.Int(required=True)
    computer_name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    user          = fields.Str(load_default=None, validate=validate.Length(max=255))
    event_type    = fields.Str(load_default="Unknown")
    description   = fields.Str(load_default="")
    details       = fields.Dict(load_default={})


class CreateRuleSchema(Schema):
    name        = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    description = fields.Str(load_default="")
    event_type  = fields.Str(required=True)
    conditions  = fields.List(fields.Nested(ConditionSchema), load_default=[])
    severity    = fields.Str(load_default="MEDIUM",
                             validate=validate.OneOf(VALID_SEVERITIES))
    tags        = fields.List(fields.Str(), load_default=[])
    enabled     = fields.Bool(load_default=True)


class UpdateRuleSchema(Schema):
    name        = fields.Str(validate=validate.Length(min=1, max=255))
    description = fields.Str()
    conditions  = fields.List(fields.Nested(ConditionSchema))
    severity    = fields.Str(validate=validate.OneOf(VALID_SEVERITIES))
    tags        = fields.List(fields.Str())
    enabled     = fields.Bool()


class UpdateAlertSchema(Schema):
    status      = fields.Str(validate=validate.OneOf(VALID_STATUSES))
    notes       = fields.Str(validate=validate.Length(max=4096))
    assigned_to = fields.Str(validate=validate.Length(max=255))


# ── Helpers ──────────────────────────────────────────────────────────────────

def validate_body(schema_cls, data: dict) -> tuple[dict, dict | None]:
    """
    Validate *data* against *schema_cls*.
    Returns (cleaned_data, None) on success or ({}, error_dict) on failure.
    """
    try:
        cleaned = schema_cls().load(data or {})
        return cleaned, None
    except ValidationError as exc:
        return {}, exc.messages
