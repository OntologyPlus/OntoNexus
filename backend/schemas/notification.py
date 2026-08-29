from pydantic import BaseModel
from typing import Optional


class NotificationSchema(BaseModel):
    id: str
    type: str
    title: str
    message: Optional[str] = None
    timestamp: Optional[str] = None
    read: bool = False
    priority: str = "medium"


class NotificationListResponse(BaseModel):
    results: list[NotificationSchema]
    total: int
