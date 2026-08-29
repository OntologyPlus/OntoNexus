from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import require_auth
from database import get_db
from models.user import User

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


class SyncRequest(BaseModel):
    source: str
    records: List[Dict[str, Any]]


@router.post("/sync")
def ingest_sync(
    req: SyncRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Upsert CRM/ERP rows as ontology instances. Invalid records are rejected, not extracted."""
    from services.source_sync import sync_batch_isolated

    return sync_batch_isolated(db, req.source, req.records)


@router.get("/bindings")
def ingest_bindings(
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from services.source_sync import list_bindings

    rows = list_bindings(db)
    return {"bindings": rows, "count": len(rows)}
