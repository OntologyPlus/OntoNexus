from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from auth import require_auth
from models.user import User
from evals.runner import run_eval_suite

router = APIRouter(prefix="/api/eval", tags=["eval"])


@router.post("/run")
def run_evals(
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="admin only")
    return run_eval_suite(db)
