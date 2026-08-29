"""Decision hub APIs: workspace overview + run a Skill against a pinned object."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import require_auth
from database import get_db
from models.user import User

router = APIRouter(prefix="/api/hub", tags=["hub"])

_EFFECT_LABELS = {
    "create VisitRecord": "写入拜访记录",
    "update doctor.nextRecommendedVisitDate": "更新下次建议拜访日",
    "notify SalesRep": "通知负责代表",
}

_BLOCK_PHRASES = (
    ("提交人不得终审", "提交人不能自己批，须区域经理审批"),
    ("提交人不得等于终审人", "提交人不能自己批"),
    ("无对象 ID 不得提案写操作", "没有指定客户，不能下动作"),
    ("高风险动作必须经人工审批后执行", "高风险动作必须区域经理批过才能执行"),
    ("请让经理在工作台审批", "请让区域经理审批"),
)


class HubRunRequest(BaseModel):
    query: str
    object_id: Optional[str] = None
    decision_id: Optional[str] = None
    action_type: Optional[str] = None


def _normalize_pending(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        **item,
        "entityName": item.get("entity_name") or item.get("entityName"),
        "entityType": item.get("entity_type") or item.get("entityType"),
        "reasoningChain": item.get("reasoning_chain") or item.get("reasoningChain"),
    }


def _plain_message(text: Optional[str]) -> str:
    if not text:
        return ""
    out = re.sub(r"HR-\d+", "", text)
    out = re.sub(r"Action Gateway", "", out, flags=re.I)
    for needle, label in _BLOCK_PHRASES:
        if needle in out:
            return label
    return re.sub(r"\s+", " ", out).strip(" ：。:()")


def _display_name(db: Session, user_id: Optional[str]) -> str:
    if not user_id:
        return ""
    row = db.query(User).filter(User.id == user_id).first()
    return getattr(row, "display_name", None) or user_id


def _human_effects(raw: Optional[str]) -> List[str]:
    from services.domain_mapper import _split_field

    out = []
    for item in _split_field(raw):
        label = _EFFECT_LABELS.get(item)
        if label:
            out.append(label)
    return out


def _build_loop(db: Session, user: User, pending: List[Dict[str, Any]], decisions: List[Dict[str, Any]]) -> Dict[str, Any]:
    from models.action import ActionProposal

    uid = getattr(user, "id", None) or "system"
    focal_id = "d1"
    case = next(
        (a for a in pending if a.get("entity_id") == focal_id or a.get("entityId") == focal_id),
        None,
    )
    executed = (
        db.query(ActionProposal)
        .filter(ActionProposal.entity_id == focal_id, ActionProposal.status.in_(["executed", "failed"]))
        .order_by(ActionProposal.timestamp.desc())
        .limit(8)
        .all()
    )
    submitter_id = (case or {}).get("proposed_by") if case else (executed[0].proposed_by if executed else None)
    facts: List[str] = []
    try:
        from semantic.logic import facts_about
        from semantic.pipeline import peek_activation

        pack = peek_activation(db, "预警诊断", user=user)
        if pack:
            facts = facts_about(pack.get("derived_facts") or [], focal_id)[:6]
    except Exception:
        facts = []

    blocked = []
    for rec in decisions:
        if rec.get("outcome") != "blocked":
            continue
        blocked.append(
            {
                "message": _plain_message(rec.get("reasoning") or rec.get("scenario")),
                "when": rec.get("createdAt"),
            }
        )
        if len(blocked) >= 6:
            break

    writes = []
    for row in executed:
        effects = _human_effects(row.action_definition_side_effects)
        if not effects and (row.action_type or "").lower() in ("schedulevisit", "schedule_visit"):
            effects = ["写入拜访记录", "更新下次建议拜访日", "通知负责代表"]
        writes.append(
            {
                "id": row.id,
                "title": row.title,
                "status": row.status,
                "entity_name": row.entity_name,
                "effects": effects,
                "error": _plain_message(row.error_message) if row.status == "failed" else None,
                "at": row.completed_at.isoformat() if row.completed_at else (row.timestamp.isoformat() if row.timestamp else None),
            }
        )

    from services.source_sync import list_bindings

    bindings = list_bindings(db, limit=40)
    counts = Counter((b.get("source") or "").upper() for b in bindings if b.get("source"))
    systems = [{"name": name, "count": n} for name, n in counts.items() if name]

    return {
        "facts": facts,
        "bindings": {"count": len(bindings), "systems": systems},
        "submitter": {
            "id": submitter_id,
            "name": _display_name(db, submitter_id),
            "is_current_user": bool(submitter_id and submitter_id == uid),
        },
        "blocked": blocked,
        "writes": writes,
    }


def build_overview(db: Session, user: User) -> Dict[str, Any]:
    from decision.learning import get_weights
    from decision.recorder import DecisionRecorder
    from models.ontology import OntologyObject
    from semantic.sales_signals import compute_sales_signals
    from services.action_service import get_pending_actions

    uid = getattr(user, "id", None) or "system"
    role = getattr(user, "role", None) or "user"
    pending = [_normalize_pending(a) for a in get_pending_actions(db, uid)]
    submitted_by_me = [a for a in pending if a.get("proposed_by") == uid]
    pending_for_me = [a for a in pending if a.get("proposed_by") and a.get("proposed_by") != uid]
    if role == "rep":
        pending_for_me = []

    decisions = DecisionRecorder(db).search(limit=12)
    latest_attribution = None
    for rec in decisions:
        meta = rec.get("metadata") or {}
        if meta.get("skill") == "attribution-analyzer":
            latest_attribution = {
                "decision_id": rec.get("id"),
                "insight_chain": meta.get("insight_chain"),
                "missing_signals": meta.get("missing_signals") or [],
                "reasoning": rec.get("reasoning"),
                "entity_ids": rec.get("entityIds") or [],
                "evidence_ids": rec.get("evidenceIds") or rec.get("evidence_ids") or [],
                "created_at": rec.get("createdAt"),
            }
            break

    alerts: List[Dict[str, Any]] = []
    for obj in (
        db.query(OntologyObject)
        .filter(OntologyObject.status.in_(["warning", "critical"]))
        .limit(12)
        .all()
    ):
        alerts.append(
            {
                "id": obj.id,
                "title": f"{obj.name or obj.id} · {obj.status}",
                "name": obj.name,
                "object_type": obj.object_type,
                "status": obj.status,
                "priority": "high" if obj.status == "critical" else "medium",
            }
        )

    focal = db.query(OntologyObject).filter(OntologyObject.id == "d1").first()
    sales_signals = compute_sales_signals(db, focal) if focal else {}

    from decision.learning import EVALUATE_AFTER_HOURS, list_pending_outcomes, list_scored_outcomes

    pending_learn = list_pending_outcomes(db)
    loop = _build_loop(db, user, pending, decisions)

    return {
        "user": {
            "id": uid,
            "role": role,
            "display_name": getattr(user, "display_name", None),
        },
        "pending_for_me": pending_for_me,
        "submitted_by_me": submitted_by_me,
        "pending_all": pending if role in ("admin", "manager") else submitted_by_me,
        "decisions": decisions,
        "alerts": alerts,
        "skill_weights": get_weights(db),
        "latest_attribution": latest_attribution,
        "sales_signals": sales_signals,
        "focal_object": {"id": "d1", "name": getattr(focal, "name", None)} if focal else None,
        "learning": {
            "evaluate_after_hours": EVALUATE_AFTER_HOURS,
            "pending": pending_learn,
            "due_count": sum(1 for row in pending_learn if row.get("due")),
            "scored": list_scored_outcomes(db),
        },
        "source_bindings": loop["bindings"],
        "loop": loop,
    }


@router.get("/overview")
def hub_overview(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    return build_overview(db, user)


@router.get("/logic")
def hub_logic(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    from semantic.ontology import get_ontology
    from semantic.pipeline import activate
    from services.inference_service import get_inference_rules

    pack = activate(db, "预警诊断", user=user)
    snapshot = get_ontology().validate_snapshot(db, limit=80)
    rules = get_inference_rules(db)
    compact_rules = [
        {
            "id": r.get("id"),
            "name": r.get("name"),
            "description": r.get("description"),
            "rule_type": r.get("type"),
            "enabled": r.get("enabled", True),
        }
        for r in rules[:24]
    ]
    return {
        "derived_facts": (pack.get("derived_facts") or [])[:40],
        "logic_trace": (pack.get("logic_trace") or [])[:20],
        "rules": compact_rules,
        "snapshot": {
            "ok": snapshot.get("ok"),
            "checked": snapshot.get("checked_objects"),
            "violations": (snapshot.get("violations") or [])[:12],
        },
    }


@router.post("/run")
def hub_run(
    req: HubRunRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from ai.orchestrator import orchestrate

    context: Dict[str, Any] = {}
    if req.object_id:
        context["object_id"] = req.object_id
    if req.decision_id:
        context["parent_decision_id"] = req.decision_id
    if req.action_type:
        context["action_type"] = req.action_type
    return orchestrate(db, req.query, user=user, context=context)
