from typing import List, Dict

LIFECYCLE_TRANSITIONS: Dict[str, Dict[str, List[str]]] = {
    "Doctor": {
        "new": ["active", "at_risk"],
        "active": ["at_risk", "churned", "loyal"],
        "at_risk": ["active", "churned"],
        "loyal": ["at_risk", "churned"],
        "churned": ["reactivated"],
        "reactivated": ["active", "at_risk"],
    },
    "Hospital": {
        "new": ["active", "at_risk"],
        "active": ["at_risk", "churned", "loyal"],
        "at_risk": ["active", "churned"],
        "loyal": ["at_risk"],
        "churned": ["reactivated"],
        "reactivated": ["active", "at_risk"],
    },
    "Product": {
        "new": ["active", "discontinued"],
        "active": ["declining", "discontinued"],
        "declining": ["active", "discontinued"],
        "discontinued": [],
    },
    "SalesTarget": {
        "new": ["in_progress", "at_risk"],
        "in_progress": ["completed", "at_risk"],
        "at_risk": ["in_progress", "failed"],
        "completed": [],
        "failed": ["in_progress"],
    },
    "RecoveryPlan": {
        "new": ["in_progress", "approved", "rejected"],
        "in_progress": ["completed", "failed"],
        "approved": ["in_progress"],
        "rejected": ["new"],
        "completed": [],
        "failed": ["in_progress"],
    },
    "ComplianceAlert": {
        "pending": ["investigating", "dismissed", "escalated"],
        "investigating": ["resolved", "escalated"],
        "escalated": ["resolved", "dismissed"],
        "resolved": [],
        "dismissed": ["pending"],
    },
    "BudgetCategory": {
        "new": ["active", "frozen"],
        "active": ["closed", "frozen"],
        "frozen": ["active", "closed"],
        "closed": [],
    },
    "PDCAPlan": {
        "new": ["planning", "at_risk"],
        "planning": ["executing", "at_risk"],
        "executing": ["checking", "at_risk"],
        "checking": ["acting", "at_risk"],
        "acting": ["completed", "at_risk"],
        "at_risk": ["planning"],
        "completed": [],
    },
}

DEFAULT_TRANSITIONS: Dict[str, List[str]] = {
    "new": ["active", "at_risk"],
    "active": ["at_risk", "completed", "churned"],
    "at_risk": ["active", "churned", "failed"],
    "normal": ["warning", "at_risk"],
    "warning": ["normal", "at_risk"],
    "completed": [],
    "failed": ["active"],
    "churned": ["reactivated"],
}


def validate_transition(object_type: str, current_stage: str, target_stage: str) -> bool:
    transitions = LIFECYCLE_TRANSITIONS.get(object_type, DEFAULT_TRANSITIONS)
    allowed = transitions.get(current_stage, [])
    return target_stage in allowed


def get_valid_transitions(object_type: str, current_stage: str) -> List[str]:
    transitions = LIFECYCLE_TRANSITIONS.get(object_type, DEFAULT_TRANSITIONS)
    return transitions.get(current_stage, [])
