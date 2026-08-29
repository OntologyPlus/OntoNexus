from pydantic import BaseModel
from typing import Optional, List


class ChatRequest(BaseModel):
    message: str
    user_id: str = "default_user"
    thread_id: Optional[str] = None
    context: Optional[dict] = None


class ChatResponse(BaseModel):
    response: str
    thread_id: str
    actions: List[dict] = []
    reasoning: Optional[str] = None
