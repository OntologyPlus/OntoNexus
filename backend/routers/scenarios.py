from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models.user import User
from schemas.scenario import ScenarioResponse, ScenarioListResponse
from services.scenario_service import get_scenarios, get_scenario_by_id, recalculate_scenario
from pydantic import BaseModel

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


class RecalculateRequest(BaseModel):
    params: dict


@router.get("/", response_model=ScenarioListResponse)
def list_scenarios(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    results = get_scenarios(db, category)
    return ScenarioListResponse(results=results, total=len(results))


@router.get("/{scenario_id}")
def get_scenario(
    scenario_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    result = get_scenario_by_id(db, scenario_id)
    if not result:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Scenario not found")
    return result


@router.post("/{scenario_id}/recalculate")
def recalculate(
    scenario_id: str,
    req: RecalculateRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    result = recalculate_scenario(db, scenario_id, req.params)
    if not result:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Scenario not found")
    return result
