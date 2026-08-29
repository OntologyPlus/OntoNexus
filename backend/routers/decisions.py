from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from auth import require_auth
from models.user import User
from decision.recorder import DecisionRecorder
from decision.causal import trace_decision_chain, analyze_decision_impact, add_causal_relationship
from decision.precedent import find_similar_decisions

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


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
