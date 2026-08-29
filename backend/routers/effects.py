from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models.user import User
from services.effect_tracking_service import get_decision_effects

router = APIRouter(prefix="/api/effects", tags=["effects"])


@router.get("/{decision_id}")
def get_effects(
    decision_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return get_decision_effects(db, decision_id)
