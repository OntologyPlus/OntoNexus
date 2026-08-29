from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models.user import User
from services import memory_service

router = APIRouter(prefix="/api/memory", tags=["memory"])


class StoreMemoryRequest(BaseModel):
    memory_type: str
    content: dict
    importance: float = 0.5
    decay_rate: float = 0.01
    tags: list[str] = []


class SearchMemoryRequest(BaseModel):
    query: str
    memory_type: Optional[str] = None
    top_k: int = 5


class SearchKeywordRequest(BaseModel):
    query: str
    memory_type: Optional[str] = None
    top_k: int = 10


@router.post("/store")
def store_memory_endpoint(
    request: StoreMemoryRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    agent_id = user.id if user else "anonymous"
    memory_id = memory_service.store_memory(
        db=db,
        agent_id=agent_id,
        memory_type=request.memory_type,
        content=request.content,
        importance=request.importance,
        decay_rate=request.decay_rate,
        tags=request.tags,
    )
    if not memory_id:
        raise HTTPException(status_code=500, detail="Failed to store memory")
    return {"memory_id": memory_id, "success": True}


@router.post("/search/semantic")
def search_memory_semantic_endpoint(
    request: SearchMemoryRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    agent_id = user.id if user else "anonymous"
    results = memory_service.search_memory_semantic(
        db=db,
        query=request.query,
        agent_id=agent_id,
        memory_type=request.memory_type,
        top_k=request.top_k,
    )
    return {"results": results, "count": len(results)}


@router.post("/search/keyword")
def search_memory_keyword_endpoint(
    request: SearchKeywordRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    agent_id = user.id if user else "anonymous"
    results = memory_service.search_memory_keyword(
        db=db,
        query=request.query,
        agent_id=agent_id,
        memory_type=request.memory_type,
        top_k=request.top_k,
    )
    return {"results": results, "count": len(results)}


@router.get("/stats")
def get_memory_stats_endpoint(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    agent_id = user.id if user else None
    stats = memory_service.get_memory_stats(db=db, agent_id=agent_id)
    return stats
