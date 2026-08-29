import json
from typing import Optional, List, Dict, Any, Set
from sqlalchemy.orm import Session
from models.permission import ObjectPermission
from models.user import User


SENSITIVE_FIELDS = {
    "Doctor": ["prescription_power", "prescription_volume", "influence_score", "compliance_risk_level"],
    "SalesRep": ["performance", "quota_achievement", "ytd_sales"],
    "Hospital": ["annual_revenue"],
    "BudgetCategory": ["budget_amount", "used_amount", "remaining_amount"],
    "ExpenseClassification": ["amount"],
    "LaborPayment": ["total_amount"],
    "ExpenseROI": ["expense_amount", "revenue_generated", "roi_ratio"],
    "ComplianceAlert": ["alert_description"],
    "SalesTarget": ["target_value", "actual_value", "forecast_value"],
}

ROLE_PERMISSIONS = {
    "admin": {
        "all_types": {"can_read": True, "can_write": True, "can_execute": True, "can_admin": True},
    },
    "manager": {
        "Doctor": {"can_read": True, "can_write": True, "can_execute": True, "can_admin": False},
        "Hospital": {"can_read": True, "can_write": True, "can_execute": True, "can_admin": False},
        "Product": {"can_read": True, "can_write": False, "can_execute": True, "can_admin": False},
        "SalesRep": {"can_read": True, "can_write": True, "can_execute": True, "can_admin": False},
        "SalesTarget": {"can_read": True, "can_write": True, "can_execute": True, "can_admin": False},
        "ComplianceAlert": {"can_read": True, "can_write": True, "can_execute": True, "can_admin": False},
        "BudgetCategory": {"can_read": True, "can_write": True, "can_execute": True, "can_admin": False},
        "default": {"can_read": True, "can_write": False, "can_execute": False, "can_admin": False},
    },
    "user": {
        "Doctor": {"can_read": True, "can_write": False, "can_execute": True, "can_admin": False},
        "Hospital": {"can_read": True, "can_write": False, "can_execute": False, "can_admin": False},
        "Product": {"can_read": True, "can_write": False, "can_execute": False, "can_admin": False},
        "default": {"can_read": True, "can_write": False, "can_execute": False, "can_admin": False},
    },
    "agent": {
        "Doctor": {"can_read": True, "can_write": False, "can_execute": True, "can_admin": False},
        "Hospital": {"can_read": True, "can_write": False, "can_execute": True, "can_admin": False},
        "Product": {"can_read": True, "can_write": False, "can_execute": True, "can_admin": False},
        "SalesRep": {"can_read": True, "can_write": False, "can_execute": True, "can_admin": False},
        "ComplianceAlert": {"can_read": True, "can_write": False, "can_execute": True, "can_admin": False},
        "BudgetCategory": {"can_read": True, "can_write": False, "can_execute": False, "can_admin": False},
        "default": {"can_read": True, "can_write": False, "can_execute": False, "can_admin": False},
    },
}


def check_permission(db: Session, user: User, object_type: str, object_id: Optional[str], permission: str) -> bool:
    if user.role == "admin":
        return True

    explicit = db.query(ObjectPermission).filter(
        ObjectPermission.user_id == user.id,
        ObjectPermission.object_type == object_type,
    ).all()

    for perm in explicit:
        if perm.object_id and perm.object_id != object_id and perm.object_id != "*":
            continue
        if getattr(perm, permission, False):
            return True

    role_perms = ROLE_PERMISSIONS.get(user.role, {})
    type_perms = role_perms.get(object_type, role_perms.get("default", {}))
    return type_perms.get(permission, False)


def filter_sensitive_fields(user: User, object_type: str, properties: Dict[str, Any]) -> Dict[str, Any]:
    if user.role == "admin":
        return properties

    sensitive = SENSITIVE_FIELDS.get(object_type, [])
    if not sensitive:
        return properties

    filtered = {}
    for key, value in properties.items():
        if key in sensitive and user.role not in ("admin", "manager"):
            filtered[key] = "***"
        else:
            filtered[key] = value

    return filtered


def get_readable_object_types(user: User) -> List[str]:
    if user.role == "admin":
        return ["*"]

    role_perms = ROLE_PERMISSIONS.get(user.role, {})
    readable = []
    for obj_type, perms in role_perms.items():
        if obj_type == "default":
            continue
        if perms.get("can_read", False):
            readable.append(obj_type)

    return readable if readable else ["*"]


def check_action_permission(db: Session, user: User, object_type: str, action_requires_approval: bool) -> bool:
    if user.role == "admin":
        return True

    can_execute = check_permission(db, user, object_type, None, "can_execute")
    if not can_execute:
        return False

    if action_requires_approval and user.role not in ("admin", "manager"):
        return False

    return True
