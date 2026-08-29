from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from auth import require_auth
from models.user import User
from services.audit_chain import verify_chain
from semantic.provenance import ProvenanceManager

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/verify-chain")
def verify_audit_chain(
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="admin only")
    return verify_chain(db)


@router.get("/provenance/verify")
def verify_provenance_chain(
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="admin only")
    return ProvenanceManager(db).verify_chain()
