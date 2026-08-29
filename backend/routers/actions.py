from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user, require_auth
from models.user import User
from schemas.action import ActionApprovalRequest, ActionApprovalResponse
from services.action_service import get_pending_actions, approve_action, reject_action, execute_action, get_execution_logs

router = APIRouter(prefix="/api/actions", tags=["actions"])


@router.get("/pending")
def list_pending_actions(
    user_id: str = "default_user",
    db: Session = Depends(get_db),
    user: Optional = Depends(get_current_user),
):
    effective_user_id = user.id if user else user_id
    results = get_pending_actions(db, effective_user_id)
    return results


@router.post("/{action_id}/approve", response_model=ActionApprovalResponse)
def approve(
    action_id: str,
    req: ActionApprovalRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    result = approve_action(db, action_id, user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Action not found")
    return ActionApprovalResponse(**result)


@router.post("/{action_id}/reject", response_model=ActionApprovalResponse)
def reject(
    action_id: str,
    req: ActionApprovalRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    result = reject_action(db, action_id, user.id, req.feedback)
    if not result:
        raise HTTPException(status_code=404, detail="Action not found")
    return ActionApprovalResponse(**result)


@router.post("/{action_id}/execute")
def execute(
    action_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    result = execute_action(db, action_id, user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Action not found")
    return result


@router.get("/execution-logs")
def list_execution_logs(
    action_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    return get_execution_logs(db, action_id, limit)
