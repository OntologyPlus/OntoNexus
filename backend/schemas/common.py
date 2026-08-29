from pydantic import BaseModel
from typing import Optional, Any


class HealthResponse(BaseModel):
    status: str
    name: str
    version: str
