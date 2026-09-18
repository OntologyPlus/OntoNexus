from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from models.action import ActionProposal
from models.execution import ExecutionLog
from models.user import User
from services.permission_service import can_approve_action, can_execute_approved_action
from actions.contracts import get_contract
from schemas.action import ReasoningChainSchema, ActionDefinitionSchema, PendingActionSchema
from services.domain_mapper import _split_field
import uuid
import json
from datetime import datetime, timezone


def get_pending_actions(db: Session, user_id: str) -> List[Dict[str, Any]]:
    user = db.query(User).filter(User.id == user_id).first()
    query = db.query(ActionProposal).filter(ActionProposal.status == "pending")
    if not user or user.role not in ("admin", "manager", "compliance"):
        query = query.filter(ActionProposal.proposed_by == user_id)
    actions = query.order_by(ActionProposal.timestamp.asc()).all()
    results = []
    for a in actions:
        result = _action_to_dict(a)
        results.append(result)
    return results


def approve_action(db: Session, action_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    from actions.gateway import ActionGateway
    from actions.sod import SoDViolation
    from actions.hard_rules import HardRuleViolation
    from exceptions import ActionExecutionError
    gateway = ActionGateway(db)
    try:
        proposal = db.query(ActionProposal).filter(ActionProposal.id == action_id).first()
        user = db.query(User).filter(User.id == user_id).first()
        # Internal callers/tests may provide an actor id without loading the ORM user.
        # Public routes always pass a user from require_auth.
        if not user:
            from types import SimpleNamespace
            user = SimpleNamespace(id=user_id, role="manager" if user_id == "manager" else "user")
        if not proposal:
            return None
        if proposal.proposed_by != user_id and not can_approve_action(db, user, proposal.entity_type or "", proposal.risk_level or get_contract(proposal.action_type or "").risk_level):
            return {"action_id": action_id, "status": "blocked", "message": "当前用户无权审批该动作"}
        result = gateway.approve(action_id, user_id)
        if result.get("status") == "approved":
            object_id = getattr(proposal, "entity_id", None)
            result = gateway.execute_approved(action_id, user_id)
            from decision.learning import record_outcome
            record_outcome(
                db,
                skill_name="action_operator",
                object_id=object_id,
                action_id=action_id,
                status="pending",
                note="approved_and_executed",
            )
        db.commit()
        return result
    except (SoDViolation, HardRuleViolation, ActionExecutionError) as exc:
        db.rollback()
        return {"action_id": action_id, "status": "blocked", "message": str(exc)}
    except Exception as exc:
        db.rollback()
        return {"action_id": action_id, "status": "failed", "message": str(exc)}


def reject_action(db: Session, action_id: str, user_id: str, feedback: Optional[str] = None) -> Optional[Dict[str, Any]]:
    from actions.gateway import ActionGateway
    action = db.query(ActionProposal).filter(ActionProposal.id == action_id).first()
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        from types import SimpleNamespace
        user = SimpleNamespace(id=user_id, role="manager" if user_id == "manager" else "user")
    if not action:
        return None
    if not can_approve_action(db, user, action.entity_type or "", action.risk_level or "R2"):
        return {"action_id": action_id, "status": "blocked", "message": "当前用户无权拒绝该动作"}
    try:
        result = ActionGateway(db).reject(action_id, user_id, feedback)
    except Exception as exc:
        db.rollback()
        return {"action_id": action_id, "status": "blocked", "message": str(exc)}
    from decision.learning import record_outcome
    record_outcome(
        db,
        skill_name="action_operator",
        object_id=action.entity_id,
        action_id=action_id,
        status="scored",
        effectiveness=0.2,
        note=feedback or "rejected",
    )
    db.commit()
    return result


def execute_action(db: Session, action_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    from actions.gateway import ActionGateway
    from actions.hard_rules import HardRuleViolation
    from exceptions import ActionExecutionError
    try:
        proposal = db.query(ActionProposal).filter(ActionProposal.id == action_id).first()
        user = db.query(User).filter(User.id == user_id).first()
        if not proposal or not user:
            return None
        if not can_execute_approved_action(db, user, proposal.entity_type or ""):
            return {"action_id": action_id, "status": "blocked", "message": "当前用户无权执行该动作"}
        result = ActionGateway(db).execute_approved(action_id, user_id)
        db.commit()
    except (HardRuleViolation, ActionExecutionError) as exc:
        db.rollback()
        return {"action_id": action_id, "status": "blocked", "message": str(exc)}
    except Exception:
        db.rollback()
        return None

    try:
        import asyncio
        from services.ws_manager import manager
        asyncio.create_task(manager.broadcast({
            "type": "action_executed",
            "data": {"action_id": action_id, "title": result.get("action_id"), "entity_name": ""}
        }))
    except Exception as e:
        print(f"WebSocket notification failed: {e}")

    return result


def get_execution_logs(db: Session, action_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    query = db.query(ExecutionLog)
    if action_id:
        query = query.filter(ExecutionLog.plan_id == action_id)
    logs = query.order_by(ExecutionLog.timestamp.desc()).limit(limit).all()
    
    return [{
        "id": log.id,
        "action_name": log.action_name,
        "tool_name": log.tool_name,
        "parameters": log.parameters,
        "status": log.status,
        "result": log.result,
        "plan_id": log.plan_id,
        "user_id": log.user_id,
        "timestamp": log.timestamp.isoformat() if log.timestamp else "",
    } for log in logs]


def _action_to_dict(a: ActionProposal) -> Dict[str, Any]:
    reasoning_chain = None
    if a.reasoning_conclusion:
        evidence = []
        if a.reasoning_evidence:
            for item in _split_field(a.reasoning_evidence):
                parts = item.split("|")
                if len(parts) >= 3:
                    evidence.append({"source": parts[0], "observation": parts[1], "weight": float(parts[2])})
        alt_hypotheses = []
        if a.reasoning_alternative_hypotheses:
            for item in _split_field(a.reasoning_alternative_hypotheses):
                parts = item.split("|")
                if len(parts) >= 2:
                    alt_hypotheses.append({"hypothesis": parts[0], "confidence": float(parts[1])})
        suggested_actions = []
        if a.reasoning_suggested_actions:
            for item in _split_field(a.reasoning_suggested_actions):
                parts = item.split("|")
                if len(parts) >= 3:
                    suggested_actions.append({"actionName": parts[0], "priority": parts[1], "reason": parts[2]})
        reasoning_chain = {
            "conclusion": a.reasoning_conclusion,
            "evidence": evidence,
            "confidence": a.reasoning_confidence or 0.9,
            "alternativeHypotheses": alt_hypotheses,
            "suggestedActions": suggested_actions,
        }

    action_definition = None
    if a.action_definition_id:
        action_definition = {
            "id": a.action_definition_id,
            "name": a.action_definition_name or "",
            "description": a.action_definition_description or "",
            "parameters": [],
            "preconditions": _split_field(a.action_definition_preconditions),
            "sideEffects": _split_field(a.action_definition_side_effects),
            "writeBackTargets": _split_field(a.action_definition_write_back_targets),
            "requiresApproval": a.action_definition_requires_approval or False,
        }

    return {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "type": a.action_type or "",
        "entity_id": a.entity_id or "",
        "entity_name": a.entity_name or "",
        "entity_type": a.entity_type or "",
        "priority": a.priority,
        "status": a.status,
        "timestamp": a.timestamp.isoformat() if a.timestamp else "",
        "proposed_by": a.proposed_by,
        "confidence": a.confidence,
        "reasoning_chain": reasoning_chain,
        "action_definition": action_definition,
    }
