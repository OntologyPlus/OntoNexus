from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user, require_auth
from models.user import User
from models.notification import Notification
from schemas.notification import NotificationSchema, NotificationListResponse

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/", response_model=NotificationListResponse)
def list_notifications(
    user_id: str = Query("default_user"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    effective_user_id = user.id if user else user_id
    notifications = db.query(Notification).filter(Notification.user_id == effective_user_id).order_by(Notification.timestamp.desc()).all()
    results = []
    for n in notifications:
        results.append(NotificationSchema(
            id=n.id,
            type=n.type,
            title=n.title,
            message=n.message,
            timestamp=n.timestamp.isoformat() if n.timestamp else None,
            read=n.read,
            priority=n.priority,
        ))
    return NotificationListResponse(results=results, total=len(results))


@router.put("/{notification_id}/read")
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if n:
        n.read = True
        db.commit()
    return {"success": True}
