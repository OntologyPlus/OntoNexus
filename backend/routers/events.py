from typing import Optional
from fastapi import APIRouter, Depends
from models.user import User
from auth import get_current_user
from services.event_bus import event_bus

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("/recent")
def get_recent_events(
    limit: int = 50,
    event_type: Optional[str] = None,
    user: Optional[User] = Depends(get_current_user),
):
    return {"events": event_bus.get_recent_events(limit, event_type)}


@router.get("/stats")
def get_event_stats(user: Optional[User] = Depends(get_current_user)):
    from services.cache_service import ontology_cache
    return {
        "eventBus": {
            "totalLogged": len(event_bus._event_log),
        },
        "cache": ontology_cache.get_stats(),
    }
