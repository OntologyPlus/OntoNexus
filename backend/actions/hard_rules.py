"""Hard rules on the write path. Deterministic; never delegated to the LLM."""

from __future__ import annotations

from typing import Dict, List, Optional


class HardRuleViolation(Exception):
    def __init__(self, rule_id: str, message: str):
        self.rule_id = rule_id
        self.message = message
        super().__init__(f"{rule_id}: {message}")


def evaluate_hard_rules(
    action_type: str,
    object_id: Optional[str],
    *,
    approved: bool = False,
    submitter_id: Optional[str] = None,
    approver_id: Optional[str] = None,
    executing: bool = False,
    object_type: Optional[str] = None,
) -> List[Dict[str, str]]:
    """Return list of violations. Empty means pass."""
    from actions.contracts import action_applies, get_contract, risk_rank

    contract = get_contract(action_type)
    violations = []

    if contract.requires_object_id and not object_id:
        violations.append({"rule_id": "HR-001", "message": "无对象 ID 不得提案写操作"})

    if executing and risk_rank(contract.risk_level) >= 2 and not approved:
        violations.append({"rule_id": "HR-002", "message": "高风险动作必须经人工审批后执行"})

    if executing and contract.requires_approval:
        if submitter_id and approver_id and submitter_id == approver_id:
            violations.append({"rule_id": "HR-003", "message": "提交人不得等于终审人"})

    if contract.applies_to and object_type and not action_applies(action_type, object_type):
        violations.append({
            "rule_id": "HR-004",
            "message": f"{action_type} 不适用于类 {object_type}（允许 {contract.applies_to}）",
        })

    return violations


def assert_hard_rules(*args, **kwargs):
    violations = evaluate_hard_rules(*args, **kwargs)
    if violations:
        first = violations[0]
        raise HardRuleViolation(first["rule_id"], first["message"])
