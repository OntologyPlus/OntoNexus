"""Policy engine: gate decisions before they are recorded (OntoNexus pattern)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


DEFAULT_POLICIES = [
    {
        "id": "pol_min_confidence",
        "name": "min_confidence_for_execute",
        "version": "1.0",
        "rules": {"min_confidence": 0.5},
    },
    {
        "id": "pol_blocked_outcomes",
        "name": "allowed_outcomes",
        "version": "1.0",
        "rules": {
            "allowed_outcomes": [
                "recorded",
                "suggested",
                "proposed",
                "blocked",
                "approved",
                "rejected",
                "explained",
                "diagnosed",
            ]
        },
    },
]


class PolicyEngine:
    def __init__(self, policies: Optional[List[Dict[str, Any]]] = None):
        self.policies = policies if policies is not None else list(DEFAULT_POLICIES)

    def check(self, decision: Dict[str, Any]) -> Dict[str, Any]:
        violations = []
        for policy in self.policies:
            for key, expected in (policy.get("rules") or {}).items():
                ok, reason = self._eval_rule(key, expected, decision)
                if not ok:
                    violations.append({
                        "policy_id": policy.get("id"),
                        "policy_name": policy.get("name"),
                        "rule": key,
                        "reason": reason,
                    })
        passed = len(violations) == 0
        return {
            "passed": passed,
            "violations": violations,
            "policy_version": ",".join(
                f"{p.get('id')}@{p.get('version', '1.0')}" for p in self.policies
            ),
        }

    def _eval_rule(self, key: str, expected: Any, decision: Dict[str, Any]):
        metadata = decision.get("metadata") or {}
        if key == "min_confidence":
            conf = float(decision.get("confidence") or 0)
            if conf < float(expected):
                return False, f"confidence {conf} < {expected}"
            return True, ""
        if key == "allowed_outcomes":
            outcome = decision.get("outcome")
            if outcome not in expected:
                return False, f"outcome {outcome} not in {expected}"
            return True, ""
        if key == "required_categories":
            if decision.get("category") not in expected:
                return False, f"category {decision.get('category')} not in {expected}"
            return True, ""
        if key.startswith("min_"):
            field = key[4:]
            value = metadata.get(field, decision.get(field))
            if value is None or float(value) < float(expected):
                return False, f"{field} {value} < {expected}"
            return True, ""
        if key.startswith("max_"):
            field = key[4:]
            value = metadata.get(field, decision.get(field))
            if value is None or float(value) > float(expected):
                return False, f"{field} {value} > {expected}"
            return True, ""
        if key.startswith("required_"):
            field = key[9:]
            value = metadata.get(field, decision.get(field))
            if isinstance(expected, list):
                if not isinstance(value, list) or not all(item in value for item in expected):
                    return False, f"{field} missing required items {expected}"
            elif value != expected:
                return False, f"{field} != {expected}"
            return True, ""
        return True, ""
