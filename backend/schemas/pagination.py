from pydantic import BaseModel
from typing import Optional, List, Any


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20


class PaginatedResponse(BaseModel):
    results: List[Any]
    total: int
    page: int
    page_size: int
    has_next: bool
