from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user, require_auth
from models.user import User
from models.reminder import Reminder

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("/")
def list_reminders(
    user_id: str = Query("default_user"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    effective_user_id = user.id if user else user_id
    reminders = db.query(Reminder).filter(
        Reminder.user_id == effective_user_id,
        Reminder.status == "active",
    ).order_by(Reminder.created_at.desc()).all()
    results = []
    for r in reminders:
        results.append({
            "id": r.id,
            "type": r.reminder_type,
            "title": r.title,
            "description": r.description,
            "dueDate": r.due_date.isoformat() if r.due_date else None,
            "priority": r.priority,
            "status": r.status,
            "entityId": r.entity_id,
        })
    return results


@router.post("/{reminder_id}/dismiss")
def dismiss_reminder(
    reminder_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    r = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if r:
        r.status = "dismissed"
        db.commit()
    return {"success": True}
