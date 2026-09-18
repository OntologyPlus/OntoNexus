from typing import Optional, List
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from auth import require_auth
from models.user import User
from models.case import DecisionCase
from models.action import ActionProposal
from models.execution import ExecutionLog
from models.decision import DecisionRecord
from models.effect import EffectRecord
from decision.recorder import DecisionRecorder
from decision.causal import trace_decision_chain, analyze_decision_impact, add_causal_relationship
from decision.precedent import find_similar_decisions

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


@router.post("/cases")
def create_case(body: dict, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    case = DecisionCase(
        id=f"case_{uuid.uuid4().hex[:12]}",
        title=(body.get("title") or "未命名案件").strip(),
        description=body.get("description"),
        priority=body.get("priority", "medium"),
        owner_id=body.get("owner_id") or user.id,
        entity_ids=json.dumps(body.get("entity_ids", []), ensure_ascii=False),
        metadata_json=json.dumps(body.get("metadata", {}), ensure_ascii=False),
    )
    db.add(case)
    db.commit()
    return _case_dict(case)


@router.get("/cases")
def list_cases(status: Optional[str] = None, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    query = db.query(DecisionCase)
    if user.role not in ("admin", "manager", "compliance"):
        query = query.filter(DecisionCase.owner_id == user.id)
    if status:
        query = query.filter(DecisionCase.status == status)
    return [_case_dict(case) for case in query.order_by(DecisionCase.updated_at.desc()).all()]


@router.put("/cases/{case_id}")
def update_case(case_id: str, body: dict, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    case = db.query(DecisionCase).filter(DecisionCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.owner_id != user.id and user.role not in ("admin", "manager", "compliance"):
        raise HTTPException(status_code=403, detail="Insufficient permission")
    for field in ("title", "description", "priority", "status"):
        if field in body:
            setattr(case, field, body[field])
    if "status" in body and body["status"] == "closed":
        case.closed_at = datetime.now(timezone.utc)
    db.commit()
    return _case_dict(case)


def _case_dict(case: DecisionCase):
    def parse(value, fallback):
        try:
            return json.loads(value) if value else fallback
        except (TypeError, json.JSONDecodeError):
            return fallback
    return {
        "id": case.id, "title": case.title, "description": case.description,
        "status": case.status, "priority": case.priority, "owner_id": case.owner_id,
        "entity_ids": parse(case.entity_ids, []), "decision_ids": parse(case.decision_ids, []),
        "metadata": parse(case.metadata_json, {}), "created_at": case.created_at,
        "updated_at": case.updated_at, "closed_at": case.closed_at,
    }


@router.get("/cases/{case_id}/timeline")
def case_timeline(case_id: str, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    case = db.query(DecisionCase).filter(DecisionCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.owner_id != user.id and user.role not in ("admin", "manager", "compliance"):
        raise HTTPException(status_code=403, detail="Insufficient permission")
    decisions = db.query(DecisionRecord).filter(DecisionRecord.case_id == case_id).order_by(DecisionRecord.created_at.asc()).all()
    actions = db.query(ActionProposal).filter(ActionProposal.case_id == case_id).order_by(ActionProposal.timestamp.asc()).all()
    executions = db.query(ExecutionLog).filter(ExecutionLog.case_id == case_id).order_by(ExecutionLog.timestamp.asc()).all()
    effects = db.query(EffectRecord).filter(EffectRecord.case_id == case_id).order_by(EffectRecord.observed_at.asc()).all()
    return {
        "case": _case_dict(case),
        "decisions": [DecisionRecorder.to_dict(item) for item in decisions],
        "actions": [{"id": item.id, "status": item.status, "action_type": item.action_type, "entity_id": item.entity_id} for item in actions],
        "executions": [{"id": item.id, "status": item.status, "action_name": item.action_name, "timestamp": item.timestamp} for item in executions],
        "effects": [{"id": item.id, "metric": item.metric, "baseline": item.baseline, "target": item.target, "actual": item.actual, "unit": item.unit, "status": item.status, "observed_at": item.observed_at} for item in effects],
    }


@router.post("/cases/{case_id}/effects")
def record_case_effect(case_id: str, body: dict, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    case = db.query(DecisionCase).filter(DecisionCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.owner_id != user.id and user.role not in ("admin", "manager", "compliance"):
        raise HTTPException(status_code=403, detail="Insufficient permission")
    actual = body.get("actual")
    target = body.get("target")
    status = body.get("status") or ("met" if actual is not None and target is not None and float(actual) >= float(target) else "observing")
    effect = EffectRecord(id=f"effect_{uuid.uuid4().hex[:12]}", case_id=case_id, decision_id=body.get("decision_id"), action_id=body.get("action_id"), metric=body.get("metric", "custom"), baseline=body.get("baseline"), target=target, actual=actual, unit=body.get("unit"), status=status, note=body.get("note"))
    db.add(effect)
    db.commit()
    return {"id": effect.id, "case_id": case_id, "metric": effect.metric, "status": effect.status}


@router.get("/search")
def search_decisions(
    q: Optional[str] = Query(None),
    category: Optional[str] = None,
    outcome: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    recorder = DecisionRecorder(db)
    if q:
        return find_similar_decisions(db, q, category=category, max_results=limit)
    return recorder.search(category=category, outcome=outcome, limit=limit)


@router.get("/learning/weights")
def get_skill_weights(
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from decision.learning import get_weights
    return {"weights": get_weights(db)}


@router.post("/learning/evaluate")
def evaluate_skill_outcomes(
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from decision.learning import evaluate_due_outcomes
    results = evaluate_due_outcomes(db)
    db.commit()
    return {"evaluated": len(results), "results": results}


@router.post("/learning/feedback")
def post_skill_feedback(
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from decision.learning import apply_feedback, score_outcome
    outcome_id = body.get("outcome_id")
    if outcome_id:
        result = score_outcome(db, outcome_id, float(body.get("effectiveness") or 0), note=body.get("note"))
        if not result:
            raise HTTPException(status_code=404, detail="Outcome not found")
        db.commit()
        return result
    skill = body.get("skill")
    if not skill:
        raise HTTPException(status_code=400, detail="skill or outcome_id required")
    result = apply_feedback(db, skill, float(body.get("effectiveness") or 0), note=body.get("note"))
    db.commit()
    return result


@router.get("/{decision_id}")
def get_decision(
    decision_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    rec = DecisionRecorder(db).get(decision_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Decision not found")
    return rec


@router.get("/{decision_id}/chain")
def get_decision_chain(
    decision_id: str,
    direction: str = "ancestors",
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    return trace_decision_chain(db, decision_id, direction=direction)


@router.get("/{decision_id}/impact")
def get_decision_impact(
    decision_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    return analyze_decision_impact(db, decision_id)


@router.post("/{decision_id}/explain")
def explain_decision(
    decision_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    rec = DecisionRecorder(db).get(decision_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Decision not found")
    chain = trace_decision_chain(db, decision_id)
    return {
        "decision": rec,
        "chain": chain,
        "explanation": rec.get("reasoning"),
        "policy": rec.get("policyResult"),
        "evidenceIds": rec.get("evidenceIds"),
    }


@router.post("/{decision_id}/link")
def link_decisions(
    decision_id: str,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    target_id = body.get("target_id")
    relation = body.get("relation", "causes")
    if not target_id:
        raise HTTPException(status_code=400, detail="target_id required")
    result = add_causal_relationship(db, decision_id, target_id, relation)
    db.commit()
    return result
