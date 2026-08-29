from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user, require_auth
from models.user import User
from models.inference import InferenceResult
from schemas.inference import InferenceRuleListResponse
from services.inference_service import get_inference_rules, execute_rule
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/api/inference", tags=["inference"])


@router.get("/rules", response_model=InferenceRuleListResponse)
def list_rules(
    db: Session = Depends(get_db),
    user: Optional = Depends(get_current_user),
):
    results = get_inference_rules(db)
    return InferenceRuleListResponse(results=results, total=len(results))


@router.post("/rules/{rule_id}/execute")
def execute(
    rule_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    result = execute_rule(db, rule_id)
    return result


class FrontendInferenceResult(BaseModel):
    title: str
    result_type: str
    confidence: float
    explanation: Optional[str] = None
    affected_entities: Optional[str] = None
    suggested_actions: Optional[str] = None


@router.post("/results")
def save_frontend_result(
    result: FrontendInferenceResult,
    db: Session = Depends(get_db),
):
    """Persist a frontend inference result to the database."""
    inference_result = InferenceResult(
        id=str(uuid.uuid4()),
        rule_name=result.title,
        result_type=result.result_type,
        confidence=result.confidence,
        evidence=result.explanation,
        inferred_value=result.affected_entities,
        status="active",
    )
    db.add(inference_result)
    db.commit()
    return {"id": inference_result.id, "status": "saved"}


@router.get("/results")
def list_results(
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """List recent inference results from both backend and frontend."""
    results = db.query(InferenceResult).order_by(
        InferenceResult.created_at.desc()
    ).limit(limit).all()
    return [{
        "id": r.id,
        "rule_name": r.rule_name,
        "result_type": r.result_type,
        "confidence": r.confidence,
        "evidence": r.evidence,
        "source_entity_id": r.source_entity_id,
        "target_entity_id": r.target_entity_id,
        "inferred_value": r.inferred_value,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else "",
    } for r in results]
