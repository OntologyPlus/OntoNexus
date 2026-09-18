"""DecisionRecorder: first-class auditable decisions (OntoNexus + finance pattern)."""

from __future__ import annotations

import json
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from decision.policy import PolicyEngine
from models.decision import DecisionRecord
from semantic.provenance import ProvenanceManager


def _dumps(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, default=str)


class DecisionRecorder:
    def __init__(self, db: Session, policy_engine: Optional[PolicyEngine] = None):
        self.db = db
        self.policy = policy_engine or PolicyEngine()
        self.provenance = ProvenanceManager(db)

    def record(
        self,
        *,
        category: str,
        scenario: str,
        reasoning: str = "",
        outcome: str = "recorded",
        confidence: float = 0.8,
        decision_maker: str = "system",
        evidence_ids: Optional[List[str]] = None,
        causation_id: Optional[str] = None,
        parent_decision_id: Optional[str] = None,
        entity_ids: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        force_blocked: bool = False,
        refuse_reason: Optional[str] = None,
        case_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = {
            "category": category,
            "scenario": scenario,
            "reasoning": reasoning,
            "outcome": "blocked" if force_blocked else outcome,
            "confidence": confidence,
            "metadata": metadata or {},
        }
        policy_result = self.policy.check(payload)
        final_outcome = payload["outcome"]
        if force_blocked:
            final_outcome = "blocked"
            policy_result = {
                **policy_result,
                "passed": False,
                "violations": policy_result.get("violations", []) + [
                    {"policy_id": "hard_rule_window", "reason": refuse_reason or "hard rules truncated"}
                ],
            }
        elif not policy_result["passed"] and final_outcome != "blocked":
            final_outcome = "blocked"

        rec = DecisionRecord(
            id=f"dec_{uuid.uuid4().hex[:12]}",
            category=category,
            scenario=scenario,
            reasoning=refuse_reason or reasoning,
            outcome=final_outcome,
            confidence=confidence,
            decision_maker=decision_maker,
            evidence_ids=_dumps(evidence_ids or []),
            policy_version=policy_result.get("policy_version"),
            policy_result=_dumps(policy_result),
            causation_id=causation_id or str(uuid.uuid4()),
            parent_decision_id=parent_decision_id,
            entity_ids=_dumps(entity_ids or []),
            metadata_json=_dumps(metadata or {}),
            case_id=case_id,
        )
        self.db.add(rec)
        self.db.flush()

        prov_id = self.provenance.track_activity(
            activity_type="record_decision",
            agent=decision_maker,
            entity_ids=entity_ids or [],
            metadata={"decision_id": rec.id, "outcome": final_outcome, "category": category},
        )
        ids = evidence_ids or []
        ids = list(ids) + [prov_id]
        rec.evidence_ids = _dumps(ids)
        self.db.flush()

        try:
            from services.event_bus import EventType, publish_ontology_event
            event_type = (
                EventType.POLICY_BLOCKED if final_outcome == "blocked" else EventType.DECISION_RECORDED
            )
            publish_ontology_event(
                event_type,
                object_id=rec.id,
                object_type="Decision",
                object_name=category,
                data={"outcome": final_outcome, "scenario": scenario[:200]},
                source=decision_maker,
                causation_id=rec.causation_id,
                decision_id=rec.id,
            )
        except Exception:
            pass

        return self.to_dict(rec)

    def get(self, decision_id: str) -> Optional[Dict[str, Any]]:
        rec = self.db.query(DecisionRecord).filter(DecisionRecord.id == decision_id).first()
        return self.to_dict(rec) if rec else None

    def search(
        self,
        *,
        category: Optional[str] = None,
        outcome: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        q = self.db.query(DecisionRecord)
        if category:
            q = q.filter(DecisionRecord.category == category)
        if outcome:
            q = q.filter(DecisionRecord.outcome == outcome)
        if query:
            q = q.filter(DecisionRecord.scenario.contains(query))
        rows = q.order_by(DecisionRecord.created_at.desc()).limit(limit).all()
        return [self.to_dict(r) for r in rows]

    @staticmethod
    def to_dict(rec: DecisionRecord) -> Dict[str, Any]:
        def _loads(raw, default):
            if not raw:
                return default
            try:
                return json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                return default

        return {
            "id": rec.id,
            "category": rec.category,
            "scenario": rec.scenario,
            "reasoning": rec.reasoning,
            "outcome": rec.outcome,
            "confidence": rec.confidence,
            "decisionMaker": rec.decision_maker,
            "evidenceIds": _loads(rec.evidence_ids, []),
            "policyVersion": rec.policy_version,
            "policyResult": _loads(rec.policy_result, {}),
            "causationId": rec.causation_id,
            "parentDecisionId": rec.parent_decision_id,
            "entityIds": _loads(rec.entity_ids, []),
            "metadata": _loads(rec.metadata_json, {}),
            "caseId": rec.case_id,
            "createdAt": rec.created_at.isoformat() if rec.created_at else None,
        }
