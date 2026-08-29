from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import require_auth
from models.user import User
from services.ontology_health import get_ontology_health
from services.ontology_change_service import (
    create_change_request, review_change_request,
    get_pending_change_requests, create_version_snapshot,
    get_version_history, compare_versions,
)

router = APIRouter(prefix="/api/ontology-admin", tags=["ontology-admin"])


@router.get("/health")
def health_check(db: Session = Depends(get_db), user: Optional[User] = Depends(require_auth)):
    return get_ontology_health(db)


@router.post("/change-requests")
def submit_change_request(
    request: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    return create_change_request(
        db,
        change_type=request.get("changeType", "update"),
        target_type=request.get("targetType", ""),
        target_id=request.get("targetId"),
        change_description=request.get("description", ""),
        before_snapshot=request.get("beforeSnapshot"),
        after_snapshot=request.get("afterSnapshot"),
        requested_by=user.id,
    )


@router.get("/change-requests")
def list_change_requests(db: Session = Depends(get_db), user: Optional[User] = Depends(require_auth)):
    return get_pending_change_requests(db)


@router.put("/change-requests/{request_id}/review")
def review_request(
    request_id: str,
    review: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    result = review_change_request(
        db, request_id, user.id,
        approved=review.get("approved", False),
        notes=review.get("notes"),
    )
    if not result:
        raise HTTPException(status_code=404, detail="Change request not found")
    return result


@router.post("/versions")
def create_version(
    request: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    return create_version_snapshot(db, request.get("description", ""), user.id)


@router.get("/versions")
def list_versions(db: Session = Depends(get_db), user: Optional[User] = Depends(require_auth)):
    return get_version_history(db)


@router.get("/versions/compare")
def compare(
    version_id_1: str,
    version_id_2: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(require_auth),
):
    return compare_versions(db, version_id_1, version_id_2)
