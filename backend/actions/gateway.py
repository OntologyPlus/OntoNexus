"""Action Gateway: the only legal write boundary for world-changing actions."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from actions.contracts import get_contract, risk_rank
from actions.hard_rules import HardRuleViolation, evaluate_hard_rules
from actions.sod import SoDViolation, check_sod
from exceptions import ActionExecutionError
from models.action import ActionProposal
from models.execution import ExecutionLog


def _idempotency_key(action_type: str, object_id: Optional[str], params: Dict[str, Any]) -> str:
    raw = json.dumps({"a": action_type, "o": object_id, "p": params}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


class ActionGateway:
    def __init__(self, db: Session):
        self.db = db

    def submit(
        self,
        *,
        action_type: str,
        object_id: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        user_id: str = "system",
        title: Optional[str] = None,
        description: Optional[str] = None,
        causation_id: Optional[str] = None,
        decision_id: Optional[str] = None,
        case_id: Optional[str] = None,
        reasoning: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """``reasoning`` (optional) annotates the proposal for approvers:
        {conclusion, confidence, evidence}. It never affects rule evaluation."""
        params = params or {}
        reasoning = reasoning or {}
        idempotency_key = params.get("idempotency_key") or _idempotency_key(action_type, object_id, params)
        existing = self.db.query(ActionProposal).filter(ActionProposal.idempotency_key == idempotency_key).first()
        if existing:
            return {
                "success": True,
                "status": existing.status,
                "proposal_id": existing.id,
                "risk_level": existing.risk_level,
                "proposed_by": existing.proposed_by,
                "message": "已返回幂等键对应的既有动作提案。",
                "idempotent": True,
            }
        source_type = params.get("entity_type") or params.get("objectType")
        if object_id and not source_type:
            from models.ontology import OntologyObject
            obj = self.db.query(OntologyObject).filter(OntologyObject.id == object_id).first()
            if obj:
                source_type = obj.object_type
        from semantic.ontology import get_ontology
        get_ontology().validate_write_params(params, source_type)
        contract = get_contract(action_type)
        violations = evaluate_hard_rules(
            action_type,
            object_id,
            approved=False,
            submitter_id=user_id,
            executing=False,
            object_type=source_type,
        )
        if violations:
            self._record_blocked(action_type, object_id, user_id, violations, causation_id, decision_id)
            raise HardRuleViolation(violations[0]["rule_id"], violations[0]["message"])

        needs_approval = contract.requires_approval or risk_rank(contract.risk_level) >= 2
        proposal = ActionProposal(
            id=f"ap_{uuid.uuid4().hex[:12]}",
            title=title or action_type,
            description=description or json.dumps(params, ensure_ascii=False, default=str),
            action_type=action_type,
            entity_id=object_id,
            entity_type=source_type or params.get("entity_type"),
            entity_name=params.get("entity_name"),
            priority="high" if risk_rank(contract.risk_level) >= 3 else "medium",
            status="pending" if needs_approval else "approved",
            proposed_by=user_id,
            action_definition_name=action_type,
            action_definition_requires_approval=needs_approval,
            action_definition_side_effects=json.dumps(contract.side_effects),
            idempotency_key=idempotency_key,
            decision_id=decision_id,
            case_id=case_id or params.get("case_id"),
            causation_id=causation_id,
            risk_level=contract.risk_level,
            reasoning_conclusion=reasoning.get("conclusion"),
            reasoning_confidence=reasoning.get("confidence"),
            reasoning_evidence=reasoning.get("evidence"),
        )
        if not needs_approval:
            proposal.approved_by = "system"
            proposal.approved_at = datetime.now(timezone.utc)
        self.db.add(proposal)
        self.db.flush()

        self._audit(
            f"gateway.submit:{action_type}",
            object_id,
            user_id,
            {"proposal_id": proposal.id, "risk": contract.risk_level, "status": proposal.status},
            causation_id,
            decision_id,
        )

        if needs_approval:
            return {
                "success": True,
                "status": "pending",
                "proposal_id": proposal.id,
                "risk_level": contract.risk_level,
                "proposed_by": user_id,
                "message": "已创建待审批提案，未改变世界状态。提交人不得自批，请让经理在工作台审批。",
            }

        return self.execute_approved(proposal.id, user_id="system", causation_id=causation_id, decision_id=decision_id)

    def approve(self, proposal_id: str, approver_id: str, causation_id: Optional[str] = None) -> Dict[str, Any]:
        proposal = self.db.query(ActionProposal).filter(ActionProposal.id == proposal_id).first()
        if not proposal:
            raise ActionExecutionError("Action not found")
        if proposal.status != "pending":
            if proposal.status in ("approved", "executed", "failed", "rejected"):
                return {"action_id": proposal.id, "status": proposal.status, "message": "动作已处理，不重复审批。"}
            raise ActionExecutionError(f"Invalid action status: {proposal.status}")
        try:
            check_sod(proposal.proposed_by, approver_id)
        except SoDViolation as exc:
            self._record_blocked(
                proposal.action_type or "",
                proposal.entity_id,
                approver_id,
                [{"rule_id": "HR-003", "message": str(exc)}],
                causation_id,
                None,
            )
            raise
        proposal.status = "approved"
        proposal.approved_by = approver_id
        proposal.approved_at = datetime.now(timezone.utc)
        self.db.flush()
        self._audit("gateway.approve", proposal.entity_id, approver_id, {"proposal_id": proposal_id}, causation_id, None)
        return {"action_id": proposal.id, "status": "approved", "message": "Action approved successfully"}

    def reject(self, proposal_id: str, user_id: str, feedback: Optional[str] = None) -> Dict[str, Any]:
        proposal = self.db.query(ActionProposal).filter(ActionProposal.id == proposal_id).first()
        if not proposal:
            raise ActionExecutionError("Action not found")
        if proposal.status != "pending":
            return {"action_id": proposal.id, "status": proposal.status, "message": "动作已处理，不重复拒绝。"}
        proposal.status = "rejected"
        proposal.error_message = feedback
        self.db.flush()
        return {"action_id": proposal.id, "status": "rejected", "message": "Action rejected"}

    def execute_approved(
        self,
        proposal_id: str,
        user_id: str,
        causation_id: Optional[str] = None,
        decision_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        proposal = self.db.query(ActionProposal).filter(ActionProposal.id == proposal_id).first()
        if not proposal:
            raise ActionExecutionError("Action not found")
        if proposal.status == "executed":
            return {"action_id": proposal.id, "status": "executed", "message": "动作已执行，不重复执行。"}
        if proposal.status != "approved":
            raise ActionExecutionError("Action must be approved first")

        violations = evaluate_hard_rules(
            proposal.action_type or "",
            proposal.entity_id,
            approved=True,
            submitter_id=proposal.proposed_by,
            approver_id=proposal.approved_by or user_id,
            executing=True,
            object_type=proposal.entity_type,
        )
        if violations:
            self._record_blocked(
                proposal.action_type or "",
                proposal.entity_id,
                user_id,
                violations,
                causation_id,
                decision_id,
            )
            raise HardRuleViolation(violations[0]["rule_id"], violations[0]["message"])

        from services.action_executor import ActionExecutor

        executor = ActionExecutor(self.db)
        params = {}
        if proposal.description:
            try:
                parsed = json.loads(proposal.description)
                if isinstance(parsed, dict):
                    params = parsed
            except json.JSONDecodeError:
                params = {"reason": proposal.description}

        proposal.status = "executed"
        proposal.started_at = datetime.now(timezone.utc)

        if proposal.entity_id and proposal.action_type:
            result = executor.execute_object_action(
                proposal.entity_id,
                proposal.action_type,
                params,
                user_id,
                _via_gateway=True,
            )
            proposal.execution_logs = json.dumps(result, default=str)
            if result.get("success"):
                proposal.completed_at = datetime.now(timezone.utc)
            else:
                proposal.status = "failed"
                proposal.error_message = result.get("error", "Unknown error")
        else:
            log = ExecutionLog(
                id=str(uuid.uuid4()),
                action_name=proposal.title,
                tool_name=proposal.action_type or "gateway",
                parameters=json.dumps(params, default=str),
                status="executed",
                result="executed via gateway",
                plan_id=proposal.id,
                user_id=user_id,
                case_id=proposal.case_id,
            )
            self.db.add(log)
            proposal.completed_at = datetime.now(timezone.utc)
            result = {"success": True}

        self._audit(
            f"gateway.execute:{proposal.action_type}",
            proposal.entity_id,
            user_id,
            {"proposal_id": proposal.id, "status": proposal.status},
            causation_id,
            decision_id,
        )
        self.db.flush()
        return {
            "action_id": proposal.id,
            "status": proposal.status,
            "result": result,
            "message": "Action executed via gateway" if proposal.status == "executed" else proposal.error_message,
        }

    def _record_blocked(self, action_type, object_id, user_id, violations, causation_id, decision_id):
        try:
            from decision.recorder import DecisionRecorder
            DecisionRecorder(self.db).record(
                category="action_gateway",
                scenario=f"blocked {action_type} on {object_id}",
                reasoning=json.dumps(violations, ensure_ascii=False),
                outcome="blocked",
                confidence=1.0,
                decision_maker=user_id,
                causation_id=causation_id,
                entity_ids=[object_id] if object_id else [],
                force_blocked=True,
                refuse_reason=violations[0]["message"] if violations else "blocked",
            )
        except Exception:
            pass
        self._audit(
            f"gateway.blocked:{action_type}",
            object_id,
            user_id,
            {"violations": violations},
            causation_id,
            decision_id,
        )

    def _audit(self, action, entity_id, user_id, details, causation_id, decision_id):
        from services.audit_chain import append_audit

        append_audit(
            self.db,
            action=action,
            entity_type="Action",
            entity_id=entity_id,
            user_id=user_id,
            details=details,
            causation_id=causation_id,
            decision_id=decision_id,
        )
