"""Action contracts: risk level, approval, idempotency."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

RISK_R0 = "R0"
RISK_R1 = "R1"
RISK_R2 = "R2"
RISK_R3 = "R3"
RISK_R4 = "R4"


@dataclass
class ActionContract:
    action_type: str
    risk_level: str
    requires_approval: bool
    requires_object_id: bool = True
    side_effects: List[str] = field(default_factory=list)
    description: str = ""
    applies_to: List[str] = field(default_factory=list)


CONTRACTS: Dict[str, ActionContract] = {
    "ontology_lookup": ActionContract("ontology_lookup", RISK_R0, False, False, description="read"),
    "metric_diagnosis": ActionContract("metric_diagnosis", RISK_R0, False, False, description="read"),
    "causal_explainer": ActionContract("causal_explainer", RISK_R0, False, False, description="read"),
    "report_narrator": ActionContract("report_narrator", RISK_R1, False, False, description="draft report"),
    "recovery_plan_drafter": ActionContract("recovery_plan_drafter", RISK_R1, False, True, description="draft proposal", applies_to=["Targetable", "HCP", "Hospital"]),
    "scheduleVisit": ActionContract("scheduleVisit", RISK_R2, True, True, ["create VisitRecord"], applies_to=["HCP", "Hospital"]),
    "updateSentiment": ActionContract("updateSentiment", RISK_R2, True, True, applies_to=["HCP"]),
    "flagComplianceRisk": ActionContract("flagComplianceRisk", RISK_R3, True, True, ["create ComplianceAlert"], applies_to=["HCP", "Hospital", "Auditable", "SalesRep"]),
    "markAsAtRisk": ActionContract("markAsAtRisk", RISK_R3, True, True, applies_to=["HCP", "Hospital"]),
    "allocateBudget": ActionContract("allocateBudget", RISK_R3, True, True, applies_to=["Targetable"]),
    "updateActualValue": ActionContract("updateActualValue", RISK_R2, True, True, applies_to=["Targetable"]),
    "escalate": ActionContract("escalate", RISK_R3, True, True, applies_to=["HCP", "Hospital", "SalesTarget"]),
    "approve": ActionContract("approve", RISK_R2, True, True),
    "reject": ActionContract("reject", RISK_R2, True, True),
    "dismiss": ActionContract("dismiss", RISK_R2, True, True),
    "create_visit_record": ActionContract("create_visit_record", RISK_R2, True, True, ["create VisitRecord"], applies_to=["HCP", "Hospital"]),
    "update_doctor_sentiment": ActionContract("update_doctor_sentiment", RISK_R2, True, True, applies_to=["HCP"]),
    "flag_compliance_risk": ActionContract("flag_compliance_risk", RISK_R3, True, True, applies_to=["HCP", "Hospital", "Auditable", "SalesRep"]),
    "execute_action": ActionContract("execute_action", RISK_R2, True, True),
    "send_notification": ActionContract("send_notification", RISK_R1, False, False),
    "updateStatus": ActionContract("updateStatus", RISK_R2, True, True),
    "updateAccessStatus": ActionContract("updateAccessStatus", RISK_R2, True, True),
    "inviteToEvent": ActionContract("inviteToEvent", RISK_R1, False, True, applies_to=["HCP"]),
    "generateVisitBrief": ActionContract("generateVisitBrief", RISK_R1, False, True, applies_to=["HCP", "Hospital"]),
    "advanceCycle": ActionContract("advanceCycle", RISK_R2, True, True, applies_to=["Targetable"]),
}


def get_contract(action_type: str) -> ActionContract:
    if action_type in CONTRACTS:
        return CONTRACTS[action_type]
    return ActionContract(
        action_type=action_type,
        risk_level=RISK_R2,
        requires_approval=True,
        requires_object_id=True,
        description="default high-caution contract",
    )


def risk_rank(level: str) -> int:
    return {"R0": 0, "R1": 1, "R2": 2, "R3": 3, "R4": 4}.get(level, 2)


def action_applies(action_type: str, object_type: Optional[str]) -> bool:
    """True if the action's ontology domain accepts this class (incl. subclasses)."""
    contract = get_contract(action_type)
    if not contract.applies_to:
        return True
    if not object_type:
        return True
    from semantic.ontology import get_ontology
    return get_ontology().compatible(object_type, contract.applies_to)


def eligible_write_actions(object_type: Optional[str]) -> List[str]:
    if not object_type:
        return []
    names = []
    for name, contract in CONTRACTS.items():
        if not contract.applies_to:
            continue
        if risk_rank(contract.risk_level) < 2 and not contract.requires_approval:
            continue
        if action_applies(name, object_type):
            names.append(name)
    return names
